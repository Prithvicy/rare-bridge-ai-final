"use client";
import { useAuth } from "@/lib/auth";

export function Banner() {
  const useMocks = process.env.NEXT_PUBLIC_USE_MOCKS === "true";
  const { roleSwitcher } = useAuth();
  return (
    <div className="bg-brand-50 border-b text-sm text-brand-900">
      <div className="mx-auto max-w-6xl px-4 py-2 flex items-center justify-between">
        <div>
          {useMocks ? (
            <span>Mocks are <strong>ON</strong>. Connect API keys & Supabase to go live.</span>
          ) : (
            <span>Live mode. Ensure keys & DB are configured.</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span>Role:</span>
          {roleSwitcher}
        </div>
      </div>
    </div>
  );
}
