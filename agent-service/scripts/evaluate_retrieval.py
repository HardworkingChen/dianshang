import json
from pathlib import Path

from app.evaluation import evaluate_retrieval
from app.knowledge import PolicyRetriever


ROOT = Path(__file__).resolve().parents[1]
cases = json.loads((ROOT / "evaluation" / "retrieval_cases.json").read_text(encoding="utf-8"))
report = evaluate_retrieval(PolicyRetriever(), cases, k=4)
print(json.dumps(report, ensure_ascii=False, indent=2))
