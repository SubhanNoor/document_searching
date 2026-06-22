# Plan: Multi-Document Research Summarizer (RAG + Citations)

## Goal

Ingest 10–20 PDFs/text files on one topic, let the user ask a question, retrieve
relevant chunks **across all documents**, and generate **one combined answer**
where each fact carries a `[Source: filename]` tag. The citation is baked into
each chunk's text *before* the LLM sees it, so the model copies tags rather than
guessing them.

## Constraints

- Build the pipeline **manually** with `sentence-transformers` + `chromadb` — **no LangChain**.
- Use the **Claude API only for the final generation step** (model `claude-opus-4-8`).
- Heavy WHY-comments throughout (this is a learning project).
- CLI first, then a Streamlit UI.

## File Structure

```
document_searching/
├── plan.md              # this file
├── requirements.txt     # deps
├── .env.example         # ANTHROPIC_API_KEY=...
├── config.py            # central knobs: CHUNK_SIZE, OVERLAP, TOP_K, model names, paths
├── documents/           # drop your PDFs / .txt files here
├── chroma_db/           # auto-created persistent vector store (gitignored)
├── ingestion.py         # load files from folder + chunk with overlap
├── embedding.py         # wrap sentence-transformers model
├── vector_store.py      # ChromaDB create/persist + add chunks with metadata
├── retrieval.py         # embed question, query top-k across ALL docs
├── citation.py          # tag each retrieved chunk: "[Source: doc3.pdf] <text>"
├── generation.py        # build prompt, call Claude API, return cited answer
├── pipeline.py          # orchestrates: ingest→embed→store, and ask()
├── main.py              # CLI: `python main.py ingest` / `python main.py ask "..."`
└── app.py               # Streamlit UI (upload, ask, view cited answer)
```

## Build Order (step by step)

1. **config.py** — tunable constants in one place (chunk size 1000, overlap 150,
   TOP_K 6, `EMBED_MODEL="all-MiniLM-L6-v2"`, `GEN_MODEL="claude-opus-4-8"`).
2. **ingestion.py** — `load_documents(folder)` + `chunk_text(...)`. Reads PDF
   (pypdf) / txt, returns `{"text", "source", "chunk_index"}` dicts. Overlap keeps
   boundary-straddling facts intact.
3. **embedding.py** — wrap `SentenceTransformer`; load model once, reuse. Same
   model used for indexing and querying (critical).
4. **vector_store.py** — persistent ChromaDB; store chunk text + vector +
   metadata (`source`, `chunk_index`); deterministic ids so re-ingest is idempotent.
5. **retrieval.py** — embed question, `collection.query(n_results=k)` over the
   whole collection so results span multiple documents.
6. **citation.py** — prepend `[Source: <filename>] ` to each retrieved chunk.
   The key trick: citation lives inside the text the LLM reads.
7. **generation.py** — system prompt tells Claude to write one combined answer,
   keep `[Source: ...]` tags next to facts, and say so if the answer isn't in the
   docs (no hallucination). Calls `client.messages.create(model="claude-opus-4-8")`.
8. **pipeline.py** — glue: `ingest()` and `ask(question)`.
9. **main.py** — CLI with `ingest` and `ask "<question>"` subcommands.
10. **app.py** — Streamlit: upload docs → ingest, ask question, show cited answer
    + expandable retrieved-chunks view.

## Dependencies

```
anthropic
sentence-transformers
chromadb
pypdf
streamlit
python-dotenv
```

## Verification (end-to-end)

1. Put 3–4 small `.txt`/PDF files in `documents/`.
2. `pip install -r requirements.txt`, set `ANTHROPIC_API_KEY` in `.env`.
3. `python main.py ingest` → prints chunk count, creates `chroma_db/`.
4. `python main.py ask "<question spanning two docs>"` → combined answer with a
   `[Source: filename]` tag on each fact.
5. Ask something NOT in the docs → answer admits it's not covered (no fake citation).
6. `streamlit run app.py` → upload, ask, see cited answer + retrieved chunks.
