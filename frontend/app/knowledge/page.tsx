"use client";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  Search,
  FileText,
  Plus,
  Clock,
  Eye,
  Tag,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ExternalLink,
  CheckCircle,
  XCircle,
} from "lucide-react";
import type {
  KnowledgeDocument,
  KnowledgeSearchResponse,
  KnowledgePendingResponse,
} from "@/lib/types/knowledge";

export default function Knowledge() {
  const [activeTab, setActiveTab] = useState<"search" | "contribute">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [pendingDocs, setPendingDocs] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const { user } = useAuth();

  // Form states
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    document_url: "",
    author_email: "",
    author_name: "",
    category: "",
    tags: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // Search documents
  const searchDocuments = async (page: number = 1) => {
    setLoading(true);
    try {
      const response = (await api.knowledge.search({
        q: searchQuery,
        page,
        per_page: 10,
      })) as KnowledgeSearchResponse;
      setDocuments(response.items || []);
      setCurrentPage(response.page);
      setTotalPages(response.total_pages);
      setTotal(response.total);
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Failed to search documents");
    } finally {
      setLoading(false);
    }
  };

  // Load pending documents for admin
  const loadPendingDocs = async () => {
    if (user?.role !== "admin") return;
    try {
      const response =
        (await api.knowledge.getPending()) as KnowledgePendingResponse;
      setPendingDocs(response.items || []);
    } catch (error) {
      console.error("Failed to load pending docs:", error);
    }
  };

  // Submit new document
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.author_email) {
      toast.error("Please fill in required fields");
      return;
    }

    setSubmitting(true);
    try {
      const tags = formData.tags
        ? formData.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [];
      await api.knowledge.submit({
        ...formData,
        tags,
      });
      toast.success(
        "Document submitted successfully! It will appear after admin approval."
      );
      setFormData({
        title: "",
        content: "",
        document_url: "",
        author_email: "",
        author_name: "",
        category: "",
        tags: "",
      });
      setActiveTab("search");
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("Failed to submit document");
    } finally {
      setSubmitting(false);
    }
  };

  // Moderate document
  const handleModerate = async (
    docId: string,
    action: "approved" | "rejected"
  ) => {
    try {
      await api.knowledge.moderate(docId, action);
      toast.success(`Document ${action}`);
      loadPendingDocs();
      if (action === "approved") {
        searchDocuments(currentPage);
      }
    } catch (error) {
      console.error("Moderation error:", error);
      toast.error("Failed to moderate document");
    }
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Initial load
  useEffect(() => {
    searchDocuments();
  }, []);

  // Load pending docs for admin
  useEffect(() => {
    if (user?.role === "admin") {
      loadPendingDocs();
    }
  }, [user]);

  // Search with debounce
  useEffect(() => {
    const debounce = setTimeout(() => {
      searchDocuments(1);
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Breadcrumbs />

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-3">Knowledge Base</h1>
        <p className="text-gray-600">
          Search trusted articles or contribute new documents to our collection
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-8">
        <button
          onClick={() => setActiveTab("search")}
          className={`px-6 py-3 rounded-xl font-medium transition-all ${
            activeTab === "search"
              ? "bg-brand-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          <Search className="w-5 h-5 inline mr-2" />
          Search Documents
        </button>
        <button
          onClick={() => setActiveTab("contribute")}
          className={`px-6 py-3 rounded-xl font-medium transition-all ${
            activeTab === "contribute"
              ? "bg-brand-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          <Plus className="w-5 h-5 inline mr-2" />
          Contribute
        </button>
      </div>

      {/* Search Tab */}
      {activeTab === "search" && (
        <div>
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for documents..."
                className="w-full pl-12 pr-4 py-4 rounded-2xl border focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Results */}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Found {total} documents
              </p>

              <div className="grid gap-4 mb-6">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="rounded-xl border p-6 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-lg font-semibold">{doc.title}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Eye className="w-4 h-4" />
                        {doc.view_count}
                      </div>
                    </div>

                    {doc.content && (
                      <p className="text-gray-600 mb-3 line-clamp-2">
                        {doc.content}
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>{doc.author_name || doc.author_email}</span>
                        <span>{formatDate(doc.created_at)}</span>
                      </div>

                      {doc.document_url && (
                        <a
                          href={doc.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-600 hover:text-brand-700 flex items-center gap-1"
                        >
                          View Document
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>

                    {doc.tags && doc.tags.length > 0 && (
                      <div className="mt-3 flex gap-2">
                        {doc.tags.map((tag, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-gray-100 rounded-lg text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => searchDocuments(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="px-4 py-2">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => searchDocuments(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Contribute Tab */}
      {activeTab === "contribute" && (
        <div className="max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Document Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-brand-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Your Email *
              </label>
              <input
                type="email"
                value={formData.author_email}
                onChange={(e) =>
                  setFormData({ ...formData, author_email: e.target.value })
                }
                className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-brand-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={formData.author_name}
                onChange={(e) =>
                  setFormData({ ...formData, author_name: e.target.value })
                }
                className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Document URL
              </label>
              <input
                type="url"
                value={formData.document_url}
                onChange={(e) =>
                  setFormData({ ...formData, document_url: e.target.value })
                }
                className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-brand-500"
                placeholder="https://example.com/document.pdf"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Content/Description
              </label>
              <textarea
                value={formData.content}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
                className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-brand-500"
                rows={4}
                placeholder="Brief description of the document..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Category</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-brand-500"
                placeholder="e.g., Research, Treatment, Nutrition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) =>
                  setFormData({ ...formData, tags: e.target.value })
                }
                className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-brand-500"
                placeholder="e.g., PKU, diet, guidelines"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit for Review"}
            </button>
          </form>
        </div>
      )}

      {/* Admin Panel */}
      {user?.role === "admin" && pendingDocs.length > 0 && (
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-4">Pending Approvals</h2>
          <div className="grid gap-4">
            {pendingDocs.map((doc) => (
              <div
                key={doc.id}
                className="rounded-xl border border-yellow-200 bg-yellow-50 p-6"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-semibold">{doc.title}</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleModerate(doc.id, "approved")}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4 inline mr-1" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleModerate(doc.id, "rejected")}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      <XCircle className="w-4 h-4 inline mr-1" />
                      Reject
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  Submitted by: {doc.author_name || doc.author_email}
                </p>
                {doc.content && <p className="text-gray-700">{doc.content}</p>}
                {doc.document_url && (
                  <a
                    href={doc.document_url}
                    target="_blank"
                    className="text-brand-600 hover:underline mt-2 inline-block"
                  >
                    View Document
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
