import chromadb
from core.config import CHROMA_DIR, COLLECTION_NAME
from core.embedding import embed


def get_collection() -> chromadb.Collection:
    try:
        # PersistentClient writes to disk so the index survives between process restarts.
        client = chromadb.PersistentClient(path=CHROMA_DIR)
        return client.get_or_create_collection(COLLECTION_NAME)
    except Exception as e:
        raise RuntimeError(f"[vector_store] Could not open ChromaDB at '{CHROMA_DIR}': {e}") from e


def add_chunks(chunks: list[dict]) -> None:
    if not chunks:
        raise ValueError("[vector_store] add_chunks() received an empty list — nothing to store")

    try:
        collection = get_collection()
        texts = [c["text"] for c in chunks]
        vectors = embed(texts)

        ids, embeddings, documents, metadatas = [], [], [], []
        for chunk, vector in zip(chunks, vectors):
            # Three-part ID prevents collisions across sessions and documents with identical filenames.
            chunk_id = f"{chunk['session_id']}__{chunk['document_id']}__chunk{chunk['chunk_index']}"
            ids.append(chunk_id)
            embeddings.append(vector)
            documents.append(chunk["text"])
            metadatas.append({
                "source": chunk["source"],
                "chunk_index": chunk["chunk_index"],
                "session_id": chunk["session_id"],
                "document_id": chunk["document_id"],
            })

        # add() upserts on matching IDs so re-ingesting the same file is safe.
        collection.add(ids=ids, embeddings=embeddings, documents=documents, metadatas=metadatas)
    except RuntimeError:
        raise  # already annotated — pass up unchanged
    except Exception as e:
        raise RuntimeError(f"[vector_store] Failed to add {len(chunks)} chunks: {e}") from e


def delete_session(session_id: str) -> None:
    try:
        collection = get_collection()
        # include=[] fetches only IDs — skips embeddings and documents for speed.
        result = collection.get(where={"session_id": session_id}, include=[])
        if result["ids"]:
            collection.delete(ids=result["ids"])
    except RuntimeError:
        raise
    except Exception as e:
        raise RuntimeError(f"[vector_store] Failed to delete session '{session_id}': {e}") from e


def chunk_count() -> int:
    try:
        return get_collection().count()
    except RuntimeError:
        raise
    except Exception as e:
        raise RuntimeError(f"[vector_store] Failed to get chunk count: {e}") from e
