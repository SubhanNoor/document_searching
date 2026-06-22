import os
from config import PARAGRAPH_MAX, PARAGRAPH_MIN, CHUNK_SIZE, CHUNK_OVERLAP
from converter import convert_to_txt


def load_documents(path: str) -> list[dict]:
    """
    Load all .txt files at path (single file or folder).
    Returns list of {"text": str, "source": filename} dicts.
    """
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
        with open(filepath, encoding="utf-8") as f:
            text = f.read()
        docs.append({"text": text, "source": os.path.basename(filepath)})
    return docs


def _split_by_overlap(text: str) -> list[str]:
    """Character-level split with CHUNK_OVERLAP for sentences that exceed CHUNK_SIZE."""
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
    """
    Split doc text into chunks using a paragraph-aware strategy:
      - paragraphs < PARAGRAPH_MIN  → merged with the next paragraph
      - paragraphs <= PARAGRAPH_MAX → kept as one chunk
      - paragraphs > PARAGRAPH_MAX  → sentence-split, grouped up to CHUNK_SIZE;
                                      sentences still > CHUNK_SIZE get char-split
    """
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
                    # Single sentence too large — flush current group first.
                    if group:
                        chunks.append(group.strip())
                        group = ""
                    # Then char-split the oversized sentence.
                    chunks.extend(_split_by_overlap(sentence))
                elif len(group) + len(sentence) + 2 > CHUNK_SIZE:
                    # Adding this sentence would overflow the group.
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


def ingest(path: str) -> list[dict]:
    """
    Full ingestion pipeline for a file or folder:
      1. Convert all supported formats to .txt
      2. Load the .txt files
      3. Chunk each document
    Returns a flat list of chunk dicts.
    """
    txt_paths = convert_to_txt(path)
    docs = []
    for filepath in txt_paths:
        with open(filepath, encoding="utf-8") as f:
            text = f.read()
        docs.append({"text": text, "source": os.path.basename(filepath)})
    all_chunks = []
    for doc in docs:
        all_chunks.extend(chunk_text(doc))
    print(f"[OK] Ingested {len(docs)} document(s) → {len(all_chunks)} chunks")
    return all_chunks
