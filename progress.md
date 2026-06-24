# Progress — Multi-Document Research Summarizer

Tracks what has been completed, how each decision was made, and current state.

---

## Milestone 1 — Foundation ✅ COMPLETE

### Module 1.1 — `config.py` ✅ PASS

**Status:** Written, debugger passed (after one fix).

**What was built:**
All project-wide constants in a single file. No functions, no classes, no imports.

**Constants defined:**

| Constant | Value | Why |
|---|---|---|
| `PARAGRAPH_MAX` | `3000` | Paragraphs at or below this are kept as one chunk without splitting |
| `PARAGRAPH_MIN` | `100` | Paragraphs shorter than this are merged with the next to avoid tiny chunks |
| `CHUNK_SIZE` | `1000` | Target char size when grouping sentences or doing character-level overlap split |
| `CHUNK_OVERLAP` | `150` | ~15% of CHUNK_SIZE; used only when a single sentence exceeds CHUNK_SIZE |
| `TOP_K` | `6` | Chunks returned per query — enough cross-document coverage without bloating the prompt |
| `EMBED_MODEL` | `"all-MiniLM-L6-v2"` | Must be identical at index time and query time; different models break retrieval |
| `GEN_MODEL` | `"claude-opus-4-5"` | Claude model for generation; placeholder — to be confirmed/updated |
| `DOCUMENTS_DIR` | `"documents/"` | Drop zone for user PDFs and text files |
| `CHROMA_DIR` | `"chroma_db/"` | Persistent vector store; auto-created on first ingest; gitignored |
| `COLLECTION_NAME` | `"docs"` | Single ChromaDB collection holding all documents |

**Chunking strategy decided (applies to Milestone 2):**
```
For each paragraph:
  - paragraph <= 3000 chars  → keep as one chunk
  - paragraph > 3000 chars   → split by sentence ('. ')
                               group sentences up to ~1000 chars per chunk
                               if a single sentence > 1000 chars → char-split with 1000/150 overlap
  - paragraph < 100 chars    → merge with next paragraph
```

**Debugger findings:**
- FAIL on first run: `GEN_MODEL = "claude-opus-4-8"` is not a valid Anthropic model ID.
- Fix applied: changed to `"claude-opus-4-5"` (valid placeholder).
- All other checks passed: no syntax errors, no imports, all names UPPER_SNAKE_CASE,
  all logical relationships consistent (OVERLAP < CHUNK_SIZE, MIN < MAX).

---

## Setup & Scaffolding ✅ COMPLETE

### `CLAUDE.md`
Development rules for the project:
- One `.py` file per module (strict table mapping concerns to files)
- Pre-coding approval gate: every task/function in a module presented one by one, each requiring explicit approval before the next
- Post-coding debug gate: debugger subagent runs after every file write; PASS moves forward, FAIL requires user sign-off before any fix is applied
- WHY-comments required on every non-obvious block
- No unapproved dependencies

### `milestones.md`
Full build order broken into 10 milestones, each with modules and per-task descriptions.

### `.claude/hooks/pre-module.sh`
Fires before any `Write` tool call on a `.py` file. Prints the per-task approval
format, reminding Claude to walk through each function individually before writing.

### `.claude/hooks/post-module.sh`
Fires after any `.py` file is written. Prints the PASS/FAIL debug gate format,
reminding Claude to call the debugger subagent before moving on.

### `.claude/settings.json`
Wires both hooks to `PreToolUse` and `PostToolUse` events on the `Write` tool.

---

---

## Milestone 2 — Ingestion & Chunking ✅ COMPLETE

### Module 2.0 — `converter.py` ✅ PASS

**What was built:**
Converts any supported file (or all files in a folder) to `.txt` before ingestion.

**Key decisions:**
- Accepts a single file path or a folder — detected with `os.path.isfile`
- Whitelist: `.txt`, `.pdf`, `.docx`, `.md` — anything else gets a `[WARN]` and is skipped
- `.doc` is whitelisted for detection but skipped with a warning — `python-docx` only reads `.docx`
- Idempotent: if a `.txt` already exists next to the original, skips conversion
- Returns list of ready `.txt` paths so `ingest()` uses them directly without re-walking

**Debugger result:** PASS (after fix — `.doc` routed to warning+skip)

---

### Module 2.1 — `ingestion.py` ✅ PASS

**What was built:**
Reads `.txt` files and splits them into structured chunks with source metadata.

**Key decisions:**
- `ingest(path)` uses return value of `convert_to_txt()` directly — avoids re-walking and fixes single-file input for non-txt formats
- Paragraph-aware chunking: blank-line split → tiny para merge → size routing
- Tiny paragraph leftover at end: attached to `merged[-1]` (not a new standalone chunk); falls back to standalone only if document had no other paragraphs
- `_split_by_overlap("")` guard: returns `[]` immediately to prevent infinite loop
- Each chunk dict: `{"text": str, "source": filename, "chunk_index": int}`

**Debugger result:** PASS (after 3 fixes)

---

## Milestone 3 — Embedding ✅ COMPLETE

### Module 3.1 — `embedding.py` ✅ PASS

**What was built:**
Thin wrapper around SentenceTransformer that provides a single `embed()` function used by both indexing and querying.

**Key decisions:**
- `_model` loaded at module level — cold-start cost paid once per process, not per call
- `EMBEDDING_DIM` inferred at import time via a dummy encode — no hardcoded 384
- `convert_to_list=True` converts numpy arrays to plain Python lists for ChromaDB compatibility
- Same `embed()` function used for both chunk batches and single questions — model consistency guaranteed

**Debugger result:** PASS (no fixes needed)

---

## Milestone 4 — Vector Store & Session Management ✅ COMPLETE

