"use client";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useState } from "react";
import { api } from "@/lib/api";

export default function OneSheet() {
  const [form, setForm] = useState({ name: "", condition: "", notes: "" });
  const [pdf, setPdf] = useState<string | null>(null);
  async function generate() {
    const r = await api.oneSheet(form);
    setPdf(r.pdfUrl);
  }
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Breadcrumbs />
      <h1 className="text-3xl font-bold mb-2">One-Sheet Generator</h1>
      <div className="grid gap-3">
        <input className="rounded-xl border px-3 py-2" placeholder="Patient/Child name" value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})}/>
        <input className="rounded-xl border px-3 py-2" placeholder="Condition" value={form.condition} onChange={(e)=>setForm({...form, condition:e.target.value})}/>
        <textarea className="rounded-xl border px-3 py-2" placeholder="Key notes" value={form.notes} onChange={(e)=>setForm({...form, notes:e.target.value})}/>
        <button onClick={generate} className="rounded-xl px-4 py-2 bg-brand-600 text-white w-fit">Generate PDF</button>
        {pdf && <a href={pdf} className="underline text-brand-700" target="_blank" rel="noreferrer">Download PDF</a>}
      </div>
    </div>
  );
}
