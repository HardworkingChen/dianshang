from typing import Any, Literal

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from .config import settings
from .graph import CommerceSupportAgent, agent


class HistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=500)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=settings.max_message_chars)
    history: list[HistoryMessage] = Field(default_factory=list, max_length=settings.max_history)
    business_context: dict[str, Any] = Field(default_factory=dict)


class ChatResponse(BaseModel):
    answer: str
    intent: str
    citations: list[dict[str, str]]
    trace: list[dict[str, str]]


class PlanRequest(BaseModel):
    message: str = Field(min_length=1, max_length=settings.max_message_chars)
    business_context: dict[str, Any] = Field(default_factory=dict)


class PlanResponse(BaseModel):
    intent: str
    needs_policy: bool
    policy_query: str
    sub_queries: list[str]
    tool_name: str | None
    tool_arguments: dict[str, Any]
    missing_fields: list[str]
    planner_source: str


app = FastAPI(title="E-commerce Customer Support Agent", version="1.0.0")


@app.get("/health")
def health() -> dict[str, str | bool]:
    vector_enabled = bool(agent.retriever.embeddings) and not agent.retriever.vector_error
    return {
        "status": "ok",
        "llm_configured": bool(settings.llm_api_key),
        "rag": "bm25+vector-rrf" if vector_enabled else "bm25",
    }


@app.post("/v1/agent/chat", response_model=ChatResponse)
def chat(request: ChatRequest, authorization: str | None = Header(default=None)) -> ChatResponse:
    if settings.service_token and authorization != f"Bearer {settings.service_token}":
        raise HTTPException(status_code=401, detail="invalid agent service token")
    try:
        result = agent.invoke(
            request.message.strip(),
            history=[item.model_dump() for item in request.history],
            business_context=request.business_context,
        )
        return ChatResponse(
            answer=result.get("answer", ""),
            intent=result.get("intent", "general"),
            citations=result.get("citations", []),
            trace=result.get("trace", []),
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail="agent workflow failed") from exc


@app.post("/v1/agent/plan", response_model=PlanResponse)
def plan(request: PlanRequest, authorization: str | None = Header(default=None)) -> PlanResponse:
    if settings.service_token and authorization != f"Bearer {settings.service_token}":
        raise HTTPException(status_code=401, detail="invalid agent service token")
    try:
        return PlanResponse(**agent.plan(request.message.strip(), request.business_context))
    except Exception as exc:
        raise HTTPException(status_code=502, detail="agent planning failed") from exc
