# Python 客服 Agent

独立的 FastAPI 服务，为商城官方客服提供 LangGraph 工作流、结构化问题路由、受限只读工具规划、售后规则 RAG、BM25Plus/可选向量召回、RRF 融合及答复证据校验。Python 不直连业务数据库：它先输出只读工具计划，Spring Boot 按当前登录用户和会话上下文执行白名单工具，再把经授权的事实交回 Python 生成回复。退款/取消写操作不暴露为 Agent 工具。

## 工作流

`plan(route) -> Java read-only tool -> route -> select_tool -> retrieve_policy -> evidence_gate -> compose -> validate -> [repair once] -> final_guard`

- `POST /v1/agent/plan`：配置 LLM 时使用 Pydantic 结构化输出识别意图、拆分子问题并从只读工具白名单中选择工具；未配置/调用失败时采用规则路由。写操作名称不在工具白名单中。
- Java 工具执行：根据计划进入本人订单、商品、物流状态、退款记录或售后资格预检逻辑；订单归属和会话绑定由 Java 再次校验。规划服务不可用时保留 Java 关键词路由作为降级。
- `select_tool`：使用 Pydantic 校验 Java 返回的结构化工具结果，并区分缺少结果、资源不存在、权限拒绝和业务条件不满足；Python 只消费结果，不重新查库。
- `retrieve_policy`：对本地 `knowledge_base/` 使用 BM25 关键词召回；配置兼容 OpenAI 的 embedding API 后同时使用稠密向量召回，并以 RRF 融合排名。向量服务失败时降级到 BM25。
- `compose / validate`：将 Java 核验事实、对话历史及政策证据用于生成答复；检查引用 ID，并在配置模型时执行 grounding 校验。无依据时最多纠错检索一次，之后由 `final_guard` 安全兜底。
- 写操作确认：退款/取消只生成 Java 侧限时确认卡片；确认接口重新核验会话、用户、订单及操作状态，再调用既有退款/订单事务服务。消息请求去重、确认状态锁和重复确认返回由 Java 处理。

向量使用远程 embedding API，但文档向量只在进程内首次查询时构建，不依赖独立向量数据库。当前知识库是项目内维护的 Markdown 规则；正式使用前应由项目维护者对照实际业务规则确认内容。

## 本地启动

```powershell
cd agent-service
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:AGENT_SERVICE_TOKEN = "use-a-long-random-secret"
$env:AGENT_LLM_API_KEY = "your-provider-key"
uvicorn app.main:app --host 127.0.0.1 --port 8091
```

Spring Boot 配置：`AGENT_SERVICE_URL=http://localhost:8091`、`AGENT_SERVICE_TOKEN`。Agent 服务仅绑定 loopback；容器部署时通过私有网络访问，不要直接暴露公网。

## API

`POST /v1/agent/plan` 供 Java 服务在只读业务工具执行前规划。响应字段包括 `intent`、`tool_name`、`policy_query`、`sub_queries` 和 `missing_fields`。`tool_name` 仅允许只读能力。

`POST /v1/agent/chat`

```json
{
  "message": "已发货订单退款需要什么条件？",
  "history": [],
  "business_context": {
    "agentPlan": {"intent": "delivery_status", "tool_name": "order_status"},
    "agentEvidence": {"intent": "order_status", "toolStatus": "completed", "facts": "本人订单 ORD... 当前状态为已发货。"}
  }
}
```

请求需要 `Authorization: Bearer <AGENT_SERVICE_TOKEN>`（配置 token 后）。响应包含 `answer`、`intent`、`citations` 和工作流 `trace`。`GET /health` 返回存活状态及 LLM 配置状态，不返回密钥。

## 验证

```powershell
pytest -q
```

自动测试覆盖工具计划白名单、工具结果分类、LangGraph 节点链路、复合政策查询、引用校验和 HTTP 接口结构。真实 LLM 与 embedding 的在线效果需要配置服务商密钥及对应服务后验证。
