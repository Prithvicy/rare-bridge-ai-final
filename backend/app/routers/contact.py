from fastapi import APIRouter
from ..schemas import ContactRequest

router = APIRouter()

@router.post("")
def contact(req: ContactRequest):
    # In real mode: email/queue it, write audit log
    return {"ok": True}
