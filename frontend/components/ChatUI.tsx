"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

type ChatMode = "knowledge_base" | "document_upload";

export function ChatUI() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<ChatMode>("knowledge_base");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedDocumentId, setUploadedDocumentId] = useState<string | null>(null);
  const [processingFile, setProcessingFile] = useState(false);
  const [showFallbackPrompt, setShowFallbackPrompt] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileUpload = async (file: File) => {
    if (!file.type.includes('pdf')) {
      alert('Please upload a PDF file');
      return;
    }
    
    setProcessingFile(true);
    try {
      const result = await api.uploadDocumentForChat(file);
      setUploadedFile(file);
      setUploadedDocumentId(result.id); // Changed from document_id to id
      setMessages([]);
      const systemMsg: ChatMessage = {
        role: "assistant",
        content: `Document "${file.name}" uploaded and processed successfully! I've created ${result.chunks_count} searchable chunks from ${result.total_pages} pages. Now you can ask questions about this document.`,
        source: "rag_document" // Changed to match new system
      };
      setMessages([systemMsg]);
    } catch (err: any) {
      console.error("File processing failed:", err);
      let errorMessage = "Failed to process file. Please try again.";
      
      if (err?.message) {
        if (err.message.includes("PDF")) {
          errorMessage = "Could not process this PDF. Please ensure it's not password-protected and contains readable text.";
        } else if (err.message.includes("size")) {
          errorMessage = "File is too large. Please upload a PDF smaller than 10MB.";
        } else if (err.message.includes("timeout")) {
          errorMessage = "File processing timed out. Please try with a smaller document.";
        }
      }
      
      alert(errorMessage);
    } finally {
      setProcessingFile(false);
    }
  };

  const handleFallbackChoice = async (useGeneral: boolean) => {
    setShowFallbackPrompt(false);
    setLoading(true);
    
    try {
      if (useGeneral) {
        const fallbackMessages = [...messages, { role: "user" as const, content: pendingQuestion }];
        const result = await api.getGeneralResponse({ messages: fallbackMessages });
        setMessages(m => [...m, result.reply]);
      } else {
        // User declined general response, show closest knowledge base match anyway
        const fallbackMessages = [...messages, { role: "user" as const, content: pendingQuestion }];
        const result = await api.chatKnowledgeBase({ messages: fallbackMessages });
        if (result.reply.content) {
          // Show the result even if similarity is low, with a disclaimer
          const disclaimerContent = `Here's the closest information I found in our knowledge base, though it may not be a perfect match for your question:\n\n${result.reply.content}`;
          setMessages(m => [...m, {
            ...result.reply,
            content: disclaimerContent
          }]);
        } else {
          setMessages(m => [...m, {
            role: "assistant",
            content: "I wasn't able to find relevant information in our knowledge base for your question. You might want to try rephrasing your question or asking about a different topic.",
            source: "knowledge_base"
          }]);
        }
      }
    } catch (err) {
      console.error("Fallback response failed:", err);
      setMessages(m => [...m, {
        role: "assistant",
        content: "I'm sorry, I encountered an error processing your request. Please try again.",
      }]);
    } finally {
      setLoading(false);
    }
    setPendingQuestion("");
  };

  async function send() {
    if (!input.trim()) return;
    
    const userMsg: ChatMessage = { role: "user", content: input };
    setMessages((m) => [...m, userMsg]);
    const currentInput = input;
    setInput("");
    setLoading(true);
    
    try {
      if (mode === "document_upload" && uploadedDocumentId) {
        const result = await api.chatWithDocument({ 
          documentId: uploadedDocumentId, 
          messages: [...messages, userMsg] 
        });
        setMessages((m) => [...m, result.reply]);
      } else {
        const result = await api.chatKnowledgeBase({ messages: [...messages, userMsg] });
        if (result.reply.similarity_score && result.reply.similarity_score < 0.7) {
          setPendingQuestion(currentInput);
          setShowFallbackPrompt(true);
          setMessages((m) => [...m, {
            role: "assistant",
            content: "I couldn't find relevant information in our knowledge base for your question. Would you like me to provide a general response instead?",
            source: "knowledge_base",
            similarity_score: result.reply.similarity_score
          }]);
        } else {
          setMessages((m) => [...m, result.reply]);
        }
      }
    } catch (err: any) {
      console.error("Chat API call failed:", err);
      let errorMessage = "I'm sorry, I encountered an error processing your request. Please try again.";
      
      if (err?.message) {
        if (err.message.includes("timeout")) {
          errorMessage = "The request timed out. Please try a shorter question or try again later.";
        } else if (err.message.includes("400")) {
          errorMessage = "There was an issue with your request. Please check your input and try again.";
        } else if (err.message.includes("500")) {
          errorMessage = "There's a server error. Our team has been notified. Please try again in a few minutes.";
        }
      }
      
      setMessages((m) => [...m, {
        role: "assistant",
        content: errorMessage,
      }]);
    } finally {
      setLoading(false);
    }
  }

  const resetChat = () => {
    setMessages([]);
    setUploadedFile(null);
    setUploadedDocumentId(null);
    setShowFallbackPrompt(false);
    setPendingQuestion("");
  };

  return (
    <div className="grid gap-4">
      {/* Mode Toggle */}
      <div className="flex gap-2 bg-gray-50 p-1 rounded-xl">
        <button
          onClick={() => {
            setMode("knowledge_base");
            resetChat();
          }}
          className={cn(
            "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            mode === "knowledge_base"
              ? "bg-white text-brand-600 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          )}
        >
          📚 Knowledge Base
        </button>
        <button
          onClick={() => {
            setMode("document_upload");
            resetChat();
          }}
          className={cn(
            "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            mode === "document_upload"
              ? "bg-white text-brand-600 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          )}
        >
          📄 Upload Document
        </button>
      </div>

      {/* Document Upload Section */}
      {mode === "document_upload" && !uploadedFile && (
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            className="hidden"
          />
          <div className="text-gray-500 mb-4">
            <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-sm text-gray-600 mb-2">Upload a PDF document to chat with it</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={processingFile}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
          >
            {processingFile ? "Processing..." : "Choose PDF File"}
          </button>
        </div>
      )}

      {/* Current Document Display */}
      {mode === "document_upload" && uploadedFile && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-blue-600">📄</span>
            <span className="text-sm font-medium text-blue-900">{uploadedFile.name}</span>
          </div>
          <button
            onClick={() => {
              setUploadedFile(null);
              setUploadedDocumentId(null);
              setMessages([]);
            }}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            Remove
          </button>
        </div>
      )}

      {/* Chat Messages */}
      <div className="rounded-2xl border p-4 h-[460px] overflow-auto bg-white">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-20">
            <div className="text-lg mb-2">
              {mode === "knowledge_base" ? "💬" : "📄"}
            </div>
            <p className="text-sm">
              {mode === "knowledge_base"
                ? "Ask questions about our knowledge base. I'll search through approved documents and provide citations."
                : uploadedFile
                ? `Ask questions about "${uploadedFile.name}"`
                : "Upload a document first, then ask questions about it."
              }
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "my-4",
              m.role === "user" ? "text-right" : "text-left"
            )}
          >
            <div
              className={cn(
                "inline-block px-4 py-3 rounded-xl max-w-[80%]",
                m.role === "user"
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 text-gray-900"
              )}
            >
              {m.content}
            </div>
            
            {/* Source Badge */}
            {m.source && m.role === "assistant" && (
              <div className="mt-2 text-xs">
                <span className={cn(
                  "px-2 py-1 rounded-full text-xs font-medium",
                  m.source === "knowledge_base" && "bg-blue-100 text-blue-800",
                  (m.source === "uploaded_document" || m.source === "rag_document") && "bg-green-100 text-green-800",
                  m.source === "general" && "bg-orange-100 text-orange-800"
                )}>
                  {m.source === "knowledge_base" && "📚 Knowledge Base"}
                  {(m.source === "uploaded_document" || m.source === "rag_document") && "📄 Your Document"}
                  {m.source === "general" && "🌐 General Response"}
                </span>
                {m.similarity_score && (
                  <span className="ml-2 text-gray-500">
                    Confidence: {Math.round(m.similarity_score * 100)}%
                  </span>
                )}
              </div>
            )}

            {/* Citations */}
            {m.citations && m.citations.length > 0 && (
              <div className="text-xs text-gray-600 mt-2 bg-gray-50 p-2 rounded-lg">
                <div className="font-medium mb-1">Sources:</div>
                {m.citations.map((c, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-1">
                    <span className="text-blue-600 underline cursor-pointer hover:text-blue-800">
                      {c.title}
                    </span>
                    {c.author && (
                      <span className="text-gray-500">by {c.author}</span>
                    )}
                    {c.page_number && (
                      <span className="text-gray-500 text-xs bg-gray-200 px-1 rounded">
                        Page {c.page_number}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        
        {/* Fallback Prompt */}
        {showFallbackPrompt && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
            <p className="text-sm text-yellow-800 mb-3">
              Would you like me to provide a general response instead?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleFallbackChoice(true)}
                className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
              >
                Yes, get general response
              </button>
              <button
                onClick={() => handleFallbackChoice(false)}
                className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400"
              >
                No, thanks
              </button>
            </div>
          </div>
        )}
        
        {loading && (
          <div className="text-center py-4">
            <div className="inline-flex items-center gap-2 text-sm text-gray-500">
              <div className="animate-spin h-4 w-4 border-2 border-brand-600 border-t-transparent rounded-full"></div>
              Thinking...
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input Section */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          className="flex-1 rounded-xl border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder={
            mode === "document_upload" && !uploadedFile
              ? "Upload a document first..."
              : "Ask a question..."
          }
          disabled={(mode === "document_upload" && !uploadedDocumentId) || loading}
        />
        <button
          onClick={send}
          disabled={(mode === "document_upload" && !uploadedDocumentId) || loading || !input.trim()}
          className="rounded-xl px-6 py-3 bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}
