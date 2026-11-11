from typing import Any

from .knowledge import PolicyRetriever


def evaluate_retrieval(retriever: PolicyRetriever, cases: list[dict[str, Any]], k: int = 4) -> dict[str, Any]:
    if not cases:
        raise ValueError("evaluation set must not be empty")
    reciprocal_ranks: list[float] = []
    hit_count = 0
    per_case: list[dict[str, Any]] = []
    for case in cases:
        expected = set(case["relevant_chunk_ids"])
        ranked = retriever.search(case["query"], top_k=k)
        ranked_ids = [row["chunk_id"] for row in ranked]
        hit_rank = next((rank for rank, chunk_id in enumerate(ranked_ids, 1) if chunk_id in expected), None)
        hit = hit_rank is not None
        hit_count += int(hit)
        reciprocal_ranks.append(1.0 / hit_rank if hit_rank else 0.0)
        per_case.append({
            "id": case["id"],
            "hit_at_k": hit,
            "reciprocal_rank": reciprocal_ranks[-1],
            "expected": sorted(expected),
            "retrieved": ranked_ids,
        })
    total = len(cases)
    return {
        "cases": total,
        f"recall_at_{k}": hit_count / total,
        "mrr": sum(reciprocal_ranks) / total,
        "per_case": per_case,
    }
