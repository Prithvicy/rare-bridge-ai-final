"use client";

import Link from "next/link";
import { api } from "@/lib/api";
import { useState } from "react";
import { toast } from "sonner";

export default function Page() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await api.contact(form);
    toast.success("Thanks! We’ll get back to you.");
    setForm({ name: "", email: "", message: "" });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 fade-in">
      <section className="grid md:grid-cols-2 gap-8 items-center">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-3">Hope, information, and tools for rare disorders.</h1>
          <p className="text-gray-600 mb-6">
            Rare Bridge AI connects patients, caregivers, and clinicians to trustworthy knowledge and practical AI helpers.
          </p>
          <div className="flex gap-3">
            <Link href="/tools" className="rounded-xl px-5 py-3 bg-brand-600 text-white hover:bg-brand-700">Explore AI Tools</Link>
            <Link href="/knowledge" className="rounded-xl px-5 py-3 border hover:bg-gray-50">Browse Knowledge Base</Link>
          </div>
          <p className="mt-6 italic text-sm text-gray-500">
            “Alone we are rare. Together we are strong.”
          </p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-brand-50 to-white border p-6">
          <h2 className="font-semibold mb-3">Get in touch</h2>
          <form onSubmit={submit} className="grid gap-3" id="contact">
            <input className="rounded-xl border px-3 py-2" placeholder="Name" value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})}/>
            <input className="rounded-xl border px-3 py-2" placeholder="Email" value={form.email} onChange={(e)=>setForm({...form, email:e.target.value})}/>
            <textarea className="rounded-xl border px-3 py-2" placeholder="Message" value={form.message} onChange={(e)=>setForm({...form, message:e.target.value})}/>
            <button className="rounded-xl px-4 py-2 bg-brand-600 text-white hover:bg-brand-700 w-fit">Send</button>
          </form>
        </div>
      </section>

      <section className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { href: "/about", title: "About Us", desc: "Our mission, team, and partnerships." },
          { href: "/tools", title: "AI Tools", desc: "Chat with docs, voice, search, one-sheets, recipes." },
          { href: "/community", title: "Community", desc: "Join events, Discord, and support groups." },
          { href: "/knowledge", title: "Knowledge Base", desc: "Trusted articles you can search and contribute." }
        ].map((c)=>(
          <Link key={c.href} href={c.href} className="rounded-2xl border p-5 hover:shadow-md">
            <h3 className="font-semibold">{c.title}</h3>
            <p className="text-sm text-gray-600">{c.desc}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
