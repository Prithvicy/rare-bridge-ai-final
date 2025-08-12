"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ChatUI() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    if (!input.trim()) return;
    const userMsg: ChatMessage = { role: "user", content: input };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);
    const res = await api.chat({ messages: [...messages, userMsg] });
    setMessages((m) => [...m, res.reply]);
    setLoading(false);
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border p-4 h-[460px] overflow-auto bg-white">
        {messages.length === 0 && <p className="text-sm text-gray-500">Ask about approved documents. Citations will appear below.</p>}
        {messages.map((m, i) => (
          <div key={i} className={cn("my-2", m.role === "user" ? "text-right" : "text-left")}>
            <div className={cn("inline-block px-3 py-2 rounded-xl", m.role === "user" ? "bg-brand-600 text-white" : "bg-gray-100")}>
              {m.content}
            </div>
            {m.citations && (
              <div className="text-xs text-gray-500 mt-1">
                Sources: {m.citations.map((c, idx) => <span key={idx} className="underline mr-2">{c.title}</span>)}
              </div>
            )}
          </div>
        ))}
        {loading && <p className="text-sm text-gray-500">Thinking…</p>}
        <div ref={endRef} />
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          className="flex-1 rounded-xl border px-3 py-2"
          placeholder="Ask a question…"
        />
        <button onClick={send} className="rounded-xl px-4 py-2 bg-brand-600 text-white hover:bg-brand-700">Send</button>
      </div>
    </div>
  );
}
