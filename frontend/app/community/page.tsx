import { Breadcrumbs } from "@/components/Breadcrumbs";

export default function Community() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Breadcrumbs />
      <h1 className="text-3xl font-bold mb-2">Community</h1>
      <p className="text-gray-600 mb-6">Join our Discord, attend events, and book time with volunteers.</p>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-2xl border p-5">
          <h3 className="font-semibold mb-2">Discord</h3>
          <a className="text-brand-700 underline" href="#" target="_blank">Join our server</a>
        </div>
        <div className="rounded-2xl border p-5">
          <h3 className="font-semibold mb-2">Book a session</h3>
          <iframe
            title="Calendly"
            className="w-full h-96 rounded-xl border"
            src="https://calendly.com/"
          />
        </div>
      </div>
    </div>
  );
}
