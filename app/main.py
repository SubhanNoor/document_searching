from rag import pipeline

# Hardcoded for dev testing — app.py will handle real user uploads via Streamlit.
FILE_PATH = "/home/subhan/All/Subhan/Subhan_noor_CV.pdf"
QUESTION = "What is Subhan Noor's educational background and work experience?"
SESSION_ID = "dev-session"


def main():
    print(f"Ingesting: {FILE_PATH}")
    try:
        count = pipeline.ingest(FILE_PATH, SESSION_ID)
        print(f"Ingested {count} chunks.")
    except RuntimeError as e:
        print(f"Ingest failed: {e}")
        return

    print(f"\nQuestion: {QUESTION}")
    try:
        answer = pipeline.ask(QUESTION, SESSION_ID)
        print(f"\nAnswer:\n{answer}")
    except RuntimeError as e:
        print(f"Ask failed: {e}")


if __name__ == "__main__":
    main()
