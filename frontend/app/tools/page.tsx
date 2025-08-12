import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ToolCard } from "@/components/ToolCard";

export default function Tools() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Breadcrumbs />
      <h1 className="text-3xl font-bold mb-2">AI Tools</h1>
      <p className="text-gray-600 mb-6">Choose a helper that fits your task.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <ToolCard title="Chat with Docs" desc="Ask questions; get cited answers." href="/tools/chat" />
        <ToolCard title="Voice Chat" desc="Speak and listen with assistive UI." href="/tools/voice" />
        <ToolCard title="Web Search" desc="AI-assisted summaries with sources." href="/tools/search" />
        <ToolCard title="One-Sheet" desc="Generate printable care one-pagers." href="/tools/one-sheet" />
        <ToolCard title="PWS Recipes" desc="Dietary-aware recipe suggestions." href="/tools/recipes" />
      </div>
    </div>
  );
}
