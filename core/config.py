# --- Chunking strategy constants ---

# Paragraphs at or below this size are kept as a single chunk without splitting.
PARAGRAPH_MAX = 3000

# Paragraphs smaller than this are too short to stand alone; merge with next paragraph.
PARAGRAPH_MIN = 100

# Target chunk size (chars) when grouping sentences or doing character-level overlap split.
CHUNK_SIZE = 1000

# Overlap used only when a single sentence alone exceeds CHUNK_SIZE.
# ~15% of CHUNK_SIZE — enough to bridge facts that straddle a split boundary.
CHUNK_OVERLAP = 150

# --- Retrieval constant ---

# Number of chunks returned per query. 6 gives cross-document coverage
# without bloating the generation prompt.
TOP_K = 6

# --- Model names ---

# SentenceTransformer model used for BOTH indexing and querying.
# Critical: changing this after ingestion breaks retrieval because
# different models produce incompatible vector spaces.
EMBED_MODEL = "all-MiniLM-L6-v2"

# Model used for generation — routed through OpenRouter's OpenAI-compatible API.
GEN_MODEL = "openai/gpt-oss-120b:free"

# OpenRouter base URL — drop-in replacement for openai.OpenAI(base_url=...).
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

# --- Upload validation ---

# Maximum size for a single file (standalone or inside a zip), in bytes.
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

# Maximum combined/total upload size (whole zip, or all individual files), in bytes.
MAX_TOTAL_SIZE = 50 * 1024 * 1024  # 50 MB

# Maximum number of files allowed in one upload.
MAX_FILE_COUNT = 20

# If uncompressed_size / compressed_size exceeds this, treat as a zip bomb.
MAX_ZIP_RATIO = 20

# File types accepted for ingestion.
ALLOWED_EXTENSIONS = {".pdf", ".txt", ".docx"}

# --- Paths ---

# Folder where the user drops PDF / .txt source files.
DOCUMENTS_DIR = "documents/"

# Persistent ChromaDB directory (auto-created on first ingest, gitignored).
CHROMA_DIR = "chroma_db/"

# ChromaDB collection name. One collection holds all documents.
COLLECTION_NAME = "docs"
