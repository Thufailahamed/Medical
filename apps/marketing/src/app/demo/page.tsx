export default function DemoPage() {
  const creds = [
    { role: "Admin", email: "demo+admin@healthhub.lk" },
    { role: "Doctor (GP)", email: "demo+gp@healthhub.lk" },
    { role: "Doctor (Cardio)", email: "demo+cardio@healthhub.lk" },
    { role: "Patient 1", email: "demo+patient1@healthhub.lk" },
    { role: "Patient 2", email: "demo+patient2@healthhub.lk" },
    { role: "Patient 3", email: "demo+patient3@healthhub.lk" },
    { role: "Patient 4", email: "demo+patient4@healthhub.lk" },
    { role: "Patient 5", email: "demo+patient5@healthhub.lk" },
  ];

  return (
    <main className="container mx-auto px-4 py-16 max-w-2xl">
      <h1 className="text-4xl font-bold mb-6">Try the demo</h1>
      <p className="mb-4">
        All accounts use password{" "}
        <code className="bg-gray-100 px-2 py-1 rounded">demo1234</code>.
      </p>
      <p className="mb-6 text-sm text-gray-600">
        Seed runs via{" "}
        <code className="bg-gray-100 px-1 rounded">bun run seed:demo</code> from
        the repo root. Idempotent — safe to re-run.
      </p>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">Role</th>
            <th className="text-left py-2">Email</th>
          </tr>
        </thead>
        <tbody>
          {creds.map((c) => (
            <tr key={c.email} className="border-b">
              <td className="py-2 font-medium">{c.role}</td>
              <td className="py-2 font-mono text-sm">{c.email}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
