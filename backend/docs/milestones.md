# Milestones — Multi-Document Research Summarizer

Each milestone groups related modules. Complete every module in a milestone
before moving to the next. Each module is one `.py` file.

---

## Milestone 1 — Foundation ✅ COMPLETE

**Goal:** Lay the project skeleton so every later module has stable constants
and a known folder structure to reference.

### Module 1.1 — `config.py` ✅ DONE

**Tasks:**
- Define `PARAGRAPH_MAX = 3000` — paragraphs at or below this are kept as one chunk
- Define `PARAGRAPH_MIN = 100` — paragraphs below this are merged with the next
- Define `CHUNK_SIZE = 1000` — target size when grouping sentences or doing char-level split
- Define `CHUNK_OVERLAP = 150` — overlap used only when a single sentence exceeds `CHUNK_SIZE`
- Define `TOP_K = 6`
- Define `EMBED_MODEL = "all-MiniLM-L6-v2"`
- Define `GEN_MODEL = "claude-opus-4-5"` (update tomorrow if needed)
- Define `DOCUMENTS_DIR = "documents/"`
- Define `CHROMA_DIR = "chroma_db/"`
- Define `COLLECTION_NAME = "docs"`

**Chunking strategy (decided during M1, implemented in M2):**
```
For each paragraph:
  - paragraph <= 3000 chars  → keep as one chunk
  - paragraph > 3000 chars   → split by sentence ('. ')
                               group sentences up to ~1000 chars per chunk
                               if a single sentence > 1000 chars → char-split with 1000/150 overlap
  - paragraph < 100 chars    → merge with next paragraph
```

**Module description:**
A single file of named constants. No functions, no classes. All other modules
import from here so that changing a number in one place propagates everywhere.
WHY-comments must explain why each value was chosen (e.g., why 1000-char chunks,
why 150-char overlap). Written first because every subsequent module depends on it.

**Debugger result:** FAIL → PASS. Fixed `GEN_MODEL` from invalid `"claude-opus-4-8"` to `"claude-opus-4-5"`.

---

## Milestone 2 — Ingestion & Chunking ✅ COMPLETE

**Goal:** Turn raw PDF/text files into structured, overlapping text chunks that
carry source metadata.

### Module 2.0 — `converter.py` ✅ DONE

**Tasks:**
- `convert_to_txt(path: str) -> list[str]` — accepts file or folder, walks with `os.walk`, converts supported formats to `.txt`, returns list of ready `.txt` paths
- Whitelist: `.txt`, `.pdf`, `.docx`, `.md` — skips anything else with a warning
- `.doc` whitelisted for detection but skipped with warning (python-docx cannot read binary `.doc`)
- Idempotent: skips conversion if `.txt` already exists

**Debugger result:** PASS (after fix — `.doc` routed to warning+skip instead of python-docx)

### Module 2.1 — `ingestion.py` ✅ DONE

**Tasks:**
- `load_documents(path: str) -> list[dict]` — accepts file or folder, reads `.txt` files
- `chunk_text(doc: dict) -> list[dict]` — paragraph-aware chunking strategy
- `ingest(path: str) -> list[dict]` — calls `convert_to_txt`, reads returned `.txt` paths, chunks each doc, returns flat chunk list

**Chunking strategy:**
- Split text by blank lines into paragraphs
- Tiny paragraphs `< PARAGRAPH_MIN`: merged forward into the next paragraph; if leftover at end, attached to previous chunk (or kept alone if document had no other chunks)
- paragraph `<= PARAGRAPH_MAX` → one chunk
- paragraph `> PARAGRAPH_MAX` → sentence-split by `'. '`, group up to `CHUNK_SIZE`; oversized single sentences → `_split_by_overlap()` with `CHUNK_OVERLAP`
- `_split_by_overlap("")` returns `[]` immediately (infinite loop guard)

**Debugger result:** PASS (after 3 fixes — empty string guard, buffer merge direction, ingest using convert return value directly)

---

## Milestone 3 — Embedding ✅ COMPLETE

**Goal:** Provide a single, reusable embedding interface so the same model is
used for both indexing and querying (the only correct approach for cosine search).

### Module 3.1 — `embedding.py` ✅ DONE

