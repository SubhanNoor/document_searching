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

## Milestone 2 — Ingestion & Chunking

**Goal:** Turn raw PDF/text files into structured, overlapping text chunks that
carry source metadata.

### Module 2.1 — `ingestion.py`

**Tasks:**
- `load_documents(folder: str) -> list[dict]`
  - Walk `folder`, detect `.pdf` vs `.txt` by extension
  - For `.pdf`: use `pypdf.PdfReader`, extract page text
  - For `.txt`: plain `open().read()`
  - Return list of `{"text": str, "source": filename}` dicts
- `chunk_text(doc: dict) -> list[dict]`
  - Split doc text into paragraphs (blank-line separated)
  - Merge consecutive paragraphs shorter than `PARAGRAPH_MIN` with the next
  - paragraph <= `PARAGRAPH_MAX` → keep as one chunk
  - paragraph > `PARAGRAPH_MAX` → split by sentence (`'. '`), group sentences up to `CHUNK_SIZE` chars; if a single sentence still exceeds `CHUNK_SIZE` → char-split with `CHUNK_OVERLAP`
  - Each output dict: `{"text": chunk_str, "source": doc["source"], "chunk_index": int}`
- `ingest_folder(folder: str) -> list[dict]`
  - Calls `load_documents` then `chunk_text` for every doc; returns flat chunk list

**Module description:**
Handles all I/O and text splitting. No embeddings, no DB calls here. Overlap is
critical: without it a fact split across two chunks would be missed by retrieval.
The `chunk_index` field lets later modules reconstruct the order of chunks within
a document if needed. Must import `PARAGRAPH_MAX`, `PARAGRAPH_MIN`, `CHUNK_SIZE`, `CHUNK_OVERLAP`, `DOCUMENTS_DIR`
from `config.py`.

---

## Milestone 3 — Embedding

**Goal:** Provide a single, reusable embedding interface so the same model is
used for both indexing and querying (the only correct approach for cosine search).

### Module 3.1 — `embedding.py`

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

## Milestone 4 — Vector Store

**Goal:** Persist embeddings and metadata in ChromaDB so the index survives
between runs.

### Module 4.1 — `vector_store.py`

**Tasks:**
- `get_collection() -> chromadb.Collection`
  - Open (or create) a persistent `chromadb.PersistentClient(CHROMA_DIR)`
  - Return `client.get_or_create_collection(COLLECTION_NAME)`
- `add_chunks(chunks: list[dict]) -> None`
  - Build deterministic IDs: `f"{chunk['source']}__chunk{chunk['chunk_index']}"`
  - Embed all chunks via `embedding.embed()`
  - Call `collection.add(ids, embeddings, documents, metadatas)` in one batch
  - Idempotent: re-ingesting the same file does not create duplicates (same IDs)
- `chunk_count() -> int`
  - Returns `collection.count()`

**Module description:**
All ChromaDB interaction lives here. The deterministic ID scheme means running
`ingest` twice is safe — ChromaDB upserts on matching IDs. Metadata stores
`source` and `chunk_index` so retrieval results can be traced back to origin
files. Must import `CHROMA_DIR`, `COLLECTION_NAME` from `config.py` and
`embed` from `embedding.py`.

---

## Milestone 5 — Retrieval

**Goal:** Given a natural-language question, find the most relevant chunks
across all ingested documents.

### Module 5.1 — `retrieval.py`

**Tasks:**
- `retrieve(question: str, k: int = TOP_K) -> list[dict]`
  - Embed the question with `embedding.embed([question])[0]`
  - Call `collection.query(query_embeddings=[q_vec], n_results=k)`
  - Return list of `{"text": str, "source": str, "chunk_index": int, "distance": float}`

**Module description:**
Single function. ChromaDB queries the whole collection, so results naturally
span multiple documents — no per-document loop needed. Distance (lower = more
similar for L2; higher for cosine) is returned so the UI can optionally show
relevance scores. Imports `TOP_K` from `config.py`, `embed` from `embedding.py`,
and `get_collection` from `vector_store.py`.

---

## Milestone 6 — Citation

**Goal:** Inject source attribution into chunk text before the LLM reads it, so
the model copies tags rather than guessing them.

### Module 6.1 — `citation.py`

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

## Milestone 7 — Generation

**Goal:** Call the Claude API with a well-engineered prompt and return a single
cited answer.

### Module 7.1 — `generation.py`

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

## Milestone 8 — Pipeline Orchestration

**Goal:** Compose all modules into two simple public functions.

### Module 8.1 — `pipeline.py`

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

## Milestone 9 — CLI

**Goal:** Expose the pipeline as a usable command-line tool.

### Module 9.1 — `main.py`

**Tasks:**
- Parse `sys.argv[1]` for subcommand (`ingest` | `ask`)
- `ingest` subcommand: call `pipeline.ingest()`, print chunk count
- `ask` subcommand: require `sys.argv[2]` as question string, call `pipeline.ask()`,
  print result to stdout
- Print usage message for unknown subcommands

**Module description:**
Pure entry point. Uses only `sys.argv` and `print` — no argparse needed at this
scale. No business logic; all real work delegated to `pipeline.py`. Must be
runnable as `python main.py ingest` and `python main.py ask "question"`.

---

## Milestone 10 — Streamlit UI

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
