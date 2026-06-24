import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")


def env_value(*names: str) -> str | None:
    for name in names:
        value = os.getenv(name)
        if value and value.strip():
            return value.strip()
    return None


api_key = env_value("OPENAI_API_KEY", "ASIMOV_API_KEY")
if not api_key:
    raise ValueError(
        "Missing API key. Set OPENAI_API_KEY or ASIMOV_API_KEY in apps/backend/.env "
        "or in your process environment."
    )

base_url = env_value("BASE_URL", "ASIMOV_BASE_URL")

client = OpenAI(
    api_key=api_key,
    base_url=base_url,
)

response = client.chat.completions.create(
    model="openai/gpt-4o",  # replace with your Asimov-supported model name
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Write a short introduction about GenAI."}
    ],
    temperature=0.7,
    max_tokens=200
)

print(response.choices[0].message.content)