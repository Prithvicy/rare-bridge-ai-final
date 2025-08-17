// frontend/lib/api.ts
// Central API client. Adds Supabase JWT automatically when NEXT_PUBLIC_USE_MOCKS=false.

import type { ChatMessage } from "./types";
import type {
  KnowledgeDocument,
  KnowledgeSearchResponse,
  KnowledgePendingResponse,
  KnowledgeSubmitData,
  KnowledgeSubmitResponse,
  KnowledgeModerateResponse,
  KnowledgeCategoriesResponse,
  KnowledgePopularResponse,
} from "./types/knowledge";
import { supabase } from "./supabase";

const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

// Simple request tracking to detect stuck requests
let activeRequests = new Set<string>();
let consecutiveTimeouts = 0;
let lastSuccessTime = Date.now();

// Cache the current auth token to avoid hanging Supabase calls
let cachedToken: string | null = null;
let lastTokenTime = 0;

/** Pull the current Supabase access token for Authorization header (Bearer). */
function authHeaders(): Record<string, string> {
  if (USE_MOCKS) return {};
  
  // If we have a recent cached token (less than 5 minutes old), use it
  if (cachedToken && (Date.now() - lastTokenTime < 5 * 60 * 1000)) {
    console.log(`🔑 Using cached token (${Math.floor((Date.now() - lastTokenTime) / 1000)}s old)`);
    return { Authorization: `Bearer ${cachedToken}` };
  }
  
  // Try to get token from localStorage (Supabase stores it there)
  try {
    const supabaseAuthToken = localStorage.getItem('sb-rrhfqnttiktqfsqykcfo-auth-token');
    if (supabaseAuthToken) {
      const authData = JSON.parse(supabaseAuthToken);
      const token = authData?.access_token;
      if (token) {
        console.log(`🔑 Retrieved token from localStorage`);
        cachedToken = token;
        lastTokenTime = Date.now();
        return { Authorization: `Bearer ${token}` };
      }
    }
  } catch (e) {
    console.warn('Could not get token from localStorage:', e);
  }
  
  console.warn('🔑 No valid token found - proceeding without auth');
  return {};
}

// Update cached token when auth state changes
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.access_token) {
      console.log(`🔑 Updating cached token from auth state change: ${event}`);
      cachedToken = session.access_token;
      lastTokenTime = Date.now();
    } else {
      console.log(`🔑 Clearing cached token from auth state change: ${event}`);
      cachedToken = null;
      lastTokenTime = 0;
    }
  });
}