**Tasks:**
- Load `SentenceTransformer(EMBED_MODEL)` once at module level (not per call)
- `embed(texts: list[str]) -> list[list[float]]`
  - Calls `model.encode(texts, convert_to_list=True)`
  - Works for a single question (list of one) and batch of chunks
- Export `EMBEDDING_DIM` constant (inferred from a dummy encode on import)

**Module description:**
Thin wrapper. The model is loaded once so cold-start cost is paid once per
process, not once per chunk. The same `embed()` function is called by
`vector_store.py` (for indexing) and `retrieval.py` (for the query). Using two
different models would silently break retrieval — this single file prevents that.

---

## Milestone 4 — Vector Store ✅ COMPLETE

**Goal:** Persist embeddings and metadata in ChromaDB so the index survives
between runs. Chunks are scoped to a session so multiple users never see each
other's documents.

### Module 4.1 — `vector_store.py` ✅ DONE

**Tasks:**
- `get_collection() -> chromadb.Collection`
  - Open (or create) a persistent `chromadb.PersistentClient(CHROMA_DIR)`
  - Return `client.get_or_create_collection(COLLECTION_NAME)`
- `add_chunks(chunks: list[dict]) -> None`
  - Build deterministic IDs: `f"{chunk['session_id']}__{chunk['document_id']}__chunk{chunk['chunk_index']}"`
  - Embed all chunks via `embedding.embed()`
  - Call `collection.add(ids, embeddings, documents, metadatas)` in one batch
  - Metadata stores `source`, `chunk_index`, `session_id`, `document_id`
  - Idempotent: re-ingesting the same file does not create duplicates (same IDs)
- `delete_session(session_id: str) -> None`
  - Query ChromaDB for all chunk IDs where metadata `session_id == session_id`
  - Delete them in one call — used by the cleanup task on session expiry
- `chunk_count() -> int`
  - Returns `collection.count()`

---

## Milestone 4.2 — Session Management ✅ COMPLETE

### Module 4.2 — `session_manager.py` ✅ DONE

**Tasks:**
- `touch(session_id: str) -> None`
  - Update the last-activity timestamp for a session (called on upload and on ask)
- `cleanup_expired() -> None`
  - Check every tracked session; if inactive > 15 min, delete uploaded files from
    disk and call `vector_store.delete_session(session_id)`
- `start_cleanup_loop() -> None`
  - Spawn a daemon thread that calls `cleanup_expired()` every 5 minutes

**Module description:**
Owns the session activity tracker (a dict of `session_id → last_seen datetime`).
Keeping this separate means `pipeline.py` and `app.py` only call `touch()` —
they never manage cleanup directly. The daemon thread dies automatically when the
main process exits.

---

## Milestone 4.3 — Update `ingestion.py` ✅ COMPLETE

**Change:** `ingest()` now accepts `session_id: str`. For each file it generates
a `document_id` (UUID4). Both are added to every chunk dict so downstream modules
can build correct IDs and filter by session.

---

## Milestone 5 — Retrieval ✅ COMPLETE

**Goal:** Given a natural-language question, find the most relevant chunks
scoped to the caller's session.

### Module 5.1 — `retrieval.py` ✅ DONE

**Tasks:**
- `retrieve(question: str, session_id: str, k: int = TOP_K) -> list[dict]`
  - Embed the question with `embedding.embed([question])[0]`
  - Call `collection.query(query_embeddings=[q_vec], n_results=k, where={"session_id": session_id})`
  - Return list of `{"text": str, "source": str, "chunk_index": int, "distance": float}`

**Module description:**
The `where` filter ensures one user's query never returns another user's chunks.
Distance is returned so the UI can optionally show relevance scores.

---

## Milestone 6 — Citation ✅ COMPLETE

**Goal:** Inject source attribution into chunk text before the LLM reads it, so
the model copies tags rather than guessing them.

### Module 6.1 — `citation.py` ✅ DONE

**Tasks:**
- `attach_citations(chunks: list[dict]) -> list[str]`
  - For each chunk: prepend `[Source: <chunk['source']>] ` to `chunk['text']`
  - Return plain list of tagged strings

**Module description:**
Intentionally tiny — one function, ~5 lines. The trick is that the citation is
baked into the context string the LLM receives, not added in post-processing.
This means the model sees `[Source: doc3.pdf] The boiling point of water is…`
and naturally echoes the tag in its answer without any special prompting beyond
"keep the tags".

