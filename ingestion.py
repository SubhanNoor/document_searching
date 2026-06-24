import os
import uuid
from config import PARAGRAPH_MAX, PARAGRAPH_MIN, CHUNK_SIZE, CHUNK_OVERLAP
from converter import convert_to_txt


def load_documents(path: str) -> list[dict]:
    if os.path.isfile(path):
        txt_files = [path]
    else:
        txt_files = []
        for root, _, files in os.walk(path):
            for fname in files:
                if fname.lower().endswith(".txt"):
                    txt_files.append(os.path.join(root, fname))

    docs = []
    for filepath in txt_files:
        try:
            with open(filepath, encoding="utf-8") as f:
                text = f.read()
        except OSError as e:
            raise RuntimeError(f"[ingestion] Could not read file '{filepath}': {e}") from e
        docs.append({"text": text, "source": os.path.basename(filepath)})
    return docs


def _split_by_overlap(text: str) -> list[str]:
    # Guard against infinite loop — empty string produces no chunks.
    if not text:
        return []
    chunks = []
    start = 0
    while start < len(text):
        end = start + CHUNK_SIZE
        chunks.append(text[start:end])
        # Step back by CHUNK_OVERLAP so boundary facts are not cut off.
        start = end - CHUNK_OVERLAP
    return chunks


def chunk_text(doc: dict) -> list[dict]:
    raw_paragraphs = doc["text"].split("\n\n")

    # Merge tiny paragraphs (headings, stray lines) into the following paragraph.
    merged: list[str] = []
    buffer = ""
    for para in raw_paragraphs:
        para = para.strip()
        if not para:
            continue
        if len(para) < PARAGRAPH_MIN:
            buffer = (buffer + " " + para).strip()
        else:
            if buffer:
                merged.append((buffer + " " + para).strip())
                buffer = ""
            else:
                merged.append(para)
    if buffer:
        if merged:
            # Stick leftover scraps onto the end of the previous chunk.
            merged[-1] = (merged[-1] + " " + buffer).strip()
        else:
            # Whole document was tiny paragraphs — nothing to attach to, keep as-is.
            merged.append(buffer)

    chunks: list[str] = []
    for para in merged:
        if len(para) <= PARAGRAPH_MAX:
            # Small enough to stand alone as one chunk.
            chunks.append(para)
        else:
            # Split into sentences then regroup up to CHUNK_SIZE chars.
            sentences = para.split(". ")
            group = ""
            for sentence in sentences:
                sentence = sentence.strip()
                if not sentence:
                    continue
                if len(sentence) > CHUNK_SIZE:
                    if group:
                        chunks.append(group.strip())
                        group = ""
                    chunks.extend(_split_by_overlap(sentence))
                elif len(group) + len(sentence) + 2 > CHUNK_SIZE:
                    chunks.append(group.strip())
                    group = sentence + ". "
                else:
                    group += sentence + ". "
            if group.strip():
                chunks.append(group.strip())

    return [
        {"text": chunk, "source": doc["source"], "chunk_index": i}
        for i, chunk in enumerate(chunks)
        if chunk.strip()
    ]


def ingest(path: str, session_id: str) -> list[dict]:
    try:
        txt_paths = convert_to_txt(path)
    except RuntimeError:
        raise  # converter already provides a clear message — pass it up unchanged

    if not txt_paths:
        raise RuntimeError(f"[ingestion] No supported files found at '{path}'")

    docs = []
    for filepath in txt_paths:
        try:
            with open(filepath, encoding="utf-8") as f:
                text = f.read()
        except OSError as e:
            raise RuntimeError(f"[ingestion] Could not read file '{filepath}': {e}") from e
        # UUID per file so two users uploading the same filename never collide in ChromaDB.
        docs.append({
            "text": text,
            "source": os.path.basename(filepath),
            "document_id": str(uuid.uuid4()),
        })

    all_chunks = []
    for doc in docs:
        for chunk in chunk_text(doc):
            chunk["session_id"] = session_id
            chunk["document_id"] = doc["document_id"]
            all_chunks.append(chunk)

    print(f"[OK] Ingested {len(docs)} document(s) → {len(all_chunks)} chunks")
    return all_chunks
