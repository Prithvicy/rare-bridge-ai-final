"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Breadcrumbs() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="text-sm text-gray-600 mb-4">
      <ol className="flex items-center gap-2">
        <li><Link href="/" className="hover:underline">Home</Link></li>
        {parts.map((p, i) => {
          const href = "/" + parts.slice(0, i + 1).join("/");
          const label = p.replace(/-/g, " ");
          return (
            <li key={href} className="flex items-center gap-2">
              <span>/</span>
              {i === parts.length - 1 ? <span aria-current="page">{label}</span> : <Link href={href} className="hover:underline">{label}</Link>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
