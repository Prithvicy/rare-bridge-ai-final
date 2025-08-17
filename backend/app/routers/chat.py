from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from typing import Optional, List
from ..schemas import ChatRequest, ChatResponse, ChatMessage, Citation
from ..services.openai_client import OpenAIClient
from ..config import settings
from supabase import create_client, Client
import logging
import uuid
import PyPDF2
import io

router = APIRouter()
logger = logging.getLogger(__name__)

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

# Optional imports for embedding functionality
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
        
        if end < len(text):
            last_period = chunk.rfind('.')
            last_newline = chunk.rfind('\n')
            boundary = max(last_period, last_newline)
            if boundary > start + chunk_size // 2:
                end = start + boundary + 1
                chunk = text[start:end]
        
        chunks.append(chunk.strip())
        start = end - overlap
        
        if start >= len(text):
            break
    
    return chunks

def generate_embeddings(text_chunks: List[str]) -> List[List[float]]:
    """Generate embeddings for text chunks using OpenAI (1536 dimensions)"""
    try:
        # Use OpenAI embeddings for consistency with database schema (1536 dimensions)
        from ..config import settings
        
        if not settings.OPENAI_API_KEY:
            logger.warning("OpenAI API key not available, using dummy embeddings")
            return [[0.0] * 1536 for _ in text_chunks]
        
        import openai
        openai.api_key = settings.OPENAI_API_KEY
        
        embeddings = []
        for chunk in text_chunks:
            try:
                # OpenAI embedding API call (legacy SDK format)
                response = openai.Embedding.create(
                    model="text-embedding-ada-002",
                    input=chunk
                )
                embedding = response['data'][0]['embedding']
                embeddings.append(embedding)
                logger.debug(f"Generated embedding with {len(embedding)} dimensions")
            except Exception as e:
                logger.warning(f"Failed to generate OpenAI embedding for chunk, using fallback: {e}")
                # Return 1536-dimensional dummy embedding to match OpenAI format
                embeddings.append([0.0] * 1536)
        
        logger.info(f"Generated {len(embeddings)} embeddings with {len(embeddings[0])} dimensions")
        return embeddings
        
    except Exception as e:
        logger.error(f"Error generating embeddings: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        # Return 1536-dimensional dummy embeddings as fallback to match database schema
        return [[0.0] * 1536 for _ in text_chunks]

def sanitize_markdown(content: str) -> str:
    """Remove markdown formatting from content to return plain text"""
    import re
    if not content:
        return content
    
    # Remove markdown headers (# ## ###)
    content = re.sub(r'^\s*#{1,6}\s+', '', content, flags=re.MULTILINE)
    
    # Remove bold and italic markers
    content = content.replace('**', '').replace('__', '')
    content = content.replace('*', '').replace('_', '')
    
    # Remove code blocks and inline code
    content = re.sub(r'```[\s\S]*?```', '', content)
    content = content.replace('`', '')
    
    # Remove links but keep text [text](url) -> text
    content = re.sub(r'\[([^\]]*)\]\([^\)]*\)', r'\1', content)
    
    # Clean up extra whitespace
    content = re.sub(r'\n\s*\n', '\n\n', content)
    content = content.strip()
    
    return content

def cosine_similarity(a: List[float], b: List[float]) -> float:
    """Calculate cosine similarity between two vectors"""
    if not EMBEDDINGS_AVAILABLE:
        return 0.8  # Mock similarity
    
    try:
        # Simple dot product similarity without numpy to avoid libgfortran issues
        if len(a) != len(b):
            return 0.7
        
        dot_product = sum(x * y for x, y in zip(a, b))
        norm_a = sum(x * x for x in a) ** 0.5
        norm_b = sum(x * x for x in b) ** 0.5
        
        if norm_a == 0 or norm_b == 0:
            return 0.0
            
        return dot_product / (norm_a * norm_b)
    except:
        return 0.7

async def text_search_fallback(query: str, document_ids: List[str], supabase) -> List[dict]:
    """Fallback to simple text search when embeddings are not available"""
    try:
        # Search in knowledge documents by title and content
        result = supabase.table("knowledge_documents").select("*").in_("id", document_ids).execute()
        
        if not result.data:
            return []
        
        # Simple text matching
        matches = []
        query_lower = query.lower()
        
        for doc in result.data:
            score = 0
            content = (doc.get("content", "") or "").lower()
            title = (doc.get("title", "") or "").lower()
            
            # Check for keyword matches
            query_words = query_lower.split()
            for word in query_words:
                if len(word) > 2:  # Skip very short words
                    if word in title:
                        score += 3  # Title matches are more important
                    if word in content:
                        score += 1
            
            if score > 0:
                # Create chunks from the document content
                content_text = doc.get("content", "") or ""
                chunks = chunk_text(content_text, 500, 100)  # Smaller chunks for text search
                
                for i, chunk in enumerate(chunks[:3]):  # Limit to first 3 chunks
                    matches.append({
                        "content": chunk,
                        "similarity": min(0.9, score / 10),  # Normalize score to similarity
                        "document_id": doc["id"],
                        "chunk_index": i,
                        "source_info": doc
                    })
        
        # Sort by similarity score
        matches.sort(key=lambda x: x["similarity"], reverse=True)
        logger.info(f"Text search found {len(matches)} matches for query: {query}")
        return matches[:5]
        
    except Exception as e:
        logger.error(f"Error in text search fallback: {e}")
        return []

async def search_similar_chunks(query: str, source: str = "knowledge_base", document_id: Optional[str] = None) -> List[dict]:
    """Search for similar text chunks using vector similarity"""
    try:
        supabase = get_supabase()
        
        # Generate query embedding using OpenAI for consistency
        query_embedding = generate_embeddings([query])[0]
        
        # Build query based on source
        if source == "knowledge_base":
            # For knowledge base, we need to find embeddings that belong to approved knowledge documents
            # First, get all approved knowledge documents
            kb_docs_result = supabase.table("knowledge_documents").select("id").eq("status", "approved").execute()
            if not kb_docs_result.data:
                logger.info("No approved knowledge documents found")
                return []
            
            # Get document IDs
            approved_doc_ids = [doc["id"] for doc in kb_docs_result.data]
            
            # Get embeddings for these documents
            result = supabase.table("embeddings").select("*").in_("document_id", approved_doc_ids).execute()
            
            # If no embeddings found, fallback to text search in knowledge_documents
            if not result.data:
                logger.info("No embeddings found, using text search fallback")
                return await text_search_fallback(query, approved_doc_ids, supabase)
        else:
            # Search in specific uploaded document
            result = supabase.table("embeddings").select("*").eq("document_id", document_id).execute()
        
        if not result.data:
            logger.info(f"No embeddings found for source: {source}, document_id: {document_id}")
            return []
        
        logger.info(f"Found {len(result.data)} embeddings to search through")
        
        # Calculate similarities and rank
        similarities = []
        for chunk in result.data:
            try:
                similarity = cosine_similarity(query_embedding, chunk["embedding"])
                similarities.append({
                    "content": chunk["content"],
                    "similarity": similarity,
                    "document_id": chunk["document_id"],
                    "chunk_index": chunk["chunk_index"],
                    "source_info": chunk
                })
            except Exception as e:
                logger.warning(f"Error calculating similarity for chunk {chunk.get('id', 'unknown')}: {e}")
                continue
        
        # Sort by similarity and return top results
        similarities.sort(key=lambda x: x["similarity"], reverse=True)
        logger.info(f"Top similarity scores: {[s['similarity'] for s in similarities[:3]]}")
        return similarities[:5]  # Top 5 most similar chunks
        
    except Exception as e:
        logger.error(f"Error searching similar chunks: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return []

@router.get("/test")
async def test_chat_setup():
    """Test endpoint to check if chat setup is working"""
    try:
        # Test embedding model
        embedding_available = get_embedding_model() is not None
        
        # Test supabase connection
        supabase = get_supabase()
        kb_docs = supabase.table("knowledge_documents").select("id").limit(1).execute()
        supabase_working = not getattr(kb_docs, "error", None)
        
        # Test OpenAI client
        client = OpenAIClient()
        openai_working = client.enabled
        
        return {
            "embedding_model_available": embedding_available,
            "supabase_connected": supabase_working,
            "openai_available": openai_working,
            "status": "ok" if all([embedding_available, supabase_working, openai_working]) else "partial"
        }
    except Exception as e:
        logger.error(f"Test endpoint error: {e}")
        return {"status": "error", "message": str(e)}

@router.post("", response_model=ChatResponse)
async def chat(req: ChatRequest):
    client = OpenAIClient()
    r = await client.chat([m.model_dump() for m in req.messages])
    reply = ChatMessage(role="assistant", content=r["content"], citations=[Citation(**c) for c in r.get("citations",[])])
    return ChatResponse(reply=reply)

@router.post("/knowledge-base")
async def chat_knowledge_base(req: ChatRequest):
    """Chat with knowledge base using RAG"""
    try:
        logger.info(f"Knowledge base chat request received with {len(req.messages)} messages")
        
        if not req.messages:
            raise HTTPException(status_code=400, detail="No messages provided")
        
        last_message = req.messages[-1].content
        logger.info(f"Processing query: {last_message[:100]}...")
        
        # Search for relevant chunks in knowledge base
        similar_chunks = await search_similar_chunks(last_message, "knowledge_base")
        logger.info(f"Found {len(similar_chunks)} similar chunks")
        
        # Check if this is using text search (lower threshold) or vector search
        threshold = 0.3 if not EMBEDDINGS_AVAILABLE else 0.7
        if not similar_chunks or similar_chunks[0]["similarity"] < threshold:
            # Low similarity - still return the best match we found for frontend to handle
            logger.info(f"Low similarity score: {similar_chunks[0]['similarity'] if similar_chunks else 0.0}")
            
            if similar_chunks:
                # Build context from the best match we have, even if similarity is low
                context = similar_chunks[0]["content"]
                
                # Get citation info
                citations = []
                doc_id = similar_chunks[0]["document_id"]
                try:
                    if "source_info" in similar_chunks[0] and similar_chunks[0]["source_info"]:
                        doc_data = similar_chunks[0]["source_info"]
                        citations.append({
                            "id": doc_id,
                            "title": doc_data.get("title", "Unknown Document"),
                            "author": doc_data.get("author_name") or doc_data.get("author_email", "Unknown")
                        })
                    else:
                        supabase = get_supabase()
                        doc_result = supabase.table("knowledge_documents").select("title, author_name, author_email").eq("id", doc_id).single().execute()
                        if doc_result.data:
                            doc_data = doc_result.data
                            citations.append({
                                "id": doc_id,
                                "title": doc_data.get("title", "Unknown Document"),
                                "author": doc_data.get("author_name") or doc_data.get("author_email", "Unknown")
                            })
                except Exception as e:
                    logger.warning(f"Could not fetch document details for {doc_id}: {e}")
                    citations.append({
                        "id": doc_id,
                        "title": "Document",
                        "author": "Unknown"
                    })
                
                # Generate response using OpenAI with context, but note low similarity
                client = OpenAIClient()
                
                context_prompt = f"""The user asked: "{last_message}"

I found this content in our knowledge base, but it may not be a perfect match (low similarity score):

{context}

Please provide a helpful answer if the content is relevant, or explain that the available information doesn't fully address their question. Be honest about the limitations.

IMPORTANT: Provide your response in plain text format only. Do not use Markdown formatting, bold text (**), italics (*), or code blocks (```). Write in a clear, conversational style as if speaking directly to the user."""
                
                response = await client.chat([
                    {"role": "system", "content": "You are a helpful assistant. When provided content has low relevance, acknowledge this and be honest about limitations while still being helpful."},
                    {"role": "user", "content": context_prompt}
                ])
                
                # Sanitize response to remove any markdown formatting
                sanitized_content = sanitize_markdown(response["content"])
                
                return {
                    "reply": {
                        "role": "assistant",
                        "content": sanitized_content,
                        "source": "knowledge_base",
                        "similarity_score": similar_chunks[0]["similarity"],
                        "citations": citations
                    }
                }
            else:
                # No results at all
                return {
                    "reply": {
                        "role": "assistant",
                        "content": "",
                        "source": "knowledge_base",
                        "similarity_score": 0.0
                    }
                }
        
        # Build context from similar chunks
        context = "\n\n".join([chunk["content"] for chunk in similar_chunks[:3]])
        
        # Get citations info by fetching document details
        citations = []
        seen_doc_ids = set()
        for chunk in similar_chunks[:3]:
            doc_id = chunk["document_id"]
            if doc_id not in seen_doc_ids:
                seen_doc_ids.add(doc_id)
                try:
                    # If source_info is available from text search fallback, use it
                    if "source_info" in chunk and chunk["source_info"]:
                        doc_data = chunk["source_info"]
                        citations.append({
                            "id": doc_id,
                            "title": doc_data.get("title", "Unknown Document"),
                            "author": doc_data.get("author_name") or doc_data.get("author_email", "Unknown")
                        })
                    else:
                        # Fetch document details from knowledge_documents table
                        doc_result = supabase.table("knowledge_documents").select("title, author_name, author_email").eq("id", doc_id).single().execute()
                        if doc_result.data:
                            doc_data = doc_result.data
                            citations.append({
                                "id": doc_id,
                                "title": doc_data.get("title", "Unknown Document"),
                                "author": doc_data.get("author_name") or doc_data.get("author_email", "Unknown")
                            })
                except Exception as e:
                    logger.warning(f"Could not fetch document details for {doc_id}: {e}")
                    citations.append({
                        "id": doc_id,
                        "title": "Document",
                        "author": "Unknown"
                    })
        
        # Generate response using OpenAI with context
        client = OpenAIClient()
        
        context_prompt = f"""Based on the following context from our knowledge base, please answer the user's question: "{last_message}"

Context:
{context}

Please provide a helpful answer based on this context. If the context doesn't fully address the question, say so.

IMPORTANT: Provide your response in plain text format only. Do not use Markdown formatting, bold text (**), italics (*), or code blocks (```). Write in a clear, conversational style as if speaking directly to the user."""
        
        response = await client.chat([
            {"role": "system", "content": "You are a helpful assistant that answers questions based on provided context. Always respond in plain text without markdown formatting."},
            {"role": "user", "content": context_prompt}
        ])
        
        # Sanitize response to remove any markdown formatting
        sanitized_content = sanitize_markdown(response["content"])
        
        return {
            "reply": {
                "role": "assistant",
                "content": sanitized_content,
                "source": "knowledge_base",
                "similarity_score": similar_chunks[0]["similarity"],
                "citations": citations
            }
        }
        
    except Exception as e:
        logger.error(f"Knowledge base chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload-document")
async def upload_document_for_chat(file: UploadFile = File(...)):
    """Upload a document and process it for chat"""
    try:
        logger.info(f"Document upload started: {file.filename}")
        
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are allowed")
        
        if file.size and file.size > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size must be less than 10MB")
        
        # Read and process PDF
        logger.info("Reading PDF content...")
        pdf_content = await file.read()
        logger.info(f"PDF content size: {len(pdf_content)} bytes")
        
        logger.info("Extracting text from PDF...")
        extracted_text = extract_text_from_pdf(pdf_content)
        logger.info(f"Extracted text length: {len(extracted_text)} characters")
        
        if not extracted_text:
            raise HTTPException(status_code=400, detail="Could not extract text from PDF")
        
        # Generate document ID and store temporarily
        doc_id = str(uuid.uuid4())
        logger.info(f"Generated document ID: {doc_id}")
        
        # Chunk text and generate embeddings
        logger.info("Chunking text...")
        chunks = chunk_text(extracted_text)
        logger.info(f"Created {len(chunks)} text chunks")
        
        logger.info("Generating embeddings...")
        embeddings = generate_embeddings(chunks)
        logger.info(f"Generated {len(embeddings)} embeddings")
        
        # Store in embeddings table with a marker for temporary documents
        supabase = get_supabase()
        embedding_inserts = []
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            embedding_inserts.append({
                "id": str(uuid.uuid4()),
                "document_id": doc_id,
                "content": chunk,
                "embedding": embedding,
                "chunk_index": i
            })
        
        # Insert embeddings in batches to avoid size limits
        logger.info(f"Inserting {len(embedding_inserts)} embeddings...")
        batch_size = 10  # Insert in smaller batches
        for i in range(0, len(embedding_inserts), batch_size):
            batch = embedding_inserts[i:i + batch_size]
            try:
                result = supabase.table("embeddings").insert(batch).execute()
                if getattr(result, "error", None):
                    logger.error(f"Failed to insert batch {i//batch_size + 1}: {result.error}")
                    raise HTTPException(status_code=500, detail=f"Failed to process document: {result.error}")
                logger.info(f"Inserted batch {i//batch_size + 1}/{(len(embedding_inserts) + batch_size - 1)//batch_size}")
            except Exception as e:
                logger.error(f"Error inserting batch {i//batch_size + 1}: {e}")
                raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")
        
        logger.info(f"Document {doc_id} processed successfully")
        return {
            "document_id": doc_id,
            "filename": file.filename,
            "chunks_count": len(chunks),
            "message": "Document processed successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document upload error: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")

@router.post("/document/{document_id}")
async def chat_with_document(document_id: str, req: ChatRequest):
    """Chat with a specific uploaded document using RAG"""
    try:
        logger.info(f"Document chat request for document {document_id}")
        
        if not req.messages:
            raise HTTPException(status_code=400, detail="No messages provided")
        
        last_message = req.messages[-1].content
        logger.info(f"Processing query: {last_message[:100]}...")
        
        # Search for relevant chunks in the specific document
        similar_chunks = await search_similar_chunks(last_message, "uploaded_document", document_id)
        logger.info(f"Found {len(similar_chunks)} similar chunks for document {document_id}")
        
        if not similar_chunks:
            logger.warning(f"No chunks found for document {document_id}")
            raise HTTPException(status_code=404, detail="Document not found or no content available")
        
        # Build context from similar chunks
        context = "\n\n".join([chunk["content"] for chunk in similar_chunks[:3]])
        logger.info(f"Built context with {len(context)} characters")
        
        # Generate response using OpenAI with context
        client = OpenAIClient()
        
        context_prompt = f"""Based on the following content from the uploaded document, please answer the user's question: "{last_message}"

Document Content:
{context}

Please provide a helpful answer based on this document content.

IMPORTANT: Provide your response in plain text format only. Do not use Markdown formatting, bold text (**), italics (*), or code blocks (```). Write in a clear, conversational style as if speaking directly to the user."""
        
        logger.info("Generating response with OpenAI...")
        response = await client.chat([
            {"role": "system", "content": "You are a helpful assistant that answers questions based on the provided document content. Always respond in plain text without markdown formatting."},
            {"role": "user", "content": context_prompt}
        ])
        
        # Sanitize response to remove any markdown formatting
        sanitized_content = sanitize_markdown(response["content"])
        
        logger.info("Document chat response generated successfully")
        return {
            "reply": {
                "role": "assistant",
                "content": sanitized_content,
                "source": "uploaded_document",
                "similarity_score": similar_chunks[0]["similarity"],
                "citations": [{
                    "id": document_id,
                    "title": "Uploaded Document",
                    "author": "Uploaded by user"
                }]
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document chat error: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to process chat request: {str(e)}")

@router.post("/general-response")
async def get_general_response(req: ChatRequest):
    """Get a general ChatGPT response when knowledge base search fails"""
    try:
        if not req.messages:
            raise HTTPException(status_code=400, detail="No messages provided")
        
        # Use OpenAI for general response
        client = OpenAIClient()
        
        # Add system message to ensure plain text response
        messages = [{"role": "system", "content": "You are a helpful assistant. Always respond in plain text without markdown formatting, bold text, or code blocks. Write in a clear, conversational style."}]
        messages.extend([m.model_dump() for m in req.messages])
        
        response = await client.chat(messages)
        
        # Sanitize response to remove any markdown formatting
        sanitized_content = sanitize_markdown(response["content"])
        
        return {
            "reply": {
                "role": "assistant",
                "content": sanitized_content,
                "source": "general"
            }
        }
        
    except Exception as e:
        logger.error(f"General response error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