---

## Milestone 7 — Generation ✅ COMPLETE

**Goal:** Call the LLM with a well-engineered prompt and return a single cited answer.

### Module 7.1 — `generation.py` ✅ DONE

**Tasks:**
- Load `ANTHROPIC_API_KEY` from `.env` via `python-dotenv`
- Instantiate `anthropic.Anthropic()` once at module level
- `generate_answer(question: str, cited_chunks: list[str]) -> str`
  - Build a system prompt: "You are a research assistant. Answer using only the
    provided sources. Keep [Source: …] tags next to each fact. If the answer is
    not in the sources, say so explicitly."
  - Build a user message: numbered list of chunks + the question
  - Call `client.messages.create(model=GEN_MODEL, max_tokens=1024, ...)`
  - Return `response.content[0].text`

**Module description:**
The only file that touches the Claude API. System prompt design matters: telling
the model to admit when it doesn't know prevents hallucination; telling it to
keep tags in-place ensures citations appear next to facts, not in a separate
references section. Imports `GEN_MODEL` from `config.py`. API key never leaves
this file — no other module needs it.

---

## Milestone 8 — Pipeline Orchestration ✅ COMPLETE

**Goal:** Compose all modules into two simple public functions.

### Module 8.1 — `pipeline.py` ✅ DONE

**Tasks:**
- `ingest(folder: str = DOCUMENTS_DIR) -> int`
  - Calls `ingestion.ingest_folder(folder)`
  - Calls `vector_store.add_chunks(chunks)`
  - Returns `vector_store.chunk_count()`
- `ask(question: str) -> str`
  - Calls `retrieval.retrieve(question)`
  - Calls `citation.attach_citations(chunks)`
  - Calls `generation.generate_answer(question, cited_chunks)`
  - Returns the final answer string

**Module description:**
Glue only — no logic of its own. Keeping orchestration separate from both the
CLI and the UI means `main.py` and `app.py` can evolve independently without
touching pipeline logic. Both public functions are the only API surface that
downstream consumers need to know about.

---

## Milestone 9 — Dev Test Script ✅ COMPLETE

**Goal:** A hardcoded test script to run ingest + ask end-to-end during development. Frontend (app.py) will handle real user uploads.

### Module 9.1 — `main.py` ✅ DONE

**Tasks:**
- Hardcode `FILE_PATH`, `QUESTION`, and `SESSION_ID` at the top
- Call `pipeline.ingest(FILE_PATH, SESSION_ID)`, print chunk count
- Call `pipeline.ask(QUESTION, SESSION_ID)`, print answer
- Wrap in `main()`, guard with `if __name__ == "__main__"`

**Module description:**
Dev/test harness only. No CLI argument parsing — the real entry point for users
will be `app.py` (Streamlit). Run from the project root with `python main.py`.

---

## Milestone 10 — Streamlit UI ⏭️ SKIPPED (build frontend separately)

**Goal:** Provide a graphical interface for non-CLI users.

### Module 10.1 — `app.py`

**Tasks:**
- File uploader widget → saves uploaded files to `DOCUMENTS_DIR`, triggers `pipeline.ingest()`
- Text input for question → calls `pipeline.ask()` on submit
- Display the answer in a styled text area
- Expander section showing the raw retrieved chunks (for transparency)
- Session state: re-use collection across reruns without re-ingesting

**Module description:**
Streamlit app wired entirely to `pipeline.py`. The expander showing raw chunks
is important for trust — users can verify which source passages drove the answer.
Session state prevents re-ingestion on every widget interaction. No pipeline
logic lives here; if something breaks, the fix goes in the relevant module, not
in `app.py`.

---

## End-to-End Verification Checklist

Run these after Milestone 10 is complete and passing:

- [ ] 3–4 small `.txt`/PDF files placed in `documents/`
- [ ] `pip install -r requirements.txt` succeeds
- [ ] `ANTHROPIC_API_KEY` set in `.env`
- [ ] `python main.py ingest` prints chunk count, creates `chroma_db/`
- [ ] `python main.py ask "question spanning two docs"` returns combined answer with `[Source: …]` tags
- [ ] Asking something NOT in the docs → answer admits it's not covered
- [ ] `streamlit run app.py` → upload, ask, cited answer + chunk expander work
