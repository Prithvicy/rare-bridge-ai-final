"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Menu } from "lucide-react";
import { useState } from "react";
import Image from "next/image";

const nav = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About Us" },
  { href: "/tools", label: "AI Tools" },
  { href: "/community", label: "Community" },
  { href: "/knowledge", label: "Knowledge Base" }
];

export function NavBar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 backdrop-blur border-b bg-white/70">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-4">
        <button className="md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Open menu">
          <Menu />
        </button>
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.svg" alt="Rare Bridge AI" width={28} height={28} />
          <span className="font-semibold">Rare Bridge AI</span>
        </Link>
        <nav className="ml-auto hidden md:flex items-center gap-6">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`hover:text-brand-700 ${pathname === n.href ? "text-brand-700 font-medium" : ""}`}
            >
              {n.label}
            </Link>
          ))}
          {user ? (
            <>
              <span className="text-sm text-gray-600">Hello, {user.email} {user.role === "admin" && "(admin)"}</span>
              <button onClick={logout} className="rounded-lg px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-sm">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm">Login</Link>
              <Link href="/signup" className="rounded-lg px-3 py-1.5 bg-brand-600 text-white text-sm hover:bg-brand-700">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
      {open && (
        <div className="md:hidden border-t bg-white">
          <nav className="flex flex-col p-2">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="px-3 py-2 rounded hover:bg-gray-100" onClick={() => setOpen(false)}>
                {n.label}
              </Link>
            ))}
            <div className="px-3 py-2">
              {user ? (
                <button onClick={() => { logout(); setOpen(false); }} className="rounded px-3 py-2 bg-gray-100 w-full">
                  Logout
                </button>
              ) : (
                <div className="flex gap-3">
                  <Link href="/login" onClick={() => setOpen(false)} className="text-sm underline">Login</Link>
                  <Link href="/signup" onClick={() => setOpen(false)} className="text-sm underline">Sign up</Link>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
