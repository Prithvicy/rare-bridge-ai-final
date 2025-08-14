from pydantic import BaseModel
from typing import List, Optional, Literal
from datetime import datetime

Role = Literal["guest", "member", "admin"]

class Citation(BaseModel):
  id: str
  title: str
  url: Optional[str] = None

class ChatMessage(BaseModel):
  role: Literal["user", "assistant"]
  content: str
  citations: Optional[List[Citation]] = None

class ChatRequest(BaseModel):
  messages: List[ChatMessage]

class ChatResponse(BaseModel):
  reply: ChatMessage

class WebSearchRequest(BaseModel):
  q: str

class WebSearchResponse(BaseModel):
  summary: str
  sources: list[Citation]

class OneSheetRequest(BaseModel):
  name: str
  condition: str
  notes: str

class OneSheetResponse(BaseModel):
  pdfUrl: str

class RecipesRequest(BaseModel):
  tags: Optional[list[str]] = None

class Recipe(BaseModel):
  id: str
  title: str
  tags: list[str]

class RecipesResponse(BaseModel):
  items: list[Recipe]

class ContactRequest(BaseModel):
  name: str
  email: str
  message: str

class PagedDocs(BaseModel):
  page: int
  perPage: int
  total: int
  items: list[dict]

# Knowledge Base schemas
class KnowledgeSubmission(BaseModel):
  title: str
  content: Optional[str] = None
  document_url: Optional[str] = None
  author_email: str
  author_name: Optional[str] = None
  category: Optional[str] = None
  tags: Optional[List[str]] = None

class KnowledgeDocument(BaseModel):
  id: str
  title: str
  content: Optional[str] = None
  document_url: Optional[str] = None
  author_email: str
  author_name: Optional[str] = None
  status: Literal["pending", "approved", "rejected"]
  category: Optional[str] = None
  tags: Optional[List[str]] = None
  view_count: int = 0
  created_at: datetime
  updated_at: datetime
  approved_at: Optional[datetime] = None

class KnowledgeSearchResponse(BaseModel):
  items: List[KnowledgeDocument]
  page: int
  per_page: int
  total: int
  total_pages: int

class ModerateKnowledgeRequest(BaseModel):
  action: Literal["approved", "rejected"]

# PWS Recipes schemas
class PWSChatFilters(BaseModel):
  meal_type: Optional[str] = None
  vegetables: Optional[List[str]] = None
  protein: Optional[str] = None
  carb: Optional[str] = None
  dietary_restrictions: Optional[List[str]] = None
  allergies: Optional[List[str]] = None
  calories_max: Optional[int] = None

class PWSChatRequest(BaseModel):
  message: str
  image: Optional[str] = None  # Base64 encoded image
  filters: Optional[PWSChatFilters] = None

class GenerateRecipeRequest(BaseModel):
  meal_type: str
  vegetables: Optional[List[str]] = None
  protein: Optional[str] = None
  carb: Optional[str] = None
  dietary_restrictions: Optional[List[str]] = None
  allergies: Optional[List[str]] = None
  calories_max: Optional[int] = 400

# Recipe feedback
class RecipeFeedbackRequest(BaseModel):
  message_id: str
  action: Literal["like", "dislike"]
  recipe_name: Optional[str] = None
  user_email: Optional[str] = None

class RecipeEmailRequest(BaseModel):
  to_email: str
  subject: str
  body: str