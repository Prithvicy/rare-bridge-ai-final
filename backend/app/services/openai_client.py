from ..config import settings

class OpenAIClient:
    def __init__(self):
        self.enabled = bool(settings.OPENAI_API_KEY) and not settings.USE_MOCKS

    async def chat(self, messages: list[dict]) -> dict:
        if not self.enabled:
            last = messages[-1]["content"] if messages else ""
            return {"role":"assistant","content":f'(Mock) Answer to: "{last}"',
                    "citations":[{"id":"d1","title":"Understanding PKU"}]}
        # TODO: real OpenAI call here
        return {"role":"assistant","content":"(Real) Answer","citations":[]}

    async def recipes(self, tags: list[str] | None) -> list[dict]:
        if not self.enabled:
            return [{"id":"r1","title":"Low-Protein Pancakes","tags":["breakfast"]}]
        # TODO: real LLM function
        return []

    async def embed(self, text: str) -> list[float]:
        if not self.enabled:
            return [0.0]*1536
        # TODO: real embedding call
        return [0.1]*1536
