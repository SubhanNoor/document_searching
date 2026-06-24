"""
Quick smoke test for Milestones 1-5.
Run: python test_pipeline.py
Cleans up after itself (removes test .txt and chroma_db/).
"""
import os
import shutil
from ingestion import ingest
from vector_store import add_chunks, chunk_count, delete_session
from retrieval import retrieve

SESSION_ID = "test-session-001"
TEST_FILE = "documents/test_doc.txt"
TEST_CONTENT = """
Artificial Intelligence in Healthcare

Artificial intelligence is transforming modern healthcare in profound ways.
Machine learning models can now detect cancer from medical images with accuracy
that rivals experienced radiologists.

Natural Language Processing

Natural language processing allows computers to understand and generate human
language. It powers chatbots, translation tools, and document summarization systems.

Climate Change and Renewable Energy

Renewable energy sources such as solar and wind power are becoming increasingly
cost-effective. Many countries are investing heavily in green infrastructure to
reduce carbon emissions and combat climate change.
"""

def run_test():
    print("\n--- Step 1: Creating test document ---")
    with open(TEST_FILE, "w", encoding="utf-8") as f:
        f.write(TEST_CONTENT)
    print(f"[OK] Created {TEST_FILE}")

    print("\n--- Step 2: Ingesting document ---")
    chunks = ingest(TEST_FILE, SESSION_ID)
    print(f"[OK] Got {len(chunks)} chunks")
    for i, c in enumerate(chunks):
        print(f"  Chunk {i}: {c['text'][:60]}...")

    print("\n--- Step 3: Storing chunks in ChromaDB ---")
    add_chunks(chunks)
    total = chunk_count()
    print(f"[OK] ChromaDB now has {total} chunk(s)")

    print("\n--- Step 4: Retrieving chunks for a question ---")
    question = "How is AI used in healthcare?"
    results = retrieve(question, SESSION_ID, k=2)
    print(f"[OK] Got {len(results)} result(s) for: '{question}'")
    for i, r in enumerate(results):
        print(f"\n  Result {i+1} (distance={r['distance']:.4f}) [{r['source']}]:")
        print(f"  {r['text'][:150]}...")

    print("\n--- Step 5: Cleanup ---")
    delete_session(SESSION_ID)
    os.remove(TEST_FILE)
    if os.path.exists("chroma_db"):
        shutil.rmtree("chroma_db")
    print("[OK] Cleaned up test file and chroma_db/")

    print("\n✓ All steps passed!\n")

if __name__ == "__main__":
    run_test()
