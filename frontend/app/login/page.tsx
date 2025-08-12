"use client";
import { supabase } from "@/lib/supabase";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  isBraveBrowser,
  hasWalletExtensions,
  getBrowserNavigationAdvice,
  safeNavigate,
} from "@/lib/utils";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [browserAdvice, setBrowserAdvice] = useState<string | null>(null);
  const router = useRouter();

  // Check for browser-specific issues on mount
  useEffect(() => {
    const advice = getBrowserNavigationAdvice();
    if (advice) {
      setBrowserAdvice(advice);
    }
  }, []);

  // Test function to check database connection
  async function testDatabase() {
    try {
      console.log("Testing database connection...");
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .limit(1);

      if (error) {
        console.error("Database test error:", error);
        return false;
      }

      console.log("Database test successful:", data);
      return true;
    } catch (e) {
      console.error("Database test exception:", e);
      return false;
    }
  }

  async function onLogin() {
    setErr(null);
    setLoading(true);
    try {
      console.log("Attempting login with:", email);

      // Test database first
      await testDatabase();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        console.error("Login error:", error);
        throw new Error(error.message);
      }

      console.log("Login successful:", data);
      console.log("User session:", data.session);
      console.log("User:", data.user);

      // Use safe navigation that handles wallet extension conflicts
      console.log("Redirecting to home page...");
      safeNavigate("/", router);
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

  // Check if user is already logged in
  useEffect(() => {
    const checkSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          console.log("User already logged in, redirecting...");
          safeNavigate("/", router);
        }
      } catch (error) {
        console.error("Error checking session:", error);
      }
    };
    checkSession();
  }, [router]);

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
