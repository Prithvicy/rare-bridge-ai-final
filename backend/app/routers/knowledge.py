from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, Form
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
import PyPDF2
import io
import json

router = APIRouter()

def get_supabase() -> Client:
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    # Configure SSL options to handle certificate issues
    import ssl
    import certifi
    
    # Create client with proper SSL context
    client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    
    # Configure the underlying HTTP client to use proper certificates
    if hasattr(client.auth, '_client') and hasattr(client.auth._client, '_session'):
        import httpx
        # Update SSL verify to use certifi bundle
        client.auth._client._session.verify = certifi.where()
    
    return client

logger = logging.getLogger(__name__)

# Optional imports for embedding functionality - after logger is defined
try:
    from sentence_transformers import SentenceTransformer
    import numpy as np
    EMBEDDINGS_AVAILABLE = True
    logger.info("Embedding dependencies loaded successfully")
except ImportError as e:
    logger.warning(f"Embeddings functionality not available due to import error: {e}")
    SentenceTransformer = None
    np = None
    EMBEDDINGS_AVAILABLE = False

# Initialize embedding model (load once)
embedding_model = None

def get_embedding_model():
    global embedding_model
    if not EMBEDDINGS_AVAILABLE:
        return None
    if embedding_model is None:
        try:
            embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
            logger.info("Embedding model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            embedding_model = None
    return embedding_model

def extract_text_from_pdf(pdf_content: bytes) -> str:
    """Extract text content from PDF bytes"""
    try:
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_content))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        return text.strip()
    except Exception as e:
        logger.error(f"Error extracting text from PDF: {e}")
        raise HTTPException(status_code=400, detail="Failed to extract text from PDF")

def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
    """Split text into overlapping chunks for embedding"""
    if len(text) <= chunk_size:
        return [text]
    
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        
        # Find the last sentence boundary in the chunk
        if end < len(text):
            last_period = chunk.rfind('.')
            last_newline = chunk.rfind('\n')
            boundary = max(last_period, last_newline)
            if boundary > start + chunk_size // 2:  # Only split if boundary is reasonable
                end = start + boundary + 1
                chunk = text[start:end]
        
        chunks.append(chunk.strip())
        start = end - overlap
        
        if start >= len(text):
            break
    
    return chunks

def generate_embeddings(text_chunks: List[str]) -> List[List[float]]:
    """Generate embeddings for text chunks"""
    model = get_embedding_model()
    if not model:
        logger.warning("Embedding model not available, using dummy embeddings")
        # Return 1536-dimensional dummy embeddings to match your Supabase schema
        return [[0.0] * 1536 for _ in text_chunks]
    
    try:
        embeddings = model.encode(text_chunks)
        # Convert 384-dim to 1536-dim by padding with zeros
        padded_embeddings = []
        for embedding in embeddings:
            padded = embedding.tolist() + [0.0] * (1536 - len(embedding))
            padded_embeddings.append(padded)
        logger.info(f"Generated {len(padded_embeddings)} embeddings with {len(padded_embeddings[0])} dimensions")
        return padded_embeddings
    except Exception as e:
        logger.error(f"Error generating embeddings: {e}")
        # Fallback to 1536-dimensional dummy embeddings
        return [[0.0] * 1536 for _ in text_chunks]

