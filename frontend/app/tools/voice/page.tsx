"use client";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useEffect, useRef, useState } from "react";

export default function Voice() {
  const [transcript, setTranscript] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  function toggle() {
    if (recording) {
      wsRef.current?.close();
      setRecording(false);
    } else {
      const ws = new WebSocket((process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000").replace("http", "ws") + "/ws/voice");
      wsRef.current = ws;
      ws.onopen = () => setRecording(true);
      ws.onmessage = (e) => setTranscript((t) => [...t, e.data as string]);
      ws.onclose = () => setRecording(false);
    }
  }

  useEffect(() => () => wsRef.current?.close(), []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Breadcrumbs />
      <h1 className="text-3xl font-bold mb-2">Voice Chat</h1>
      <p className="text-gray-600 mb-6">Mic demo (mock STT/TTS over WebSocket). Type to simulate speech:</p>
      <button onClick={toggle} className={`rounded-xl px-4 py-2 ${recording ? "bg-red-600" : "bg-brand-600"} text-white`}>
        {recording ? "Stop" : "Start"} Talking
      </button>
      <div className="mt-4 rounded-xl border p-4 h-64 overflow-auto bg-white">
        {transcript.map((t, i) => <div key={i} className="text-sm text-gray-800">{t}</div>)}
      </div>
    </div>
  );
}
