"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  isBraveBrowser,
  hasWalletExtensions,
  getBrowserNavigationAdvice,
  safeNavigate,
} from "@/lib/utils";
import { useAuth } from "@/lib/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [browserAdvice, setBrowserAdvice] = useState<string | null>(null);
  const router = useRouter();
  const { login, user } = useAuth();

  // Check for browser-specific issues on mount
  useEffect(() => {
    const advice = getBrowserNavigationAdvice();
    if (advice) {
      setBrowserAdvice(advice);
    }
  }, []);


  async function onLogin() {
    setErr(null);
    setLoading(true);
    try {
      console.log("Attempting login with:", email);

      // Use AuthProvider's login method instead of direct Supabase call
      await login(email.trim(), password);

      console.log("Login successful via AuthProvider");

      // Add a small delay to allow auth state to propagate, then navigate
      setTimeout(() => {
        console.log("Redirecting to home page...");
        safeNavigate("/", router);
      }, 100);
    } catch (e: any) {
      console.error("Login exception:", e);

      // Check if it's an extension interference error
      if (
        e?.code === 4001 ||
        e?.message?.includes("User rejected the request") ||
        e?.message?.includes("wallet") ||
        e?.message?.includes("extension")
      ) {
        setErr(
          "Login blocked by browser extension. Please try in an incognito window or disable crypto wallet extensions."
        );
      } else {
        setErr(e?.message || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  // Check if user is already logged in using AuthProvider
  useEffect(() => {
    console.log("Login page: User state changed:", user);
    if (user) {
      console.log("User already logged in via AuthProvider, redirecting...");
      safeNavigate("/", router);
    }
  }, [user, router]);

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-bold mb-4">Login</h1>

      {browserAdvice && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          <p className="font-medium">Browser Notice:</p>
          <p>{browserAdvice}</p>
        </div>
      )}

      <input
        className="rounded-xl border px-3 py-2 w-full mb-3 bg-blue-50"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
      />
      <input
        type="password"
        className="rounded-xl border px-3 py-2 w-full mb-3 bg-blue-50"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
      />
      <button
        onClick={onLogin}
        disabled={loading}
        className="rounded-xl px-4 py-2 bg-brand-600 text-white disabled:opacity-50"
      >
        {loading ? "Signing in…" : "Continue"}
      </button>
      {err && <p className="text-sm text-red-600 mt-3">{err}</p>}
    </div>
  );
}
