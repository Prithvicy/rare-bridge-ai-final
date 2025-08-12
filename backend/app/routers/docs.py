from fastapi import APIRouter, UploadFile, File, Form
from ..schemas import PagedDocs

router = APIRouter()

DOCS = [
    {"id":"d1","title":"PKU Basics","status":"approved"},
    {"id":"d2","title":"Clinic Visit Checklist","status":"approved"},
    {"id":"d3","title":"Pending Draft","status":"pending"},
]

@router.get("/search", response_model=PagedDocs)
def search(q: str = "", page: int = 1, perPage: int = 10):
    items = [d for d in DOCS if q.lower() in d["title"].lower()]
    return {"page": page, "perPage": perPage, "total": len(items), "items": items[:perPage]}

@router.post("/upload")
def upload(file: UploadFile = File(...), note: str = Form(default="")):
    DOCS.append({"id": file.filename, "title": file.filename, "status": "pending"})
    return {"id": file.filename, "status":"pending"}

@router.get("/pending")
def pending():
    return {"items":[d for d in DOCS if d["status"]=="pending"]}

@router.post("/{doc_id}/approve")
def approve(doc_id: str):
    for d in DOCS:
        if d["id"] == doc_id:
            d["status"] = "approved"
            return {"id": doc_id, "status":"approved"}
    return {"error":"not found"}

@router.post("/{doc_id}/reject")
def reject(doc_id: str):
    for d in DOCS:
        if d["id"] == doc_id:
            d["status"] = "rejected"
            return {"id": doc_id, "status":"rejected"}
    return {"error":"not found"}
