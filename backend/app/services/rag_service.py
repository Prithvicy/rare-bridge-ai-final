"""
In-house RAG (Retrieval-Augmented Generation) Service
Lightweight implementation with local embeddings and cache-based vector storage
"""

import logging
import uuid
import hashlib
import pickle
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from pathlib import Path
import PyPDF2
import io
import re
import numpy as np

logger = logging.getLogger(__name__)

try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    logger.warning("sentence-transformers not available")
    SENTENCE_TRANSFORMERS_AVAILABLE = False

@dataclass
class DocumentChunk:
    """Represents a chunk of text from a document with metadata"""
    id: str
    document_id: str
    content: str
    page_number: int
    chunk_index: int
    embedding: Optional[List[float]] = None

@dataclass
class Document:
    """Represents a processed document with metadata"""
    id: str
    filename: str
    title: str
    total_pages: int
    chunks: List[DocumentChunk]
    processed_at: str

@dataclass
class SearchResult:
    """Represents a search result with similarity score"""
    chunk: DocumentChunk
    similarity_score: float
    source_metadata: Dict[str, Any]

class VectorCache:
    """In-memory vector storage with persistence to disk"""
    
    def __init__(self, cache_dir: str = "./cache"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)
        
        # In-memory storage
        self.documents: Dict[str, Document] = {}
        self.embeddings: Dict[str, np.ndarray] = {}
        
        # Load existing cache
        self._load_cache()
    
    def _get_cache_file(self) -> Path:
        return self.cache_dir / "rag_cache.pkl"
    
    def _load_cache(self):
        """Load cache from disk"""
        cache_file = self._get_cache_file()
        if cache_file.exists():
            try:
                with open(cache_file, 'rb') as f:
                    cache_data = pickle.load(f)
                    self.documents = cache_data.get('documents', {})
                    
                    # Load embeddings as numpy arrays
                    embeddings_data = cache_data.get('embeddings', {})
                    self.embeddings = {k: np.array(v) for k, v in embeddings_data.items()}
                    
                logger.info(f"Loaded {len(self.documents)} documents from cache")
            except Exception as e:
                logger.error(f"Failed to load cache: {e}")
                self.documents = {}
                self.embeddings = {}
    
    def _save_cache(self):
        """Save cache to disk"""
        try:
            cache_data = {
                'documents': self.documents,
                'embeddings': {k: v.tolist() for k, v in self.embeddings.items()}
            }
            with open(self._get_cache_file(), 'wb') as f:
                pickle.dump(cache_data, f)
            logger.info("Cache saved successfully")
        except Exception as e:
            logger.error(f"Failed to save cache: {e}")
    
    def add_document(self, document: Document):
        """Add a document to the cache"""
        self.documents[document.id] = document
        
        # Store embeddings for each chunk
        for chunk in document.chunks:
            if chunk.embedding:
                self.embeddings[chunk.id] = np.array(chunk.embedding)
        
        self._save_cache()
    
    def get_document(self, document_id: str) -> Optional[Document]:
        """Get a document by ID"""
        return self.documents.get(document_id)
    
    def search_similar(self, query_embedding: np.ndarray, top_k: int = 5, 
                      document_id: Optional[str] = None) -> List[Tuple[str, float]]:
        """Search for similar chunks using cosine similarity"""
        if not self.embeddings:
            return []
        
        results = []
        
        for chunk_id, embedding in self.embeddings.items():
            # Filter by document if specified
            if document_id:
                chunk = self._get_chunk_by_id(chunk_id)
                if not chunk or chunk.document_id != document_id:
                    continue
            
            # Calculate cosine similarity
            similarity = self._cosine_similarity(query_embedding, embedding)
            results.append((chunk_id, similarity))
        
        # Sort by similarity and return top_k
        results.sort(key=lambda x: x[1], reverse=True)
        return results[:top_k]
    
    def _get_chunk_by_id(self, chunk_id: str) -> Optional[DocumentChunk]:
        """Get a chunk by ID across all documents"""
        for document in self.documents.values():
            for chunk in document.chunks:
                if chunk.id == chunk_id:
                    return chunk
        return None
    
    @staticmethod
    def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
        """Calculate cosine similarity between two vectors"""
        dot_product = np.dot(a, b)
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        
        if norm_a == 0 or norm_b == 0:
            return 0.0
        
        return dot_product / (norm_a * norm_b)
    
    def remove_document(self, document_id: str):
        """Remove a document and its embeddings from cache"""
        if document_id in self.documents:
            document = self.documents[document_id]
            
            # Remove embeddings for all chunks
            for chunk in document.chunks:
                if chunk.id in self.embeddings:
                    del self.embeddings[chunk.id]
            
            # Remove document
            del self.documents[document_id]
            self._save_cache()
    
    def clear_cache(self):
        """Clear all cached data"""
        self.documents.clear()
        self.embeddings.clear()
        cache_file = self._get_cache_file()
        if cache_file.exists():
            cache_file.unlink()

