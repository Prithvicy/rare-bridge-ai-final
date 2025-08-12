import { Breadcrumbs } from "@/components/Breadcrumbs";

export default function About() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Breadcrumbs />
      <h1 className="text-3xl font-bold mb-2">About Us</h1>
      <p className="text-gray-600 mb-6">
        Rare Bridge AI is a non-profit initiative supporting patients, caregivers, and clinicians through accessible AI tools and a trustworthy knowledge base.
      </p>
      <div className="grid md:grid-cols-3 gap-6">
        {["Patient Advocate", "Caregiver Lead", "Clinical Advisor"].map((role, i) => (
          <div key={i} className="rounded-2xl border p-5">
            <h3 className="font-semibold">{role}</h3>
            <p className="text-sm text-gray-600">Short bio goes here.</p>
          </div>
        ))}
      </div>
    </div>
  );
}
