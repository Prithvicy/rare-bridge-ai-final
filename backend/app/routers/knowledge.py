from fastapi import APIRouter, HTTPException, Depends, Query
import logging
from typing import Optional, List
from ..schemas import (
    KnowledgeDocument, 
    KnowledgeSubmission, 
    KnowledgeSearchResponse,
    ModerateKnowledgeRequest
)
from ..config import settings
from supabase import create_client, Client
import uuid
from datetime import datetime

router = APIRouter()

def get_supabase() -> Client:
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

logger = logging.getLogger(__name__)

@router.post("/submit")
async def submit_document(submission: KnowledgeSubmission):
    """Submit a new document to the knowledge base"""
    try:
        supabase = get_supabase()
        
        if not submission.title or not submission.author_email:
            raise HTTPException(status_code=400, detail="title and author_email are required")

        # Prepare a new UUID here to avoid relying on DB gen_random_uuid() defaults
        new_id = str(uuid.uuid4())

        # Insert the document and return the new id
        insert_payload = {
            "id": new_id,
            "title": submission.title,
            "content": submission.content,
            "document_url": submission.document_url,
            "author_email": submission.author_email,
            "author_name": submission.author_name,
            "category": submission.category,
            "tags": submission.tags if (submission.tags and len(submission.tags) > 0) else None,
            "status": "pending"
        }

        # Remove nullish keys to avoid type casting issues (e.g., tags: None on TEXT[])
        insert_payload = {k: v for k, v in insert_payload.items() if v is not None}

        result = (
            supabase
            .table("knowledge_documents")
            .insert(insert_payload)
            .execute()
        )

        # On success, Supabase may return an array, an object, or empty, depending on preferences.
        # Treat any non-error response as success and return the UUID we generated.
        supa_error = getattr(result, "error", None)
        if supa_error:
            logger.error("Knowledge insert error: %s | payload=%s", supa_error, insert_payload)
            raise HTTPException(status_code=500, detail=str(supa_error))

        return {"success": True, "id": new_id, "message": "Document submitted for review"}
    except Exception as e:
        logger.exception("/knowledge/submit error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/search")
async def search_documents(
    q: str = Query(default=""),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=10, ge=1, le=50),
    category: Optional[str] = None
):
    """Search through approved knowledge base documents"""
    try:
        supabase = get_supabase()
        
        # Calculate offset
        offset = (page - 1) * per_page
        
        # Build query
        query = supabase.table("knowledge_documents").select("*").eq("status", "approved")
        
        # Add search filter if query provided
        if q:
            # PostgREST wildcard uses * in the URL syntax
            safe = q.replace(",", " ")
            query = query.or_(f"title.ilike.*{safe}*,content.ilike.*{safe}*")
        
        # Add category filter if provided
        if category:
            query = query.eq("category", category)
        
        # Order by created_at descending and apply pagination
        query = query.order("created_at", desc=True).range(offset, offset + per_page - 1)
        
        # Execute query
        result = query.execute()
        
        # Get total count (use count metadata instead of data length)
        count_query = supabase.table("knowledge_documents").select("id", count="exact").eq("status", "approved")
        if q:
            safe = q.replace(",", " ")
            count_query = count_query.or_(f"title.ilike.*{safe}*,content.ilike.*{safe}*")
        if category:
            count_query = count_query.eq("category", category)
        count_result = count_query.execute()
        
        total = count_result.count or 0
        
        return {
            "items": result.data,
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": (total + per_page - 1) // per_page
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/document/{doc_id}")
async def get_document(doc_id: str):
    """Get a single document by ID"""
    try:
        supabase = get_supabase()
        
        result = supabase.table("knowledge_documents").select("*").eq("id", doc_id).eq("status", "approved").single().execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Increment view count
        supabase.rpc("increment_view_count", {"doc_id": doc_id}).execute()
        
        return result.data
    except Exception as e:
        if "404" in str(e):
            raise HTTPException(status_code=404, detail="Document not found")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/pending")
async def get_pending_documents():
    """Get all pending documents (admin only)"""
    try:
        supabase = get_supabase()
        
        result = supabase.table("knowledge_documents").select("*").eq("status", "pending").order("created_at", desc=True).execute()
        
        return {"items": result.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/moderate/{doc_id}")
async def moderate_document(doc_id: str, request: ModerateKnowledgeRequest):
    """Approve or reject a document (admin only)"""
    try:
        supabase = get_supabase()
        
        update_data = {
            "status": request.action,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        if request.action == "approved":
            update_data["approved_at"] = datetime.utcnow().isoformat()
        
        result = supabase.table("knowledge_documents").update(update_data).eq("id", doc_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Document not found")
        
        return {"success": True, "message": f"Document {request.action}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/categories")
async def get_categories():
    """Get all unique categories"""
    try:
        supabase = get_supabase()
        
        result = supabase.table("knowledge_documents").select("category").eq("status", "approved").execute()
        
        categories = list(set([doc["category"] for doc in result.data if doc.get("category")]))
        
        return {"categories": sorted(categories)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/popular")
async def get_popular_documents(limit: int = Query(default=5, ge=1, le=20)):
    """Get most viewed documents"""
    try:
        supabase = get_supabase()
        
        result = supabase.table("knowledge_documents").select("*").eq("status", "approved").order("view_count", desc=True).limit(limit).execute()
        
        return {"items": result.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))