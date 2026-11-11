# Python 客服 Agent

独立的 FastAPI 服务，为商城官方客服提供 LangGraph 工作流、结构化问题路由、受限只读工具规划、售后规则 RAG、BM25Plus/可选向量召回、RRF 融合及答复证据校验。Python 不直连业务数据库：它先输出只读工具计划，Spring Boot 按当前登录用户和会话上下文执行白名单工具，再把经授权的事实交回 Python 生成回复。退款/取消写操作不暴露为 Agent 工具。

## 工作流

`plan(route) -> Java read-only tool -> route -> select_tool -> retrieve_policy -> evidence_gate -> compose -> validate -> [repair once] -> final_guard`

- `POST /v1/agent/plan`：配置 LLM 时使用 Pydantic 结构化输出识别意图、拆分子问题并从只读工具白名单中选择工具；未配置/调用失败时采用规则路由。写操作名称不在工具白名单中。
- Java 工具执行：根据计划进入本人订单、商品、物流状态、退款记录或售后资格预检逻辑；订单归属和会话绑定由 Java 再次校验。规划服务不可用时保留 Java 关键词路由作为降级。
- `select_tool`：使用 Pydantic 校验 Java 返回的结构化工具结果，区分缺少结果、资源不存在、权限拒绝、业务条件不满足、超时及后端不可用；Python 只消费结果，不重新查库。
- `retrieve_policy`：拆分最多三个检索子问题并行召回，对本地 `knowledge_base/` 使用 BM25Plus；配置兼容 OpenAI 的 embedding API 后同时使用稠密向量召回，并以 RRF 融合排名。向量服务失败时降级到 BM25Plus。
- `compose / validate`：将 Java 核验事实、对话历史及政策证据用于生成答复；检查引用 ID，并在配置模型时执行 grounding 校验。无依据时最多纠错检索一次，之后由 `final_guard` 安全兜底。
- 写操作确认：退款/取消只生成 Java 侧限时确认卡片；确认接口重新核验会话、用户、订单及操作状态，再调用既有退款/订单事务服务。消息请求去重、确认状态锁和重复确认返回由 Java 处理。

向量使用远程 embedding API，但文档向量只在进程内首次查询时构建，不依赖独立向量数据库。当前知识库是项目内维护的 Markdown 规则；正式使用前应由项目维护者对照实际业务规则确认内容。

跨服务调用顺序、工具白名单和业务确认链路详见 [Agent 架构与业务流程](../docs/agent-architecture.md)。

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

`.env.example` 是配置模板，直接运行 uvicorn 不会自动加载 `.env`，需要向进程导出环境变量。Docker Compose 可以使用 `--env-file` 读取模板复制出的本地文件。容器与 Java 的连接方式见 [部署说明](../deploy/README.md#python-客服-agent)。

| 环境变量 | 用途 | 默认值 |
| --- | --- | --- |
| `AGENT_LLM_API_KEY` | 模型与 Embedding 服务密钥，也可回读 `AI_API_KEY` | 空，使用无模型路径 |
| `AGENT_LLM_BASE_URL` | 兼容 OpenAI 的模型 API 地址 | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `AGENT_LLM_MODEL` | 对话和结构化规划模型 | `qwen-plus` |
| `AGENT_EMBEDDING_MODEL` | 向量模型 | `text-embedding-v3` |
| `AGENT_SERVICE_TOKEN` | Java/Python 内部调用令牌，两端保持一致 | 空 |
| `AGENT_RAG_TOP_K` | 最终召回片段数 | `4` |
| `AGENT_RAG_BM25_WEIGHT` / `AGENT_RAG_VECTOR_WEIGHT` | 混合召回权重 | `0.45` / `0.55` |
| `AGENT_RAG_RRF_K` | RRF 排序平滑参数 | `60` |
| `AGENT_MAX_HISTORY` / `AGENT_MAX_MESSAGE_CHARS` | 历史条数与消息长度上限 | `12` / `2000` |

Java 的连接地址使用 `AGENT_SERVICE_URL`，不是模型供应商的 `AGENT_LLM_BASE_URL`。

## API

### 工具计划：`POST /v1/agent/plan`

供 Java 服务在只读业务工具执行前规划。请求包含 `message` 和可选 `business_context`。响应结构如下，示例用于说明字段：

```json
{
  "intent": "refund",
  "needs_policy": true,
  "policy_query": "已发货订单退款需要什么条件",
  "sub_queries": ["已发货订单退款需要什么条件"],
  "tool_name": "refund_precheck",
  "tool_arguments": {"order_no": "ORD123456789012345678", "product_id": null},
  "missing_fields": [],
  "planner_source": "llm_structured_output"
}
```

`tool_name` 仅允许只读能力；没有业务工具时使用 `null` 或内部的 `none` 标记。`missing_fields` 是规划提示；Java 会重新从原消息提取订单号，并以当前登录用户和会话绑定为准，不能依赖模型提供的参数跳过权限校验。

### 答复工作流：`POST /v1/agent/chat`

由 Java 完成授权业务查询后调用。`agentPlan` 可以省略；如果传入，应保留 `/plan` 返回的完整规划字段，避免缺字段导致回落到重新路由。

```json
{
  "message": "已发货订单退款需要什么条件？",
  "history": [],
  "business_context": {
    "agentPlan": {
      "intent": "refund",
      "needs_policy": true,
      "policy_query": "已发货订单退款需要什么条件",
      "sub_queries": ["已发货订单退款需要什么条件"],
      "tool_name": "refund_precheck",
      "tool_arguments": {"order_no": null, "product_id": null},
      "missing_fields": []
    },
    "agentEvidence": {
      "intent": "refund_precheck",
      "toolStatus": "completed",
      "orderNo": "ORD123456789012345678",
      "refundPrecheck": "passed",
      "facts": "本人订单当前状态为已发货，退款基础条件预检通过；不代表商家审核通过。"
    }
  }
}
```

请求需要 `Authorization: Bearer <AGENT_SERVICE_TOKEN>`（配置 token 后）。响应包含 `answer`、`intent`、`citations` 和工作流 `trace`。`GET /health` 返回存活状态及 LLM 配置状态，不返回密钥。

`agentEvidence` 是 Java 内部查询结果，不能由小程序客户端直接作为可信订单事实提交。对外消息入口仍为 Java 的 `/api/im/conversations/{id}/messages`。

## 验证

```powershell
pytest -q
```

自动测试覆盖工具计划白名单、工具结果分类、LangGraph 节点链路、复合政策查询、引用校验和 HTTP 接口结构。真实 LLM 与 embedding 的在线效果需要配置服务商密钥及对应服务后验证。

离线政策检索评估入口为 `python -m scripts.evaluate_retrieval`，样例位于 `evaluation/retrieval_cases.json`，用于检查 Top-K 命中和倒数排名。此脚本评估检索，不代表已实现在线工具选择评分、会话级成功率或端到端耗时看板。
