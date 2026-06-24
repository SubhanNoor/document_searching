# CLAUDE.md — Development Rules for Multi-Document Research Summarizer

## Project Overview

A RAG pipeline that ingests PDFs/text files, retrieves relevant chunks, and
generates cited answers using the Claude API. Built manually — no LangChain.

---

## Golden Rules (non-negotiable)

### 1. One file per module — no fat files

Every logical concern lives in its own `.py` file. The mapping is strict:

| File | Sole responsibility |
|---|---|
| `config.py` | All tunable constants (chunk size, model names, paths) |
| `ingestion.py` | Load files from disk and chunk text |
| `embedding.py` | Wrap SentenceTransformer, expose `embed()` |
| `vector_store.py` | ChromaDB create / persist / add / get |
| `retrieval.py` | Embed question, query collection, return top-k chunks |
| `citation.py` | Prepend `[Source: filename]` tag to each chunk |
| `generation.py` | Build prompt, call Claude API, return answer |
| `pipeline.py` | Orchestrate: ingest→embed→store and ask() |
| `main.py` | CLI entry point (`ingest` / `ask`) |
| `app.py` | Streamlit UI |

Do not add business logic to `main.py` or `app.py`. Do not merge two concerns
into one file. If a new concern arises, create a new file.

### 2. Pre-coding approval gate (per task/function)

Before writing any module, go through every task and function listed for that
module in milestones.md **one by one** and get explicit approval for each.

Format for each task/function:

```
Task N: <function or task name>
Plan:
- <what it does>
- <key implementation decision>
- <inputs / outputs / side effects>
Approve this task? (yes / edit)
```

Wait for "yes" (or an edit instruction) before moving to the next task.
Only after ALL tasks in the module are approved should you write the file.
Do not bundle tasks into one approval question.

### 3. Post-coding debug gate

After writing a module, call the debugger subagent on that file. The subagent:
- Reads the file
- Checks for logic bugs, import errors, and contract violations
- Reports: PASS or FAIL with specific line-level findings

If PASS → move to the next module.
If FAIL → report the problem and proposed fix to the user before changing anything.
Format:

```
Problem: <what is wrong and on which line>
Expected fix: <proposed change>
Proceed with fix? (yes / edit)
```

Only apply the fix after the user confirms.

### 4. Exception handling (mandatory in every module)

Every function that touches I/O, external libraries, or network calls must wrap
its work in a `try/except` and raise a clear, human-readable error that names
the file, module, and what went wrong. Rules:

- Catch the **specific** exception (e.g. `FileNotFoundError`, `chromadb.errors.*`,
  `anthropic.APIError`) — never bare `except:` or `except Exception:` without re-raising.
- Always include the original error in the message: `f"...: {e}"`.
- Re-raise as `RuntimeError` with context so the caller (and the user) knows
  exactly which step failed without reading a raw traceback.
- stdlib functions that are guaranteed not to fail (e.g. `str.split`, `len`) do
  not need wrapping.

Example pattern:
```python
try:
    result = some_library.call()
except SomeSpecificError as e:
    raise RuntimeError(f"[module_name] Step failed for <context>: {e}") from e
```

### 5. Comment style

Every non-obvious block must have a WHY-comment (this is a learning project).
- Explain the reason, not the mechanics.
- No multi-paragraph docstrings.
- One short sentence per comment.

### 5. No hallucinated dependencies

Only import what is listed in `requirements.txt`. If a new dependency is needed,
ask first and add it to `requirements.txt` before writing the import.

### 6. Environment and secrets

- API keys come from `.env` via `python-dotenv`. Never hardcode.
- `.env` is gitignored. Use `.env.example` as the template.

---

## Hook Behaviour (automated, lives in `.claude/`)

Two hooks are active:

| Hook | Trigger | Action |
|---|---|---|
| `pre-module.sh` | Before writing a new `.py` file | Prints the approval prompt template |
| `post-module.sh` | After writing a `.py` file | Launches the debugger subagent on that file |

Hook files live in `.claude/hooks/`. They are called by the Claude Code harness
automatically — you do not need to invoke them manually.

---

## Build Order

Follow milestones.md exactly. Do not skip ahead or combine milestones.
