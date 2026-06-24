def attach_citations(chunks: list[dict]) -> list[str]:
    if not chunks:
        raise ValueError("[citation] attach_citations() received an empty list — no chunks to cite")

    # Tag is baked into the text the LLM receives so it echoes it naturally in the answer.
    return [f"[Source: {chunk['source']}] {chunk['text']}" for chunk in chunks]