class EmbeddingService:
    """Local embedding service with fallback to TF-IDF style embeddings"""
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model_name = model_name
        self.model = None
        self.use_fallback = False
        self._load_model()
    
    def _load_model(self):
        """Load the sentence transformer model"""
        if not SENTENCE_TRANSFORMERS_AVAILABLE:
            logger.warning("sentence-transformers not available, using fallback embeddings")
            self.use_fallback = True
            return
        
        try:
            self.model = SentenceTransformer(self.model_name)
            logger.info(f"Loaded embedding model: {self.model_name}")
        except Exception as e:
            logger.warning(f"Failed to load embedding model, using fallback: {e}")
            self.model = None
            self.use_fallback = True
    
    def is_available(self) -> bool:
        """Check if embedding service is available (including fallback)"""
        return True  # Always available with fallback
    
    def _simple_text_embedding(self, text: str, dim: int = 384) -> List[float]:
        """Create a simple hash-based embedding for text"""
        # Simple character frequency-based embedding
        text_lower = text.lower()
        
        # Character frequency features
        char_counts = {}
        for char in text_lower:
            if char.isalnum():
                char_counts[char] = char_counts.get(char, 0) + 1
        
        # Convert to feature vector
        embedding = [0.0] * dim
        
        # Hash-based feature mapping
        for char, count in char_counts.items():
            hash_val = hash(char) % dim
            embedding[hash_val] += count / len(text_lower)
        
        # Add some word-level features
        words = text_lower.split()
        for word in words[:20]:  # Limit to first 20 words
            if len(word) > 2:
                hash_val = hash(word) % dim
                embedding[hash_val] += 1.0 / len(words)
        
        # Normalize
        norm = sum(x * x for x in embedding) ** 0.5
        if norm > 0:
            embedding = [x / norm for x in embedding]
        
        return embedding
    
    def encode(self, texts: List[str]) -> List[List[float]]:
        """Encode texts into embeddings"""
        if self.use_fallback or not self.model:
            # Use simple fallback embeddings
            logger.debug(f"Using fallback embeddings for {len(texts)} texts")
            return [self._simple_text_embedding(text) for text in texts]
        
        try:
            embeddings = self.model.encode(texts, convert_to_tensor=False)
            return embeddings.tolist()
        except Exception as e:
            logger.error(f"Failed to encode texts, using fallback: {e}")
            return [self._simple_text_embedding(text) for text in texts]

class DocumentProcessor:
    """Process documents for RAG"""
    
    def __init__(self):
        self.embedding_service = EmbeddingService()
    
    def extract_text_from_pdf(self, pdf_content: bytes) -> List[Tuple[str, int]]:
        """Extract text from PDF with page numbers"""
        try:
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_content))
            pages_text = []
            
            for page_num, page in enumerate(pdf_reader.pages, 1):
                text = page.extract_text()
                if text.strip():
                    pages_text.append((text.strip(), page_num))
            
            return pages_text
        except Exception as e:
            logger.error(f"Error extracting text from PDF: {e}")
            raise
    
    def chunk_text_with_page_info(self, pages_text: List[Tuple[str, int]], 
                                 chunk_size: int = 1000, overlap: int = 200) -> List[Tuple[str, int]]:
        """Split text into chunks while preserving page information"""
        chunks_with_pages = []
        
        for text, page_num in pages_text:
            if len(text) <= chunk_size:
                chunks_with_pages.append((text, page_num))
                continue
            
            # Split long pages into chunks
            start = 0
            while start < len(text):
                end = start + chunk_size
                chunk = text[start:end]
                
                # Try to break at sentence boundaries
                if end < len(text):
                    last_period = chunk.rfind('.')
                    last_newline = chunk.rfind('\n')
                    boundary = max(last_period, last_newline)
                    if boundary > start + chunk_size // 2:
                        end = start + boundary + 1
                        chunk = text[start:end]
                
                chunks_with_pages.append((chunk.strip(), page_num))
                start = end - overlap
                
                if start >= len(text):
                    break
        
        return chunks_with_pages
    
    def process_document(self, filename: str, pdf_content: bytes) -> Document:
        """Process a PDF document into chunks with embeddings"""
        document_id = str(uuid.uuid4())
        
        # Extract text from PDF
        logger.info(f"Extracting text from {filename}")
        pages_text = self.extract_text_from_pdf(pdf_content)
        
        if not pages_text:
            raise ValueError("No text could be extracted from the PDF")
        
        # Chunk text with page information
        logger.info(f"Chunking text from {len(pages_text)} pages")
        chunks_with_pages = self.chunk_text_with_page_info(pages_text)
        
        # Generate embeddings
        logger.info(f"Generating embeddings for {len(chunks_with_pages)} chunks")
        chunk_texts = [chunk[0] for chunk in chunks_with_pages]
        embeddings = self.embedding_service.encode(chunk_texts)
        
        # Create document chunks
        chunks = []
        for i, ((text, page_num), embedding) in enumerate(zip(chunks_with_pages, embeddings)):
            chunk = DocumentChunk(
                id=str(uuid.uuid4()),
                document_id=document_id,
                content=text,
                page_number=page_num,
                chunk_index=i,
                embedding=embedding
            )
            chunks.append(chunk)
        
        # Create document
        document = Document(
            id=document_id,
            filename=filename,
            title=filename.replace('.pdf', ''),
            total_pages=len(pages_text),
            chunks=chunks,
            processed_at=str(uuid.uuid4())  # Simple timestamp placeholder
        )
        
        return document

