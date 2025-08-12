import { Breadcrumbs } from "@/components/Breadcrumbs";

export default function Tutorials() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Breadcrumbs />
      <h1 className="text-3xl font-bold mb-2">Tutorials</h1>
      <div className="grid md:grid-cols-2 gap-6">
        {["Intro to RAG", "Uploading Documents"].map((t, i) => (
          <div key={i} className="rounded-2xl border p-5">
            <h3 className="font-semibold mb-2">{t}</h3>
            <iframe
              className="w-full h-60 rounded-xl border"
              src="https://www.youtube.com/embed/dQw4w9WgXcQ"
              title="Tutorial"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ))}
      </div>
    </div>
  );
}
