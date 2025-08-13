from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .routers import auth, chat, search, one_sheet, recipes, contact, docs, voice, knowledge

app = FastAPI(title="Rare Bridge AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status":"ok","mocks":settings.USE_MOCKS}

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(chat.router, prefix="/chat", tags=["chat"])
app.include_router(search.router, prefix="/search", tags=["search"])
app.include_router(one_sheet.router, prefix="/one-sheet", tags=["one-sheet"])
app.include_router(recipes.router, prefix="/recipes", tags=["recipes"])
app.include_router(contact.router, prefix="/contact", tags=["contact"])
app.include_router(docs.router, prefix="/docs", tags=["docs"])
app.include_router(knowledge.router, prefix="/knowledge", tags=["knowledge"])
# WebSocket lives at /ws/voice
app.include_router(voice.router, tags=["voice"])