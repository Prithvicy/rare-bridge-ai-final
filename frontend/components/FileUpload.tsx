"use client";
import { useState } from "react";

export function FileUpload({ onUpload }: { onUpload: (file: File) => void }) {
  const [drag, setDrag] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) onUpload(f); }}
      className={`border-2 border-dashed rounded-xl p-6 text-center ${drag ? "border-brand-500 bg-brand-50" : "border-gray-300"}`}
    >
      <p className="text-sm mb-2">Drag & drop a file, or</p>
      <label className="inline-block bg-gray-100 hover:bg-gray-200 rounded px-3 py-1.5 cursor-pointer">
        Choose File
        <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }} />
      </label>
    </div>
  );
}