async def store_document_and_embeddings(supabase: Client, document_data: dict, pdf_content: bytes = None) -> str:
    """Store document and generate embeddings if PDF content is provided"""
    
    # First, insert the document into knowledge_documents
    new_id = str(uuid.uuid4())
    document_data["id"] = new_id
    document_data["status"] = "pending"
    
    # Store the document first
    logger.info(f"Inserting into knowledge_documents table: {document_data}")
    result = supabase.table("knowledge_documents").insert(document_data).execute()
    
    if getattr(result, "error", None):
        logger.error("Knowledge insert error: %s | payload=%s", result.error, document_data)
        raise HTTPException(status_code=500, detail=str(result.error))
    
    # If PDF content is provided, process it
    if pdf_content:
        logger.info(f"Processing PDF content for document {new_id}, size: {len(pdf_content)} bytes")
        try:
            # Extract text from PDF
            extracted_text = extract_text_from_pdf(pdf_content)
            logger.info(f"Extracted {len(extracted_text)} characters from PDF")
            
            if extracted_text:
                # Update the document with extracted content (first 2000 chars as preview)
                update_data = {"content": extracted_text[:2000]}
                update_result = supabase.table("knowledge_documents").update(update_data).eq("id", new_id).execute()
                logger.info(f"Updated knowledge_documents with extracted text preview for document {new_id}")
                
                # Create document entry for embeddings
                # First, let's find the user profile ID from the email
                doc_id = str(uuid.uuid4())
                
                # Try to find the user profile by email
                profile_result = supabase.table("profiles").select("id").eq("email", document_data["author_email"]).execute()
                
                author_id = None
                if profile_result.data and len(profile_result.data) > 0:
                    author_id = profile_result.data[0]["id"]
                    logger.info(f"Found profile ID {author_id} for email {document_data['author_email']}")
                else:
                    logger.warning(f"No profile found for email {document_data['author_email']}, skipping documents table insertion")
                
                if author_id:
                    doc_insert_data = {
                        "id": doc_id,
                        "title": document_data["title"],
                        "slug": document_data["title"].lower().replace(" ", "-").replace("'", "")[:50],
                        "author": author_id,  # Reference to profiles table
                        "status": "pending",
                        "storage_path": f"pdf_uploads/{doc_id}.txt"  # Virtual path for extracted text
                    }
                else:
                    # Skip documents table insertion if no profile found
                    logger.warning("Skipping documents table insertion due to missing profile")
                    doc_insert_data = None
                
                if doc_insert_data:
                    doc_result = supabase.table("documents").insert(doc_insert_data).execute()
                    logger.info(f"Attempted to insert into documents table: {doc_insert_data['id']}")
                    
                    if getattr(doc_result, "error", None):
                        logger.error(f"Error inserting into documents table: {doc_result.error}")
                        # Continue without documents table entry
                        doc_id = None
                    else:
                        logger.info(f"Successfully inserted document {doc_id} into documents table")
                else:
                    logger.warning("Skipping documents table insertion")
                    doc_id = None
                
                # Generate embeddings even if documents table insertion failed
                # We'll use the knowledge_documents ID as reference instead
                chunks = chunk_text(extracted_text)
                logger.info(f"Created {len(chunks)} text chunks for processing")
                
                # Generate embeddings
                embeddings = generate_embeddings(chunks)
                
                # Store embeddings (use knowledge document ID if documents insertion failed)
                embedding_doc_id = doc_id if doc_id else new_id
                embedding_inserts = []
                for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                    embedding_inserts.append({
                        "id": str(uuid.uuid4()),
                        "document_id": embedding_doc_id,
                        "content": chunk,
                        "embedding": embedding,
                        "chunk_index": i
                    })
                
                if embedding_inserts:
                    logger.info(f"Attempting to insert {len(embedding_inserts)} embeddings for document {embedding_doc_id}")
                    embed_result = supabase.table("embeddings").insert(embedding_inserts).execute()
                    if getattr(embed_result, "error", None):
                        logger.error("Failed to insert embeddings: %s", embed_result.error)
                    else:
                        logger.info(f"Successfully stored {len(embedding_inserts)} embeddings for document {embedding_doc_id}")
                else:
                    logger.warning("No embeddings to insert")
                
        except Exception as e:
            logger.error(f"Error processing PDF for document {new_id}: {e}")
            # Don't fail the whole operation if embedding generation fails
    
    return new_id

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

