import os
from openai import OpenAI

client = OpenAI(
    api_key=os.environ["LGW_API_KEY"],
    base_url=os.getenv("LGW_BASE_URL", "http://localhost:3000/v1"),
)
response = client.chat.completions.create(
    model=os.getenv("LGW_MODEL", "gpt-4o-mini"),
    messages=[{"role": "user", "content": "Say hello in one short sentence."}],
)
print(response.choices[0].message.content)