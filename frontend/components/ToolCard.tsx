import Link from "next/link";

export function ToolCard({ title, desc, href }: { title: string; desc: string; href: string }) {
  return (
    <Link href={href} className="rounded-2xl border p-5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-400 transition">
      <h3 className="font-semibold text-lg mb-1">{title}</h3>
      <p className="text-sm text-gray-600">{desc}</p>
    </Link>
  );
}
