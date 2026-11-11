from pathlib import Path

from fastapi.testclient import TestClient

from app.graph import CommerceSupportAgent, GroundingVerdict, RouteDecision
from app.knowledge import PolicyChunk, PolicyRetriever, load_policy_chunks
from app.main import app


def test_bm25_retrieves_cancellation_policy():
    chunks = [
        PolicyChunk("refund", "退款申请", "policies.md", "已支付、已发货或已完成订单可申请退款。"),
        PolicyChunk("cancel", "订单取消", "policies.md", "待支付和已支付订单可以进入取消流程。"),
    ]
    retriever = PolicyRetriever(chunks=chunks)

    result = retriever.search("已支付订单能取消吗", top_k=1)

    assert result[0]["chunk_id"] == "cancel"


def test_policy_loader_skips_markdown_document_title_as_a_fake_chunk():
    chunks = load_policy_chunks()

    assert chunks
    assert all(chunk.text and chunk.title != "电商客服业务规则" for chunk in chunks)


def test_graph_returns_policy_citation_without_model():
    chunks = [PolicyChunk("refund-basic", "退款条件", "policies.md", "已支付订单可以申请退款，需商家审核。")]
    workflow = CommerceSupportAgent(retriever=PolicyRetriever(chunks=chunks), llm=None)

    result = workflow.invoke("已支付订单可以退款吗")

    assert result["intent"] == "refund"
    assert result["citations"][0]["chunk_id"] == "refund-basic"
    assert "[refund-basic]" in result["answer"]
    assert [step["node"] for step in result["trace"]] == [
        "route", "select_tool", "retrieve_policy", "evidence_gate", "compose", "validate", "final_guard"
    ]


def test_graph_uses_verified_business_facts_for_fallback():
    workflow = CommerceSupportAgent(retriever=PolicyRetriever(chunks=[]), llm=None)
    result = workflow.invoke("查一下订单", business_context={
        "agentEvidence": {"facts": "订单 ORD1 当前状态为已发货。"}
    })

    assert result["answer"] == "订单 ORD1 当前状态为已发货。"


def test_graph_selects_and_validates_authorized_backend_tool_result():
    workflow = CommerceSupportAgent(retriever=PolicyRetriever(chunks=[]), llm=None)
    result = workflow.invoke("查一下订单", business_context={
        "agentEvidence": {
            "intent": "order_status",
            "toolStatus": "completed",
            "facts": "本人订单 ORD1 当前状态为已发货。",
            "customerReply": "订单已发货。",
        }
    })

    tool_step = next(step for step in result["trace"] if step["node"] == "select_tool")
    assert tool_step["detail"] == "order_status:completed"
    assert result["tool_result"]["facts"] == "本人订单 ORD1 当前状态为已发货。"


def test_business_tool_result_classifies_authorization_and_business_failures():
    from app.tools import consume_authorized_result

    denied = consume_authorized_result("order_status", {
        "toolStatus": "order_unavailable", "facts": "不得向模型提供订单数据。"
    })
    rejected = consume_authorized_result("refund_precheck", {
        "toolStatus": "completed", "refundPrecheck": "not_passed", "facts": "订单状态不支持退款。"
    })

    assert denied.status == "authorization_denied"
    assert rejected.status == "business_rejected"
    assert consume_authorized_result("order_status", {"toolStatus": "timeout"}).status == "timeout"
    assert consume_authorized_result("order_status", {"toolStatus": "rate_limited"}).status == "rate_limited"


def test_fallback_combines_order_facts_and_policy_evidence():
    chunks = [PolicyChunk("refund-basic", "退款条件", "policies.md", "退款申请需由商家审核。")]
    workflow = CommerceSupportAgent(retriever=PolicyRetriever(chunks=chunks), llm=None)

    result = workflow.invoke("退款需要审核吗", business_context={
        "agentEvidence": {"facts": "本人订单 ORD1 当前状态为已发货。"}
    })

    assert "本人订单 ORD1" in result["answer"]
    assert "商家审核" in result["answer"]
    assert "[refund-basic]" in result["answer"]


