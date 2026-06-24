from config import TOP_K
from embedding import embed
from vector_store import get_collection


def retrieve(question: str, session_id: str, k: int = TOP_K) -> list[dict]:
    if not question.strip():
        raise ValueError("[retrieval] Question cannot be empty")

    try:
        q_vec = embed([question])[0]
    except RuntimeError:
        raise  # embedding already provides a clear message

    try:
        collection = get_collection()
        # Cap n_results to how many chunks this session actually has — ChromaDB crashes if
        # n_results exceeds the number of vectors that match the where filter.
        session_count = len(collection.get(where={"session_id": session_id}, include=[])["ids"])
        if session_count == 0:
            return []
        actual_k = min(k, session_count)
        # where filter scopes the search to this session — other users' chunks are never returned.
        results = collection.query(
            query_embeddings=[q_vec],
            n_results=actual_k,
            where={"session_id": session_id},
        )
    except RuntimeError:
        raise
    except Exception as e:
        raise RuntimeError(f"[retrieval] ChromaDB query failed for session '{session_id}': {e}") from e

    chunks = []
    for text, metadata, distance in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    ):
        chunks.append({
            "text": text,
            "source": metadata["source"],
            "chunk_index": metadata["chunk_index"],
            "distance": distance,
        })
    return chunks
