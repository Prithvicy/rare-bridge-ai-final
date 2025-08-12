from fastapi import APIRouter
from ..schemas import WebSearchRequest, WebSearchResponse, Citation
from ..services.perplexity_client import PerplexityClient

router = APIRouter()

@router.post("/web", response_model=WebSearchResponse)
async def web(req: WebSearchRequest):
    client = PerplexityClient()
    r = await client.search(req.q)
    return WebSearchResponse(summary=r["summary"], sources=[Citation(**s) for s in r["sources"]])
