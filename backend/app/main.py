import os
import shutil
import tempfile
import uuid

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from core.validator import validate_upload
from rag import pipeline
from store import vector_store

app = FastAPI(title="Document Search API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


class AskRequest(BaseModel):
    session_id: str
    question: str


@app.post("/upload")
async def upload(
    file: UploadFile = File(...),
    session_id: str = Form(default=""),
):
    # Reuse existing session or start a new one.
    sid = session_id.strip() if session_id.strip() else str(uuid.uuid4())

    tmp_dir = tempfile.mkdtemp()
    try:
        tmp_path = os.path.join(tmp_dir, file.filename)
        with open(tmp_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        try:
            valid_paths = validate_upload([tmp_path])
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except RuntimeError as e:
            raise HTTPException(status_code=500, detail=str(e))

        total_chunks = 0
        for path in valid_paths:
            try:
                total_chunks += pipeline.ingest(path, sid)
            except RuntimeError as e:
                # Roll back any chunks already indexed in this upload before failing.
                if total_chunks > 0:
                    vector_store.delete_session(sid)
                raise HTTPException(status_code=500, detail=str(e))

    finally:
        # Always clean up temp files — even if ingestion fails.
        shutil.rmtree(tmp_dir, ignore_errors=True)

    return {"session_id": sid, "chunks_indexed": total_chunks}


@app.post("/ask")
async def ask(body: AskRequest):
    if not body.session_id.strip():
        raise HTTPException(status_code=400, detail="session_id is required.")
    if not body.question.strip():
        raise HTTPException(status_code=400, detail="question cannot be empty.")

    try:
        answer = pipeline.ask(body.question, body.session_id)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"answer": answer}


@app.delete("/session/{session_id}")
async def clear_session(session_id: str):
    try:
        vector_store.delete_session(session_id)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"message": "Session cleared."}
