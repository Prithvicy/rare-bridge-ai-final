from fastapi import APIRouter
from ..schemas import ChatRequest, ChatResponse, ChatMessage, Citation
from ..services.openai_client import OpenAIClient

router = APIRouter()

@router.post("", response_model=ChatResponse)
async def chat(req: ChatRequest):
    client = OpenAIClient()
    r = await client.chat([m.model_dump() for m in req.messages])
    reply = ChatMessage(role="assistant", content=r["content"], citations=[Citation(**c) for c in r.get("citations",[])])
    return ChatResponse(reply=reply)
