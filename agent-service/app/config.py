import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    llm_base_url: str = os.getenv(
        "AGENT_LLM_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1"
    )
    llm_api_key: str = os.getenv("AGENT_LLM_API_KEY", os.getenv("AI_API_KEY", ""))
    llm_model: str = os.getenv("AGENT_LLM_MODEL", os.getenv("AI_MODEL", "qwen-plus"))
    service_token: str = os.getenv("AGENT_SERVICE_TOKEN", "")
    top_k: int = int(os.getenv("AGENT_RAG_TOP_K", "4"))
    embedding_model: str = os.getenv("AGENT_EMBEDDING_MODEL", "text-embedding-v3")
    vector_weight: float = float(os.getenv("AGENT_RAG_VECTOR_WEIGHT", "0.55"))
    bm25_weight: float = float(os.getenv("AGENT_RAG_BM25_WEIGHT", "0.45"))
    rrf_k: int = int(os.getenv("AGENT_RAG_RRF_K", "60"))
    max_history: int = int(os.getenv("AGENT_MAX_HISTORY", "12"))
    max_message_chars: int = int(os.getenv("AGENT_MAX_MESSAGE_CHARS", "2000"))


settings = Settings()
