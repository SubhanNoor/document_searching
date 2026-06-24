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

# --- Paths ---

# Folder where the user drops PDF / .txt source files.
DOCUMENTS_DIR = "documents/"

# Persistent ChromaDB directory (auto-created on first ingest, gitignored).
CHROMA_DIR = "chroma_db/"

# ChromaDB collection name. One collection holds all documents.
COLLECTION_NAME = "docs"
