import ingestion
import vector_store
import retrieval
import citation
import generation
import session_manager


def ingest(path: str, session_id: str) -> int:
    try:
        chunks = ingestion.ingest(path, session_id)
        vector_store.add_chunks(chunks)
        # Mark session active so the cleanup daemon resets the TTL countdown.
        session_manager.touch(session_id)
        # Return per-ingest count from the list already in scope — chunk_count() is global.
        return len(chunks)
    except RuntimeError:
        raise
    except Exception as e:
        raise RuntimeError(f"[pipeline] ingest failed for {path}: {e}") from e


def ask(question: str, session_id: str) -> str:
    try:
        session_manager.touch(session_id)
        chunks = retrieval.retrieve(question, session_id)

        # Return a clean message rather than letting citation/generation fail on empty input.
        if not chunks:
            return "No relevant sources found for your question."

        cited = citation.attach_citations(chunks)
        return generation.generate_answer(question, cited)
    except RuntimeError:
        raise
    except Exception as e:
        raise RuntimeError(f"[pipeline] ask failed: {e}") from e
