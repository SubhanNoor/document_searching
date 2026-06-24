import os
import openai
from dotenv import load_dotenv
from config import GEN_MODEL, OPENROUTER_BASE_URL

load_dotenv()

_key = os.environ.get("OPENROUTER_API_KEY")
if not _key:
    raise RuntimeError("[generation] OPENROUTER_API_KEY not found in .env")

# Client created once at module level so the connection pool is reused across calls.
client = openai.OpenAI(api_key=_key, base_url=OPENROUTER_BASE_URL)

_SYSTEM_PROMPT = (
    "You are a research assistant. Answer using only the provided source passages. "
    "Every sentence that states a fact MUST end with the exact citation tag from that passage "
    "in the format [Source: <filename>]. "
    "Do NOT use footnotes, numbered references, brackets with numbers, or any other citation style — "
    "only inline [Source: <filename>] tags copied verbatim from the passages. "
    "If the answer cannot be found in the sources, say so explicitly — do not guess or infer."
)


def generate_answer(question: str, cited_chunks: list[str]) -> str:
    if not cited_chunks:
        raise ValueError("[generation] generate_answer() received no cited chunks — nothing to answer from")

    # Number each chunk so the model can refer to them and cite precisely.
    numbered = "\n".join(f"{i + 1}. {chunk}" for i, chunk in enumerate(cited_chunks))
    user_message = f"Source passages:\n{numbered}\n\nQuestion: {question}"

    try:
        response = client.chat.completions.create(
            model=GEN_MODEL,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            max_tokens=1024,
        )
    except openai.OpenAIError as e:
        raise RuntimeError(f"[generation] OpenRouter API call failed: {e}") from e

    text = response.choices[0].message.content
    if text is None:
        raise RuntimeError("[generation] Model returned no text content in response")
    return text
