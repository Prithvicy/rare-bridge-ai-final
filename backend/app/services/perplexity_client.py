from ..config import settings

class PerplexityClient:
    def __init__(self):
        self.enabled = bool(settings.PERPLEXITY_API_KEY) and not settings.USE_MOCKS

    async def search(self, q: str):
        if not self.enabled:
            return {"summary": f'(Mock) Summary for "{q}"', "sources":[{"id":"s1","title":"Rare Disease Overview","url":"#"}]}
        # TODO: real Perplexity API call
        return {"summary":"(Real) Summary","sources":[]}
