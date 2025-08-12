"use client";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useState } from "react";
import { api } from "@/lib/api";

export default function Recipes() {
  const [tag, setTag] = useState("breakfast");
  const [items, setItems] = useState<{ id: string; title: string; tags: string[] }[]>([]);

  async function load() {
    const r = await api.recipes({ tags: [tag] });
    setItems(r.items);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Breadcrumbs />
      <h1 className="text-3xl font-bold mb-2">PWS Recipes</h1>
      <div className="flex gap-2 mb-3">
        <select className="rounded-xl border px-3 py-2" value={tag} onChange={(e)=>setTag(e.target.value)}>
          <option>breakfast</option><option>lunch</option><option>dinner</option>
        </select>
        <button onClick={load} className="rounded-xl px-4 py-2 bg-brand-600 text-white">Find</button>
      </div>
      <ul className="grid gap-3">
        {items.map((it)=>(
          <li key={it.id} className="rounded-xl border p-4">
            <div className="font-medium">{it.title}</div>
            <div className="text-xs text-gray-600">{it.tags.join(", ")}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
