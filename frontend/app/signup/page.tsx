"use client";
import { supabase } from "@/lib/supabase";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSignup() {
    setErr(null);
    setLoading(true);
    try {
      console.log("Attempting signup with:", email);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (error) {
        console.error("Signup error:", error);
        throw new Error(error.message);
      }

      console.log("Signup successful:", data);

      // If confirmations OFF, this will land signed-in; if ON, you'll still go home and then log in after confirming.
      router.push("/");
      router.refresh();
    } catch (e: any) {
      console.error("Signup exception:", e);
      setErr(e?.message || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-bold mb-4">Sign up</h1>
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
        autoComplete="new-password"
      />
      <button
        onClick={onSignup}
        disabled={loading}
        className="rounded-xl px-4 py-2 bg-brand-600 text-white disabled:opacity-50"
      >
        {loading ? "Creating…" : "Create account"}
      </button>
      {err && <p className="text-sm text-red-600 mt-3">{err}</p>}
    </div>
  );
}
