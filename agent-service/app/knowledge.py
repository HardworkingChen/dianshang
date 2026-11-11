from dataclasses import dataclass
from pathlib import Path
import re
import math
import threading

from rank_bm25 import BM25Plus
from .config import settings


@dataclass(frozen=True)
class PolicyChunk:
    chunk_id: str
    title: str
    source: str
    text: str


def tokenize(text: str) -> list[str]:
    # Preserve Chinese character bigrams and Latin/numeric terms for BM25 matching.
    normalized = re.sub(r"\s+", "", text.lower())
    tokens = re.findall(r"[a-z0-9_]+|[\u4e00-\u9fff]", normalized)
    bigrams = [tokens[i] + tokens[i + 1] for i in range(len(tokens) - 1)
               if len(tokens[i]) == 1 and len(tokens[i + 1]) == 1]
    return tokens + bigrams


def meaningful_terms(text: str) -> set[str]:
    normalized = re.sub(r"\s+", "", text.lower())
    latin = set(re.findall(r"[a-z0-9_]+", normalized))
    chinese = re.findall(r"[\u4e00-\u9fff]{2}", normalized)
    return latin | set(chinese)


def load_policy_chunks(root: Path | None = None) -> list[PolicyChunk]:
    docs_root = root or Path(__file__).resolve().parents[1] / "knowledge_base"
    chunks: list[PolicyChunk] = []
    for path in sorted(docs_root.glob("*.md")):
        title = path.stem
        markdown = path.read_text(encoding="utf-8")
        markdown = re.sub(r"(?m)^#\s+[^\n]*\n", "", markdown, count=1)
        sections = re.split(r"(?m)^##\s+", markdown)
        for index, section in enumerate(sections):
            text = section.strip()
            if not text:
                continue
            first_line, _, body = text.partition("\n")
            section_title = first_line.strip("# ") or title
            content = body.strip()
            if content:
                chunks.append(PolicyChunk(
                    chunk_id=f"{path.stem}-{index}",
                    title=section_title,
                    source=path.name,
                    text=content,
                ))
    return chunks


class PolicyRetriever:
    def __init__(self, chunks: list[PolicyChunk] | None = None, embeddings=None):
        self.chunks = chunks or load_policy_chunks()
        self.index = BM25Plus([tokenize(chunk.title + " " + chunk.text) for chunk in self.chunks])
        self.embeddings = embeddings
        self.vectors = None
        self.vector_error = False
        self._vector_lock = threading.Lock()

    def search(self, query: str, top_k: int = 4) -> list[dict[str, str | float]]:
        if not query.strip() or not self.chunks:
            return []
        scores = self.index.get_scores(tokenize(query))
        query_terms = meaningful_terms(query)
        sparse = []
        for index, _ in sorted(enumerate(scores), key=lambda row: row[1], reverse=True):
            document_terms = meaningful_terms(self.chunks[index].title + " " + self.chunks[index].text)
            if scores[index] > 0 and query_terms.intersection(document_terms):
                sparse.append(index)
            if len(sparse) >= max(top_k * 3, top_k):
                break
        dense: list[int] = []
        if self.embeddings is not None and not self.vector_error:
            try:
                with self._vector_lock:
                    if self.vectors is None and not self.vector_error:
                        self.vectors = self.embeddings.embed_documents(
                            [chunk.title + "\n" + chunk.text for chunk in self.chunks]
                        )
                query_vector = self.embeddings.embed_query(query)
                dense_scores = [(index, self._cosine(query_vector, vector))
                                for index, vector in enumerate(self.vectors)]
                dense = [index for index, _ in sorted(dense_scores, key=lambda row: row[1], reverse=True)[:top_k * 3]]
            except Exception:
                dense = []
                self.vector_error = True

        # Reciprocal-rank fusion combines lexical precision with semantic recall.
        fused: dict[int, float] = {}
        for weight, ranking in ((settings.bm25_weight, sparse), (settings.vector_weight, dense)):
            for rank, index in enumerate(ranking, start=1):
                fused[index] = fused.get(index, 0.0) + weight / (settings.rrf_k + rank)
        if not dense:
            for rank, index in enumerate(sparse, start=1):
                fused[index] = 1.0 / (settings.rrf_k + rank)
        ranked = sorted(fused.items(), key=lambda row: row[1], reverse=True)
        return [
            {
                "chunk_id": self.chunks[index].chunk_id,
                "title": self.chunks[index].title,
                "source": self.chunks[index].source,
                "content": self.chunks[index].text,
                "score": float(score),
                "retrieval": "hybrid" if dense else "bm25",
            }
            for index, score in ranked[:top_k]
        ]

    @staticmethod
    def _cosine(left: list[float], right: list[float]) -> float:
        dot = sum(a * b for a, b in zip(left, right))
        left_norm = math.sqrt(sum(a * a for a in left))
        right_norm = math.sqrt(sum(b * b for b in right))
        return dot / (left_norm * right_norm) if left_norm and right_norm else 0.0