@router.post("/submit-with-file")
async def submit_document_with_file(
    file: UploadFile = File(...),
    title: str = Form(...),
    author_email: str = Form(...),
    document_url: str = Form(...),  # Required document URL
    content: Optional[str] = Form(None),
    author_name: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    tags: Optional[str] = Form(None)
):
    """Submit a new document with PDF file upload"""
    try:
        # Validate file type
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are allowed")
        
        # Validate file size (10MB limit)
        if file.size and file.size > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size must be less than 10MB")
        
        # Read file content
        pdf_content = await file.read()
        
        # Parse tags if provided
        parsed_tags = None
        if tags:
            try:
                parsed_tags = json.loads(tags) if tags.startswith('[') else tags.split(',')
                parsed_tags = [tag.strip() for tag in parsed_tags if tag.strip()]
            except:
                # If JSON parsing fails, treat as comma-separated string
                parsed_tags = [tag.strip() for tag in tags.split(',') if tag.strip()]
        
        # Prepare document data
        document_data = {
            "title": title,
            "content": content,
            "document_url": document_url,  # Use the provided document URL
            "author_email": author_email,
            "author_name": author_name,
            "category": category,
            "tags": parsed_tags if parsed_tags else None
        }
        
        # Remove None values
        document_data = {k: v for k, v in document_data.items() if v is not None}
        
        # Store document and process PDF
        supabase = get_supabase()
        logger.info(f"Starting document storage process for title: {title}")
        new_id = await store_document_and_embeddings(supabase, document_data, pdf_content)
        
        return {"success": True, "id": new_id, "message": "Document and PDF submitted for review"}
        
    except Exception as e:
        logger.exception("/knowledge/submit-with-file error: %s", e)
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
        print("🔥 PENDING ENDPOINT CALLED - checking if backend logging works")
        supabase = get_supabase()
        
        result = supabase.table("knowledge_documents").select("*").eq("status", "pending").order("created_at", desc=True).execute()
        
        return {"items": result.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/moderate/{doc_id}")
async def moderate_document(doc_id: str, request: ModerateKnowledgeRequest):
    """Approve or reject a document (admin only)"""
    try:
        print(f"🔥 BACKEND MODERATION CALLED - DOC: {doc_id}, ACTION: {request.action}")
        print(f"🔥 ADMIN USER ID: {request.admin_user_id}")
        print(f"🔥 FULL REQUEST: {request}")
        
        logger.info(f"🔍 Backend moderation debug:")
        logger.info(f"  - Document ID: {doc_id}")
        logger.info(f"  - Request action: {request.action}")
        logger.info(f"  - Request admin_user_id: {request.admin_user_id}")
        logger.info(f"  - Request object: {request}")
        
        supabase = get_supabase()
        
        update_data = {
            "status": request.action,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        if request.action == "approved":
            update_data["approved_at"] = datetime.utcnow().isoformat()
            # Set the admin UUID who approved the document
            if request.admin_user_id:
                print(f"🔥 Setting approved_by to: {request.admin_user_id}")
                logger.info(f"  - Setting approved_by to: {request.admin_user_id}")
                update_data["approved_by"] = request.admin_user_id
            else:
                print(f"🔥 WARNING: admin_user_id is empty/None!")
                logger.warning(f"  - admin_user_id is empty/None, approved_by will be NULL")
            
            # Also approve related document in documents table if it exists
            try:
                doc_update = supabase.table("documents").update({"status": "approved"}).eq("author", doc_id).execute()
                if doc_update.data:
                    logger.info(f"  - Also approved related document entries for knowledge document {doc_id}")
            except Exception as e:
                logger.warning(f"  - Failed to update related documents table: {e}")
        
        print(f"🔥 Final update_data being sent to Supabase: {update_data}")
        logger.info(f"  - Final update_data: {update_data}")
        
        result = supabase.table("knowledge_documents").update(update_data).eq("id", doc_id).execute()
        
        print(f"🔥 Supabase update result: {result}")
        print(f"🔥 Supabase result data: {result.data}")
        print(f"🔥 Supabase result error: {getattr(result, 'error', 'No error attr')}")
        logger.info(f"  - Supabase update result: {result}")
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Document not found")
        
        return {"success": True, "message": f"Document {request.action}"}
    except Exception as e:
        logger.exception(f"Moderation error: {e}")
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