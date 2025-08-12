import { Breadcrumbs } from "@/components/Breadcrumbs";

export default function Privacy() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Breadcrumbs />
      <h1 className="text-3xl font-bold mb-2">Data Privacy & Ethics</h1>
      <p className="text-gray-700">
        We follow strict data minimization, encryption in transit and at rest (when live), and role-based access with RLS. AI outputs are reviewed and sources cited where possible.
      </p>
    </div>
  );
}
