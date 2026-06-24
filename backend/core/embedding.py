from sentence_transformers import SentenceTransformer
from core.config import EMBED_MODEL

try:
    # Loaded once so every call to embed() reuses the same in-memory model.
    _model = SentenceTransformer(EMBED_MODEL)
except Exception as e:
    raise RuntimeError(f"[embedding] Failed to load model '{EMBED_MODEL}': {e}") from e

try:
    # Inferred at import time so vector_store.py never hardcodes 384.
    EMBEDDING_DIM = len(_model.encode([""])[0])
except Exception as e:
    raise RuntimeError(f"[embedding] Failed to infer embedding dimension: {e}") from e


def embed(texts: list[str]) -> list[list[float]]:
    if not texts:
        raise ValueError("[embedding] embed() received an empty list — nothing to encode")
    try:
        # .tolist() converts numpy ndarray to plain Python lists — convert_to_list was removed in v5.
        return _model.encode(texts).tolist()
    except Exception as e:
        raise RuntimeError(f"[embedding] Encoding failed for {len(texts)} text(s): {e}") from e
