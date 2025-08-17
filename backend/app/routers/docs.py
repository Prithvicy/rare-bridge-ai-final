from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from ..schemas import PagedDocs, ChatRequest, ChatResponse, ChatMessage
from ..services.rag_service import rag_service
from ..services.openai_client import OpenAIClient
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

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
async def upload(file: UploadFile = File(...), note: str = Form(default="")):
    """Upload document and process with in-house RAG service"""
    try:
        # Validate file
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
        if file.size and file.size > 10 * 1024 * 1024:  # 10MB limit
            raise HTTPException(status_code=400, detail="File size must be less than 10MB")
        
        # Read file content
        logger.info(f"Processing document upload: {file.filename}")
        pdf_content = await file.read()
        
        # Process with RAG service
        document_id = rag_service.upload_document(file.filename, pdf_content)
        
        # Add to DOCS list for compatibility
        DOCS.append({
            "id": document_id, 
            "title": file.filename, 
            "status": "approved",  # Auto-approve RAG processed documents
            "note": note,
            "type": "rag_document"
        })
        
        # Get document info for response
        doc_info = rag_service.get_document_info(document_id)
        
        return {
            "id": document_id,
            "status": "approved",
            "filename": file.filename,
            "note": note,
            "chunks_count": doc_info["chunks_count"] if doc_info else 0,
            "total_pages": doc_info["total_pages"] if doc_info else 0,
            "message": "Document processed successfully with in-house RAG"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")

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

@router.post("/{doc_id}/chat")
async def chat_with_document(doc_id: str, req: ChatRequest):
    """Chat with a specific document using in-house RAG"""
    try:
        logger.info(f"Chat request for document {doc_id}")
        
        if not req.messages:
            raise HTTPException(status_code=400, detail="No messages provided")
        
        # Get the last user message
        last_message = req.messages[-1].content
        logger.info(f"Processing query: {last_message[:100]}...")
        
        # Search for relevant chunks in the document
        search_results = rag_service.search_documents(
            query=last_message,
            document_id=doc_id,
            top_k=3,
            min_similarity=0.01  # Lower threshold for better results
        )
        
        if not search_results:
            return {
                "reply": {
                    "role": "assistant",
                    "content": "I couldn't find relevant information in this document to answer your question. Please try rephrasing your question or ask about different topics covered in the document.",
                    "source": "rag_document",
                    "similarity_score": 0.0,
                    "citations": []
                }
            }
        
        # Build context from search results
        context_parts = []
        citations = []
        
        for result in search_results:
            context_parts.append(f"[Page {result.chunk.page_number}] {result.chunk.content}")
            
            # Add citation if not already present
            citation_id = f"{result.chunk.document_id}_p{result.chunk.page_number}"
            if not any(c["id"] == citation_id for c in citations):
                citations.append({
                    "id": citation_id,
                    "title": f"{result.source_metadata['filename']} - Page {result.chunk.page_number}",
                    "page_number": result.chunk.page_number,
                    "filename": result.source_metadata['filename']
                })
        
        context = "\n\n".join(context_parts)
        
        # Generate response using OpenAI for summarization only
        client = OpenAIClient()
        
        prompt = f"""Based on the following content from the uploaded document, please answer the user's question: "{last_message}"

Document Content:
{context}

Instructions:
- Provide a clear, helpful answer based on the document content
- Mention specific page numbers when referencing information
- If the context doesn't fully address the question, say so
- Respond in plain text without markdown formatting
- Be conversational and direct"""
        
        response = await client.chat([
            {"role": "system", "content": "You are a helpful assistant that answers questions based on document content. Always respond in plain text without markdown formatting."},
            {"role": "user", "content": prompt}
        ])
        
        return {
            "reply": {
                "role": "assistant",
                "content": response["content"],
                "source": "rag_document",
                "similarity_score": search_results[0].similarity_score,
                "citations": citations
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document chat error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process chat request: {str(e)}")

@router.get("/{doc_id}/info")
async def get_document_info(doc_id: str):
    """Get information about a processed document"""
    try:
        doc_info = rag_service.get_document_info(doc_id)
        if not doc_info:
            raise HTTPException(status_code=404, detail="Document not found")
        
        return doc_info
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting document info: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/rag/health")
async def rag_health_check():
    """Check RAG service health"""
    return rag_service.health_check()

@router.get("/rag/documents")
async def list_rag_documents():
    """List all documents processed by RAG service"""
    return {"documents": rag_service.list_documents()}