class RAGService:
    """Main RAG service orchestrating all components"""
    
    def __init__(self, cache_dir: str = "./cache"):
        self.vector_cache = VectorCache(cache_dir)
        self.document_processor = DocumentProcessor()
        self.embedding_service = EmbeddingService()
    
    def upload_document(self, filename: str, pdf_content: bytes) -> str:
        """Upload and process a document for RAG"""
        try:
            # Process document
            document = self.document_processor.process_document(filename, pdf_content)
            
            # Store in cache
            self.vector_cache.add_document(document)
            
            logger.info(f"Document {filename} processed successfully with {len(document.chunks)} chunks")
            return document.id
            
        except Exception as e:
            logger.error(f"Failed to upload document {filename}: {e}")
            raise
    
    def search_documents(self, query: str, document_id: Optional[str] = None, 
                        top_k: int = 5, min_similarity: float = 0.01) -> List[SearchResult]:
        """Search for relevant document chunks"""
        try:
            # Generate query embedding
            query_embeddings = self.embedding_service.encode([query])
            query_embedding = np.array(query_embeddings[0])
            
            # Search similar chunks
            similar_chunks = self.vector_cache.search_similar(
                query_embedding, top_k=top_k, document_id=document_id
            )
            
            # Convert to search results
            results = []
            for chunk_id, similarity in similar_chunks:
                if similarity < min_similarity:
                    continue
                
                # Find the chunk
                chunk = None
                document = None
                for doc in self.vector_cache.documents.values():
                    for c in doc.chunks:
                        if c.id == chunk_id:
                            chunk = c
                            document = doc
                            break
                    if chunk:
                        break
                
                if chunk and document:
                    result = SearchResult(
                        chunk=chunk,
                        similarity_score=similarity,
                        source_metadata={
                            "filename": document.filename,
                            "title": document.title,
                            "page_number": chunk.page_number,
                            "total_pages": document.total_pages
                        }
                    )
                    results.append(result)
            
            return results
            
        except Exception as e:
            logger.error(f"Search failed: {e}")
            return []
    
    def get_document_info(self, document_id: str) -> Optional[Dict[str, Any]]:
        """Get document information"""
        document = self.vector_cache.get_document(document_id)
        if not document:
            return None
        
        return {
            "id": document.id,
            "filename": document.filename,
            "title": document.title,
            "total_pages": document.total_pages,
            "chunks_count": len(document.chunks),
            "processed_at": document.processed_at
        }
    
    def remove_document(self, document_id: str) -> bool:
        """Remove a document from the cache"""
        try:
            self.vector_cache.remove_document(document_id)
            return True
        except Exception as e:
            logger.error(f"Failed to remove document {document_id}: {e}")
            return False
    
    def list_documents(self) -> List[Dict[str, Any]]:
        """List all cached documents"""
        documents = []
        for document in self.vector_cache.documents.values():
            documents.append({
                "id": document.id,
                "filename": document.filename,
                "title": document.title,
                "total_pages": document.total_pages,
                "chunks_count": len(document.chunks)
            })
        return documents
    
    def health_check(self) -> Dict[str, Any]:
        """Check service health"""
        return {
            "embedding_service_available": self.embedding_service.is_available(),
            "cached_documents": len(self.vector_cache.documents),
            "total_chunks": sum(len(doc.chunks) for doc in self.vector_cache.documents.values()),
            "cache_directory": str(self.vector_cache.cache_dir)
        }

# Global RAG service instance
rag_service = RAGService()