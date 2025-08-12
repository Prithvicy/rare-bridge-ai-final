from fastapi import APIRouter
from ..schemas import RecipesRequest, RecipesResponse, Recipe
from ..services.openai_client import OpenAIClient

router = APIRouter()

@router.post("", response_model=RecipesResponse)
async def recipes(req: RecipesRequest):
  client = OpenAIClient()
  items = await client.recipes(req.tags or [])
  return RecipesResponse(items=[Recipe(**i) for i in items])
