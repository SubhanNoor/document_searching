# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # install dependencies
npm run dev        # dev server at http://localhost:3000
npm run build      # type-check + production build
npm run lint       # ESLint
npm run preview    # preview production build locally
```

## Architecture

This is a **React 19 + TypeScript + Vite** single-page app. All application logic lives in `src/App.tsx` — there is no router in use; `src/pages/Home.tsx` is an unused scaffold.

### State model (`App.tsx`)

All state is lifted to the root `App` component:

| State | Purpose |
|---|---|
| `documents` | List of `Document` objects — tracks upload/processing/indexed status per file |
| `messages` | Chat history (`ChatMessage[]`) — user + assistant turns |
| `sessionId` | String from backend `/upload` response — sent with every `/ask` request |
| `isProcessing` | True while files are being uploaded/ingested |
| `isGenerating` | True while waiting for an answer from `/ask` |

### Data flow

1. User drops files → `DocumentUpload` fires `onFilesSelected` → `App.handleFilesSelected` calls `POST /upload` → stores returned `session_id`
2. User types a question → `ChatInput` fires `onSubmit` → `App.handleSendMessage` calls `POST /ask` with `session_id` — user never sees or types the session ID
3. Assistant answer is streamed through `ChatMessage → StreamingText → useTypewriter` for the typewriter effect

### Key components

- **`DocumentUpload`** — drag-and-drop zone; accepts `.pdf`, `.docx`, `.txt` (also `.zip` for multiple files); passes raw `File[]` up to App
- **`ChatMessage`** — renders user bubbles and AI responses; AI responses use `useTypewriter` for streaming effect and `formatMarkdown` for bold/italic/code; sources are collapsible via `SourcesSection`
- **`ChatInput`** — disabled until at least one document is indexed
- **`DocumentList`** — renders upload progress bars and indexed status per file
- **`EmptyState`** — shown when no messages exist; renders suggestion chips

### Backend integration points

The frontend currently uses **simulated/demo responses** — `handleFilesSelected` fakes upload progress with `setInterval`, and `handleSendMessage` returns `DEMO_ANSWER` after a `setTimeout`. 

**Integration task:** Replace these two handlers in `App.tsx` with real `fetch` calls:
- `handleFilesSelected` → `POST /upload` (multipart, one file per request; send `session_id` if already set)
- `handleSendMessage` → `POST /ask` (JSON body `{ session_id, question }`)
- Add a "Clear session" button that calls `DELETE /session/{session_id}`

Backend runs at `http://localhost:8000` in dev. Configure `VITE_API_URL` in `.env` and use it as the base URL — do not hardcode the URL.

### Source type vs backend response

The `Source` type in `src/types/index.ts` has `page`, `section`, `excerpt`, and `relevance` fields. The backend's `/ask` endpoint returns a plain answer string with inline `[Source: filename]` tags — **not** a structured sources array. When integrating, parse the inline citations from the answer text to populate the `Source[]` array, or simplify the UI to display the raw answer string.

### Styling

- Tailwind CSS v3 with shadcn theme; all ui primitives are in `src/components/ui/`
- Import pattern: `import { Button } from '@/components/ui/button'`
- `@` resolves to `src/` (configured in `vite.config.ts`)
- Dark mode is toggled via `useTheme` hook — reads/writes `localStorage` and applies `dark` class to `<html>`

## Development rules (same as backend)

- Pre-coding approval gate: present each change/function plan and wait for explicit approval before writing
- Post-coding debug gate: run the debugger subagent after every file write; PASS moves forward, FAIL requires user sign-off before applying any fix
