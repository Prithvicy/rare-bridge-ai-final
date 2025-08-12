from fastapi import APIRouter, WebSocket

router = APIRouter()

@router.websocket("/ws/voice")
async def ws_voice(ws: WebSocket):
    await ws.accept()
    await ws.send_text("(Mock) Listening… say something (send any text).")
    try:
        while True:
            msg = await ws.receive_text()
            await ws.send_text(f"(Mock ASR) You said: {msg}")
            await ws.send_text("(Mock TTS) [audio playback]")
    except Exception:
        await ws.close()
