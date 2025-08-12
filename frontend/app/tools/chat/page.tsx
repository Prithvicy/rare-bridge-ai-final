import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ChatUI } from "@/components/ChatUI";

export default function ChatTool() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Breadcrumbs />
      <h1 className="text-3xl font-bold mb-2">Chat with Docs</h1>
      <p className="text-gray-600 mb-6">RAG over approved documents with citations.</p>
      <ChatUI />
    </div>
  );
}
