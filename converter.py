import os
import shutil
import pypdf
import docx

# Only these extensions are trusted; anything else is skipped to avoid opening
# unknown or potentially malicious file types.
ALLOWED_EXTENSIONS = {".txt", ".pdf", ".doc", ".docx", ".md"}


def _collect_files(path: str) -> list[str]:
    """Return all file paths under path (file or folder)."""
    if os.path.isfile(path):
        return [path]
    collected = []
    for root, _, files in os.walk(path):
        for fname in files:
            collected.append(os.path.join(root, fname))
    return collected


def _pdf_to_txt(src: str, dest: str) -> None:
    reader = pypdf.PdfReader(src)
    # Concatenate all pages — one newline between pages preserves paragraph breaks.
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    with open(dest, "w", encoding="utf-8") as f:
        f.write(text)


def _docx_to_txt(src: str, dest: str) -> None:
    doc = docx.Document(src)
    # Each paragraph in a docx maps cleanly to a paragraph in plain text.
    text = "\n".join(p.text for p in doc.paragraphs)
    with open(dest, "w", encoding="utf-8") as f:
        f.write(text)


def _md_to_txt(src: str, dest: str) -> None:
    # Markdown is already plain text; copy as-is so downstream reads one format only.
    shutil.copy2(src, dest)


def convert_to_txt(path: str) -> list[str]:
    """
    Convert every supported file at path (file or folder) to .txt.
    Returns list of .txt file paths ready for reading.
    Skips files with disallowed extensions (logs a warning).
    Idempotent: skips conversion if .txt already exists.
    """
    files = _collect_files(path)
    ready = []

    for filepath in files:
        ext = os.path.splitext(filepath)[1].lower()

        if ext not in ALLOWED_EXTENSIONS:
            print(f"[WARN] Skipping unsupported file type: {filepath}")
            continue

        if ext == ".txt":
            ready.append(filepath)
            continue

        # Destination .txt sits next to the original file.
        txt_path = os.path.splitext(filepath)[0] + ".txt"

        if os.path.exists(txt_path):
            # Already converted on a previous run — no work needed.
            ready.append(txt_path)
            continue

        if ext == ".pdf":
            _pdf_to_txt(filepath, txt_path)
        elif ext == ".docx":
            _docx_to_txt(filepath, txt_path)
        elif ext == ".doc":
            print(f"[WARN] Legacy .doc format not supported, skipping: {filepath}")
            continue
        elif ext == ".md":
            _md_to_txt(filepath, txt_path)

        print(f"[OK] Converted: {os.path.basename(filepath)} → {os.path.basename(txt_path)}")
        ready.append(txt_path)

    return ready
