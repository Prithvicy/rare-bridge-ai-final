"use client";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useState } from "react";
import { api } from "@/lib/api";

export default function Search() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ summary: string; sources: { title: string; url: string }[] } | null>(null);

  async function go() {
    const r = await api.searchWeb(q);
    setRes(r);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Breadcrumbs />
      <h1 className="text-3xl font-bold mb-2">Web Search</h1>
      <p className="text-gray-600 mb-6">AI summary with cited sources.</p>
      <div className="flex gap-2 mb-3">
        <input className="flex-1 rounded-xl border px-3 py-2" value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search the web…" />
        <button onClick={go} className="rounded-xl px-4 py-2 bg-brand-600 text-white">Search</button>
      </div>
      {res && (
        <div className="rounded-2xl border p-4">
          <p className="mb-3 whitespace-pre-wrap">{res.summary}</p>
          <ul className="text-sm text-gray-600 list-disc pl-6">
            {res.sources.map((s, i) => <li key={i}><a className="underline" href={s.url} target="_blank">{s.title}</a></li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
