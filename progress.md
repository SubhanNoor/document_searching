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

## Up Next

**Milestone 2 — Ingestion & Chunking**
- Module 2.1: `ingestion.py`
  - `load_documents(folder)` — read PDFs and .txt files
  - `chunk_text(doc, chunk_size, overlap)` — paragraph-aware chunking strategy
  - `ingest_folder(folder)` — orchestrate load + chunk, return flat chunk list
