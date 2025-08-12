"use client";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function AuthGate({
  children,
  adminOnly = false
}: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const params = useSearchParams();

  // Remember where the user tried to go (for redirect after login)
  useEffect(() => {
    if (!user && typeof window !== "undefined") {
      const q = params?.toString();
      const next = q ? `${pathname}?${q}` : pathname;
      localStorage.setItem("rb_next", next);
    }
  }, [user, pathname, params]);

  if (!user) {
    const q = params?.toString();
    const next = q ? `${pathname}?${q}` : pathname;
    return (
      <p className="text-sm text-gray-600">
        Please{" "}
        <Link className="underline" href={`/login?next=${encodeURIComponent(next)}`}>
          log in
        </Link>{" "}
        to continue.
      </p>
    );
  }

  if (adminOnly && user.role !== "admin") {
    return <p className="text-sm text-gray-600">Admin access required.</p>;
  }

  return <>{children}</>;
}