def test_http_endpoint_returns_workflow_trace():
    client = TestClient(app)
    response = client.post("/v1/agent/chat", json={"message": "已支付订单退款条件"})

    assert response.status_code == 200
    assert response.json()["intent"] == "refund"
    assert response.json()["trace"][-1]["node"] == "final_guard"


def test_http_planner_returns_only_a_read_only_tool_name():
    client = TestClient(app)
    response = client.post("/v1/agent/plan", json={"message": "查一下我的订单物流"})

    assert response.status_code == 200
    assert response.json()["tool_name"] == "order_status"
    assert response.json()["tool_name"] not in {"refund_apply", "order_cancel"}
    assert response.json()["tool_arguments"]["order_no"] is None


def test_retriever_does_not_return_bm25plus_delta_matches_for_unrelated_query():
    retriever = PolicyRetriever(chunks=[
        PolicyChunk("refund", "退款申请", "policies.md", "已支付订单可以申请退款。"),
    ])

    assert retriever.search("完全无关的火星天气") == []


def test_compound_question_fuses_independent_policy_evidence():
    chunks = [
        PolicyChunk("refund", "退款条件", "policies.md", "已支付订单可以申请退款。"),
        PolicyChunk("delivery", "物流查询", "policies.md", "订单发货后可以查看快递轨迹。"),
    ]
    workflow = CommerceSupportAgent(retriever=PolicyRetriever(chunks=chunks), llm=None)

    result = workflow.invoke("已支付订单可以退款吗？另外，发货后能查物流吗")

    assert {item["chunk_id"] for item in result["evidence"]} == {"refund", "delivery"}
    assert any(item["node"] == "retrieve_policy" and "rrf" in item["detail"] for item in result["trace"])


def test_grounding_failure_retries_once_then_final_guard_blocks_claim():
    class FakeLLM:
        def __init__(self):
            self.verifications = 0

        def with_structured_output(self, schema, **kwargs):
            self.schema = schema
            return self

        def invoke(self, prompt):
            if self.schema is RouteDecision:
                return RouteDecision(intent="refund", needs_policy=True,
                                     policy_query="退款", sub_queries=["退款"])
            self.verifications += 1
            return GroundingVerdict(grounded=False, unsupported_reason="缺少明确规则",
                                    repair_query="退款审核条件")

        def __call__(self, prompt):
            return self.invoke(prompt)

    class ComposeLLM(FakeLLM):
        def with_structured_output(self, schema, **kwargs):
            parent = self

            class Structured:
                def invoke(self, prompt):
                    parent.schema = schema
                    return FakeLLM.invoke(parent, prompt)

            return Structured()

        def invoke(self, prompt):
            from types import SimpleNamespace
            return SimpleNamespace(content="退款一定会通过 [refund]")

    llm = ComposeLLM()
    workflow = CommerceSupportAgent(
        retriever=PolicyRetriever(chunks=[PolicyChunk("refund", "退款", "p.md", "退款申请需要审核。")]),
        llm=llm,
    )

    result = workflow.invoke("退款什么时候能通过")

    assert llm.verifications == 2
    assert sum(step["node"] == "repair_query" for step in result["trace"]) == 1
    assert result["trace"][-1]["detail"] == "unsupported_claims_removed"
    assert "不会猜测" in result["answer"]


def test_http_endpoint_requires_internal_token_when_configured(monkeypatch):
    from types import SimpleNamespace
    import app.main as main_module

    monkeypatch.setattr(main_module, "settings", SimpleNamespace(service_token="test-secret"))
    client = TestClient(app)
    payload = {"message": "查看我的订单"}

    assert client.post("/v1/agent/chat", json=payload).status_code == 401
    response = client.post("/v1/agent/chat", json=payload,
                           headers={"Authorization": "Bearer test-secret"})
    assert response.status_code == 200