### Module 4.1 — `vector_store.py` ✅ PASS

**What was built:**
All ChromaDB interaction — open/create collection, add chunks, delete by session, count chunks.

**Key decisions:**
- Three-part chunk ID: `session_id__document_id__chunk{i}` — prevents collisions across sessions and identical filenames
- Metadata stores `source`, `chunk_index`, `session_id`, `document_id` — enables session-scoped filtering at query time
- `add()` upserts on matching IDs — re-ingesting the same file is safe
- `delete_session()` uses `include=[]` to fetch only IDs (no embeddings/documents) for speed

**Debugger result:** PASS (no fixes needed, confirmed against chromadb 1.5.9)

---

### Module 4.2 — `session_manager.py` ✅ PASS

**What was built:**
In-memory session activity tracker with background cleanup thread.

**Key decisions:**
- `touch(session_id)` resets the inactivity countdown on every upload and question
- `cleanup_expired()` iterates a snapshot of `_sessions` so mid-loop deletion is safe
- TTL = 15 minutes, cleanup sweep every 5 minutes → data lives 15–20 min after last activity
- Daemon thread dies automatically with the main process — no shutdown logic needed
- GIL protects concurrent `touch()` / `cleanup_expired()` dict ops on CPython

**Debugger result:** PASS (no fixes needed)

---

### Module 4.3 — `ingestion.py` update ✅ PASS

**What changed:**
- `ingest()` now accepts `session_id: str`
- Generates `document_id = uuid4()` per file (not per chunk) — two users uploading the same filename never collide
- Both `session_id` and `document_id` attached to every chunk dict

**Debugger result:** PASS (no fixes needed)

---

## Milestone 5 — Retrieval ✅ COMPLETE

### Module 5.1 — `retrieval.py` ✅ PASS

**What was built:**
Single `retrieve()` function — embeds the question, queries ChromaDB filtered by `session_id`, returns top-k chunks with source and distance.

**Key decisions:**
- `where={"session_id": session_id}` scopes every query to the caller's session — cross-user leakage is impossible
- Returns `distance` so the UI can optionally show relevance scores
- Empty session (no chunks yet) returns `[]` cleanly — no exception

**Debugger result:** FAIL on `embedding.py` (not `retrieval.py`) — `convert_to_list=True` removed in sentence-transformers v5. Fixed: replaced with `.tolist()`. `retrieval.py` itself passed all checks.

---

## Milestone 6 — Citation ✅ COMPLETE

### Module 6.1 — `citation.py` ✅ PASS

**What was built:**
Single function that prepends `[Source: filename]` to each chunk's text before the LLM sees it.

**Key decisions:**
- Tag baked into the string the LLM receives — model echoes it naturally without special post-processing
- Returns `list[str]` not `list[dict]` — ready to drop straight into the generation prompt
- Empty list raises `ValueError` with a clear message

**Debugger result:** PASS (no fixes needed)

---

## Milestone 7 — Generation ✅ COMPLETE

### Module 7.1 — `generation.py` ✅ PASS

**What was built:**
Calls OpenRouter (OpenAI-compatible API) with a system prompt and numbered cited chunks, returns the model's answer string.

**Key decisions:**
- Uses `openai` SDK with `base_url=OPENROUTER_BASE_URL` — drop-in replacement, no custom HTTP
- `OPENROUTER_API_KEY` loaded from `.env` via `python-dotenv`; missing key raises `RuntimeError` at import time
- `client` created once at module level — connection pool reused across calls
- System prompt tells model to keep `[Source: …]` tags inline and admit when an answer isn't in the sources
- Chunks are numbered (1, 2, 3…) in the user message so the model can reference them precisely
- `response.choices[0].message.content` checked for `None` — model returning no text raises `RuntimeError`

**Debugger result:** FAIL → PASS. Fixed: added `None` check on `response.choices[0].message.content`.

---

## Milestone 8 — Pipeline Orchestration ✅ COMPLETE

### Module 8.1 — `pipeline.py` ✅ PASS

**What was built:**
Glue module with two public functions: `ingest()` and `ask()`. All logic lives in upstream modules.

**Key decisions:**
- `ingest()` returns `len(chunks)` (the list already in scope) — `chunk_count()` would return the global total, not the per-file count
- `ask()` returns a clean string `"No relevant sources found…"` when retrieval returns empty — avoids citation/generation failing on empty input
- Both functions catch `RuntimeError` and re-raise unchanged; any other exception is wrapped as `RuntimeError` with `[pipeline]` prefix
- `session_manager.touch()` called on both ingest and ask to reset the TTL

**Debugger result:** FAIL → PASS. Fixed two issues: (1) `chunk_count()` returning global total replaced with `len(chunks)`; (2) ChromaDB `n_results` cap added to `retrieval.py` — crashes if `n_results > session chunk count`.

---

## Milestone 9 — Dev Test Script ✅ COMPLETE

### Module 9.1 — `main.py` ✅ PASS

**What was built:**
Hardcoded dev/test script: ingests a file at a fixed path, asks a fixed question, prints the answer.

**Key decisions:**
- `FILE_PATH` is an absolute path set by the developer — relative paths work only if run from project root
- `SESSION_ID = "dev-session"` — fixed for single-developer use
- `RuntimeError` caught separately for ingest and ask so a failed ingest doesn't attempt an ask
- No `sys.argv` — real user-facing entry point will be `app.py` (Streamlit)

**Debugger result:** PASS (no fixes needed)

---

## Milestone 10 — Streamlit UI ⏭️ SKIPPED

User will build the frontend separately. The pipeline is fully functional and testable via `main.py`.

---

## Current State

**All backend modules complete.** Run `python main.py` from the project root to test end-to-end.
