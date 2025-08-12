"use client";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { api } from "@/lib/api";
import { useEffect, useState, Suspense } from "react";
import { FileUpload } from "@/components/FileUpload";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/lib/auth";

export default function Knowledge() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{
    items: any[];
    total: number;
    page: number;
    perPage: number;
  } | null>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    search();
  }, []);
  async function search() {
    const r = await api.kbSearch(q, 1);
    setRes(r);
  }
  async function upload(file: File) {
    await api.kbUpload(file);
    await search();
  }
  async function refreshQueue() {
    const r = await api.moderationQueue();
    setQueue(r.items);
  }
  useEffect(() => {
    if (user?.role === "admin") refreshQueue();
  }, [user]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Breadcrumbs />
      <h1 className="text-3xl font-bold mb-2">Knowledge Base</h1>
      <p className="text-gray-600 mb-6">
        Search trusted articles, or contribute new documents.
      </p>

      <div className="grid md:grid-cols-2 gap-8">
        <section>
          <h2 className="font-semibold mb-2">Search</h2>
          <div className="flex gap-2 mb-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="flex-1 rounded-xl border px-3 py-2"
              placeholder="e.g., PKU diet tips"
            />
            <button
              onClick={search}
              className="rounded-xl px-4 py-2 bg-gray-100 hover:bg-gray-200"
            >
              Search
            </button>
          </div>
          <ul className="grid gap-2">
            {res?.items.map((it) => (
              <li key={it.id} className="rounded-xl border p-3">
                <div className="font-medium">{it.title}</div>
                <div className="text-xs text-gray-500">Status: {it.status}</div>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-semibold mb-2">Contribute</h2>
          <Suspense fallback={<div>Loading...</div>}>
            <AuthGate>
              <FileUpload onUpload={upload} />
              <p className="text-xs text-gray-500 mt-2">
                Uploads are reviewed by moderators before appearing.
              </p>
            </AuthGate>
          </Suspense>
          {user?.role === "admin" && (
            <div className="mt-6">
              <h3 className="font-semibold mb-2">Moderator Queue</h3>
              <button
                onClick={refreshQueue}
                className="rounded-xl px-3 py-1.5 bg-gray-100 hover:bg-gray-200 mb-2"
              >
                Refresh
              </button>
              <ul className="grid gap-2">
                {queue.map((it) => (
                  <li
                    key={it.id}
                    className="rounded-xl border p-3 flex items-center justify-between"
                  >
                    <div>{it.title}</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          api.moderate(it.id, "approve").then(refreshQueue)
                        }
                        className="rounded px-3 py-1 bg-green-600 text-white"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() =>
                          api.moderate(it.id, "reject").then(refreshQueue)
                        }
                        className="rounded px-3 py-1 bg-red-600 text-white"
                      >
                        Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
