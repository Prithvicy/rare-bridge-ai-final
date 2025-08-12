import Link from "next/link";

const footer = [
  { href: "/tutorials", label: "Tutorials" },
  { href: "/privacy", label: "Data Privacy & Ethics" },
  { href: "/#contact", label: "Contact" }
];

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto max-w-6xl px-4 py-8 grid gap-6 md:flex md:items-center md:justify-between">
        <p className="text-sm text-gray-600">© {new Date().getFullYear()} Rare Bridge AI. All rights reserved.</p>
        <nav className="flex gap-6">
          {footer.map((f) => (
            <Link key={f.href} href={f.href} className="text-sm hover:text-brand-700">{f.label}</Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