/** JSON helper that automatically sets headers and throws on non-2xx, with a simple timeout. */
async function json<T>(
  path: string,
  opts?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  const requestId = `${path}-${Date.now()}`;
  console.log(`Making API request to: ${path} (ID: ${requestId})`);
  
  // Allow concurrent requests, just track them
  activeRequests.add(requestId);
  
  console.log(`🔑 Getting auth headers...`);
  const extra = authHeaders();
  console.log(`🔑 Auth headers received:`, extra);
  
  console.log(`🎛️ Creating AbortController...`);
  const controller = new AbortController();
  console.log(`🎛️ AbortController created`);
  
  console.log(`⏰ Setting up timeout...`);
  const timeoutMs = opts?.timeoutMs ?? 5000; // 5s timeout - balance between speed and reliability
  const timeout = setTimeout(() => {
    consecutiveTimeouts++;
    console.error(`🚨 TIMEOUT #${consecutiveTimeouts}: ${path} after ${timeoutMs}ms`);
    
    // If we've had multiple timeouts and no success in 30 seconds, reload page
    if (consecutiveTimeouts >= 2 && Date.now() - lastSuccessTime > 30000) {
      console.error("🔄 Multiple timeouts detected - reloading page to reset connections...");
      setTimeout(() => window.location.reload(), 500);
    }
    
    controller.abort();
  }, timeoutMs);
  
  console.log(`⏱️ Timeout set for ${timeoutMs}ms for request: ${path}`);
  
  try {
    console.log(`🚀 About to fetch: ${BASE}${path}`);
    console.log(`📋 Headers:`, { "Content-Type": "application/json", ...extra });
    
    const res = await fetch(`${BASE}${path}`, {
      ...opts,
      signal: controller.signal,
      keepalive: false, // Don't keep connections alive
      cache: 'no-store', // Force fresh requests
      headers: {
        "Content-Type": "application/json",
        "Connection": "close", // Force connection close
        ...(opts?.headers || {}),
        ...extra,
      } as HeadersInit,
    });
    
    console.log(`✅ Response received from ${path}:`, res.status, res.statusText);
    
    // Reset timeout counter on successful response
    consecutiveTimeouts = 0;
    lastSuccessTime = Date.now();
    
    // If unauthorized, the session has expired
    if (res.status === 401) {
      console.log('Received 401 - session expired, user needs to log in again');
      // Clear the current session state
      await supabase.auth.signOut();
      throw new Error('Your session has expired. Please log in again.');
    }
    
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`${res.status} ${path} ${text ? "- " + text : ""}`);
    }
    
    return res.json() as Promise<T>;
  } catch (err: any) {
    console.error(`API request to ${path} failed:`, err);
    if (err?.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms: ${path}`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
    activeRequests.delete(requestId);
    console.log(`Cleaned up request for: ${path} (ID: ${requestId})`);
  }
}

export const api = {
  async health() {
    return json<{ status: string; mocks?: boolean }>("/health");
  },

  async chat({ messages }: { messages: ChatMessage[] }) {
    if (USE_MOCKS) {
      const last = messages[messages.length - 1]?.content || "";
      return {
        reply: {
          role: "assistant",
          content: `Here's a supportive, plain-language answer to: "${last}".\n\n(When connected, this uses RAG over approved docs.)`,
          citations: [
            { id: "d1", title: "Understanding Phenylketonuria (PKU)" },
          ],
        } as ChatMessage,
      };
    }
    return json<{ reply: ChatMessage }>("/chat", {
      method: "POST",
      body: JSON.stringify({ messages }),
      timeoutMs: 45000, // Increased timeout for LLM calls
    });
  },

  async chatKnowledgeBase({ messages }: { messages: ChatMessage[] }) {
    if (USE_MOCKS) {
      const last = messages[messages.length - 1]?.content || "";
      const mockSimilarity = Math.random();
      
      if (mockSimilarity > 0.7) {
        return {
          reply: {
            role: "assistant",
            content: `Based on our knowledge base: "${last}"\n\n[This would be the RAG response from knowledge base vectors]`,
            source: "knowledge_base",
            similarity_score: mockSimilarity,
            citations: [
              { id: "kb-1", title: "PKU Treatment Guidelines", author: "Dr. Sarah Johnson" },
            ],
          } as ChatMessage,
        };
      } else {
        return {
          reply: {
            role: "assistant",
            content: "",
            source: "knowledge_base",
            similarity_score: mockSimilarity,
          } as ChatMessage,
        };
      }
    }
    return json<{ reply: ChatMessage }>("/chat/knowledge-base", {
      method: "POST",
      body: JSON.stringify({ messages }),
      timeoutMs: 45000,
    });
  },

  async uploadDocumentForChat(file: File) {
    if (USE_MOCKS) {
      return {
        id: "mock-doc-123", // Changed from document_id to id to match new endpoint
        filename: file.name,
        chunks_count: 5,
        message: "Document processed successfully"
      };
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("note", "Uploaded for chat"); // Add optional note

    const extra = authHeaders();
    const res = await fetch(`${BASE}/docs/upload`, { // Changed to new endpoint
      method: "POST",
      body: formData,
      headers: { ...extra } as HeadersInit,
    });
    
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`${res.status} - ${text || "Upload failed"}`);
    }
    
    return res.json();
  },

  async chatWithDocument({ documentId, messages }: { documentId: string; messages: ChatMessage[] }) {
    if (USE_MOCKS) {
      const last = messages[messages.length - 1]?.content || "";
      return {
        reply: {
          role: "assistant",
          content: `Based on your uploaded document regarding: "${last}"\n\n[This would be the RAG response from uploaded document vectors]`,
          source: "rag_document", // Changed to match new system
          similarity_score: 0.85,
          citations: [
            { id: documentId, title: "Uploaded Document", author: "Uploaded by user" },
          ],
        } as ChatMessage,
      };
    }
    return json<{ reply: ChatMessage }>(`/docs/${documentId}/chat`, { // Changed to new endpoint
      method: "POST",
      body: JSON.stringify({ messages }),
      timeoutMs: 45000,
    });
  },

  async getGeneralResponse({ messages }: { messages: ChatMessage[] }) {
    if (USE_MOCKS) {
      const last = messages[messages.length - 1]?.content || "";
      return {
        reply: {
          role: "assistant",
          content: `Here's a general response about: "${last}"\n\n[This would be a ChatGPT response when knowledge base search fails]`,
          source: "general",
        } as ChatMessage,
      };
    }
    return json<{ reply: ChatMessage }>("/chat/general-response", {
      method: "POST",
      body: JSON.stringify({ messages }),
      timeoutMs: 45000,
    });
  },

  async searchWeb(q: string) {
    if (USE_MOCKS) {
      return {
        summary: `AI summary for "${q}"`,
        sources: [{ title: "Rare Disease Overview", url: "#" }],
      };
    }
    return json<{ summary: string; sources: { title: string; url: string }[] }>(
      "/search/web",
      { method: "POST", body: JSON.stringify({ q }) }
    );
  },

  async oneSheet(payload: any) {
    if (USE_MOCKS) {
      // In mock mode we just return a URL that hits the backend's /one-sheet/download directly.
      const qs = new URLSearchParams({
        name: payload.name || "",
        condition: payload.condition || "",
        notes: payload.notes || "",
      }).toString();
      return { pdfUrl: `/one-sheet/download?${qs}` };
    }
    return json<{ pdfUrl: string }>("/one-sheet", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async recipes(filters: { tags?: string[] }) {
    if (USE_MOCKS) {
      return {
        items: [
          { id: "r1", title: "Low-Protein Pancakes", tags: ["breakfast"] },
        ],
      };
    }
    return json<{ items: { id: string; title: string; tags: string[] }[] }>(
      "/recipes",
      { method: "POST", body: JSON.stringify(filters) }
    );
  },

  // PWS Recipes API
  pwsRecipes: {
    // Chat with the PWS assistant
    async chat(params: {
      message: string;
      image?: string;
      filters?: {
        meal_type?: string;
        vegetables?: string[];
        protein?: string;
        carb?: string;
        dietary_restrictions?: string[];
        allergies?: string[];
        calories_max?: number;
      };
    }): Promise<any> {
      if (USE_MOCKS) {
        if (params.image) {
          return {
            type: "food_analysis",
            content:
              "I can see a healthy meal with approximately 350 calories. It contains grilled chicken (25g protein), steamed broccoli, and quinoa. This is PWS-friendly!",
            suggestions: [
              "Try adding more vegetables for volume",
              "Consider using Greek yogurt as a sauce",
            ],
            recipe: null,
          };
        }
        if (params.filters || params.message.toLowerCase().includes("recipe")) {
          return {
            type: "recipe",
            content: "Here's a PWS-friendly recipe for you:",
            recipe: {
              name: "Herb-Crusted Chicken with Roasted Vegetables",
              calories: 320,
              servings: 1,
              prep_time: "15 minutes",
              cook_time: "25 minutes",
              ingredients: [
                "4 oz chicken breast",
                "1 cup broccoli florets",
                "1/2 cup bell peppers, sliced",
                "1/2 cup zucchini, sliced",
                "1 tbsp olive oil",
                "Italian herbs, garlic powder, salt, pepper",
              ],
              instructions: [
                "Preheat oven to 400°F",
                "Season chicken with herbs and spices",
                "Toss vegetables with olive oil and seasonings",
                "Bake chicken for 20-25 minutes",
                "Roast vegetables for 15-20 minutes",
                "Serve together and enjoy!",
              ],
              nutrition: {
                calories: 320,
                protein: "35g",
                carbs: "15g",
                fat: "12g",
                fiber: "6g",
              },
            },
            suggestions: [
              "Add a side of quinoa for more sustaining energy",
              "Try with different herb combinations",
            ],
          };
        }
        return {
          type: "chat",
          content:
            "I'm here to help with PWS-friendly recipes! You can ask me about ingredients, share a food photo for analysis, or request specific recipes. What would you like to know?",
          suggestions: [
            "Show me a low-calorie dinner recipe",
            "What vegetables are PWS-approved?",
            "Help me plan a meal with chicken",
          ],
          recipe: null,
        };
      }
      return json<any>("/recipes/chat", {
        method: "POST",
        body: JSON.stringify(params),
        timeoutMs: 30000, // 30 seconds for AI/LLM responses
      });
    },

    // Provide feedback (like/dislike) for a generated recipe
    async feedback(params: {
      message_id: string;
      action: "like" | "dislike";
      recipe_name?: string;
      user_email?: string | null;
    }): Promise<{ ok: boolean }> {
      if (USE_MOCKS) {
        return { ok: true };
      }
      return json<{ ok: boolean }>("/recipes/feedback", {
        method: "POST",
        body: JSON.stringify(params),
      });
    },

    // Email a recipe or message via backend mailer
    async email(params: {
      to_email: string;
      subject: string;
      body: string;
    }): Promise<{ ok: boolean }> {
      if (USE_MOCKS) return { ok: true };
      return json<{ ok: boolean }>("/recipes/email", {
        method: "POST",
        body: JSON.stringify(params),
      });
    },

    // Analyze food image
    async analyzeImage(file: File): Promise<any> {
      if (USE_MOCKS) {
        return {
          type: "food_analysis",
          content:
            "Estimated ~300-350 calories. Appears to include lean protein and vegetables. Looks PWS-friendly!",
          suggestions: [],
          recipe: null,
        };
      }
      const fd = new FormData();
      fd.append("file", file);

      const extra = await authHeaders();
      const res = await fetch(`${BASE}/recipes/analyze-image`, {
        method: "POST",
        body: fd,
        headers: { ...extra } as HeadersInit,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      return res.json();
    },

    // Get PWS-approved ingredients
    async getIngredients(category?: string): Promise<any> {
      const qs = category ? `?category=${encodeURIComponent(category)}` : "";
      return json<any>(`/recipes/ingredients${qs}`);
    },

    // Generate recipe with filters
    async generateRecipe(params: {
      meal_type: string;
      vegetables?: string[];
      protein?: string;
      carb?: string;
      dietary_restrictions?: string[];
      allergies?: string[];
      calories_max?: number;
    }): Promise<any> {
      if (USE_MOCKS) {
        return {
          type: "recipe",
          content: "Here's a PWS-friendly recipe for you:",
          recipe: {
            name: `Quick ${params.meal_type} Bowl`,
            calories: params.calories_max ?? 350,
            servings: 1,
            prep_time: "10 minutes",
            cook_time: "15 minutes",
            ingredients: [
              "Mixed vegetables",
              "Lean protein",
              "Whole grain option",
            ],
            instructions: [
              "Prep ingredients",
              "Cook protein and vegetables",
              "Assemble bowl and serve",
            ],
            nutrition: {
              calories: params.calories_max ?? 350,
              protein: "25g",
              carbs: "30g",
              fat: "10g",
              fiber: "6g",
            },
          },
          suggestions: [],
        };
      }
      return json<any>("/recipes/generate-recipe", {
        method: "POST",
        body: JSON.stringify(params),
        timeoutMs: 30000, // 30 seconds for AI/LLM responses
      });
    },
  },

  async kbSearch(q: string, page = 1) {
    if (USE_MOCKS) {
      return {
        page,
        perPage: 10,
        total: 2,
        items: [
          { id: "d1", title: "PKU Basics", status: "approved" },
          { id: "d2", title: "Clinic Visit Checklist", status: "approved" },
        ],
      };
    }
    return json<{ page: number; perPage: number; total: number; items: any[] }>(
      `/docs/search?q=${encodeURIComponent(q)}&page=${page}`
    );
  },

  async kbUpload(file: File) {
    if (USE_MOCKS) return { id: "up1", status: "pending" };

    const fd = new FormData();
    fd.append("file", file);

    const extra = await authHeaders();
    const res = await fetch(`${BASE}/docs/upload`, {
      method: "POST",
      body: fd,
      headers: { ...extra } as HeadersInit, // don't set Content-Type for multipart
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return res.json();
  },

  async moderationQueue() {
    if (USE_MOCKS) {
      return {
        items: [
          { id: "d3", title: "Clinic Visit Checklist", status: "pending" },
        ],
      };
    }
    return json<{ items: any[] }>("/docs/pending");
  },

  async moderate(id: string, action: "approve" | "reject") {
    if (USE_MOCKS) {
      return { id, status: action === "approve" ? "approved" : "rejected" };
    }
    return json(`/docs/${id}/${action}`, { method: "POST" });
  },

  async contact(payload: { name: string; email: string; message: string }) {
    if (USE_MOCKS) return { ok: true };
    return json("/contact", { method: "POST", body: JSON.stringify(payload) });
  },

  // New Knowledge Base endpoints
  knowledge: {
    // Submit a new document
    async submit(data: KnowledgeSubmitData): Promise<KnowledgeSubmitResponse> {
      if (USE_MOCKS) {
        return {
          success: true,
          id: "mock-123",
          message: "Document submitted for review",
        };
      }
      return json<KnowledgeSubmitResponse>("/knowledge/submit", {
        method: "POST",
        body: JSON.stringify(data),
        timeoutMs: 20000,
      });
    },

    // Submit a new document with file upload
    async submitWithFile(data: KnowledgeSubmitData, file: File): Promise<KnowledgeSubmitResponse> {
      if (USE_MOCKS) {
        return {
          success: true,
          id: "mock-123",
          message: "Document submitted for review",
        };
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", data.title);
      formData.append("author_email", data.author_email);
      formData.append("document_url", data.document_url || "");  // Required field
      if (data.content) formData.append("content", data.content);
      if (data.author_name) formData.append("author_name", data.author_name);
      if (data.category) formData.append("category", data.category);
      if (data.tags) formData.append("tags", JSON.stringify(data.tags));

      const extra = authHeaders();
      const res = await fetch(`${BASE}/knowledge/submit-with-file`, {
        method: "POST",
        body: formData,
        headers: { ...extra } as HeadersInit, // Don't set Content-Type for multipart
      });
      
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`${res.status} - ${text || "Upload failed"}`);
      }
      
      return res.json();
    },

    // Search documents
    async search(params: {
      q?: string;
      page?: number;
      per_page?: number;
      category?: string;
    }): Promise<KnowledgeSearchResponse> {
      if (USE_MOCKS) {
        return {
          items: [
            {
              id: "1",
              title: "Understanding PKU",
              content: "A comprehensive guide to phenylketonuria...",
              document_url: "https://example.com/pku-guide.pdf",
              author_email: "author@example.com",
              author_name: "Dr. Smith",
              status: "approved",
              category: "Medical",
              tags: ["PKU", "genetics"],
              view_count: 42,
              created_at: new Date().toISOString(),
            },
          ],
          page: params.page || 1,
          per_page: params.per_page || 10,
          total: 1,
          total_pages: 1,
        };
      }

      const queryParams = new URLSearchParams();
      if (params.q) queryParams.append("q", params.q);
      if (params.page) queryParams.append("page", params.page.toString());
      if (params.per_page)
        queryParams.append("per_page", params.per_page.toString());
      if (params.category) queryParams.append("category", params.category);

      return json<KnowledgeSearchResponse>(
        `/knowledge/search?${queryParams.toString()}`,
        { timeoutMs: 15000 }
      );
    },

    // Get single document
    async get(id: string): Promise<KnowledgeDocument> {
      if (USE_MOCKS) {
        return {
          id,
          title: "Sample Document",
          content: "Document content here...",
          status: "approved",
          author_email: "test@example.com",
          view_count: 0,
          created_at: new Date().toISOString(),
        };
      }
      return json<KnowledgeDocument>(`/knowledge/document/${id}`, {
        timeoutMs: 15000,
      });
    },

    // Get pending documents (admin)
    async getPending(): Promise<KnowledgePendingResponse> {
      if (USE_MOCKS) {
        return {
          items: [
            {
              id: "pending-1",
              title: "New Research Paper",
              content: "Pending approval...",
              author_email: "researcher@example.com",
              status: "pending",
              view_count: 0,
              created_at: new Date().toISOString(),
            },
          ],
        };
      }
      return json<KnowledgePendingResponse>("/knowledge/pending", {
        timeoutMs: 15000,
      });
    },

    // Moderate document (admin)
    async moderate(
      id: string,
      action: "approved" | "rejected",
      adminUserId?: string
    ): Promise<KnowledgeModerateResponse> {
      console.log("📡 API moderate call debug:");
      console.log("  - Document ID:", id);
      console.log("  - Action:", action);
      console.log("  - Admin User ID received:", adminUserId);
      
      const requestBody = { 
        action,
        admin_user_id: adminUserId 
      };
      console.log("  - Request body being sent:", requestBody);
      
      if (USE_MOCKS) {
        return { success: true, message: `Document ${action}` };
      }
      return json<KnowledgeModerateResponse>(`/knowledge/moderate/${id}`, {
        method: "POST",
        body: JSON.stringify(requestBody),
        timeoutMs: 15000,
      });
    },

    // Get categories
    async getCategories(): Promise<KnowledgeCategoriesResponse> {
      if (USE_MOCKS) {
        return {
          categories: ["Medical", "Research", "Nutrition", "Treatment"],
        };
      }
      return json<KnowledgeCategoriesResponse>("/knowledge/categories", {
        timeoutMs: 15000,
      });
    },

    // Get popular documents
    async getPopular(limit: number = 5): Promise<KnowledgePopularResponse> {
      if (USE_MOCKS) {
        return {
          items: [
            {
              id: "pop-1",
              title: "Most Viewed Document",
              author_email: "test@example.com",
              status: "approved",
              view_count: 100,
              created_at: new Date().toISOString(),
            },
          ],
        };
      }
      return json<KnowledgePopularResponse>(
        `/knowledge/popular?limit=${limit}`,
        { timeoutMs: 15000 }
      );
    },
  },
};
