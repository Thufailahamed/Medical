'use client';

const TIERS = [
  {
    name: 'Patient',
    priceLkr: 0,
    features: [
      'All mobile + web features',
      'Trilingual (en / si / ta)',
      'Unlimited records + WhatsApp onboarding',
    ],
  },
  {
    name: 'Doctor Pro',
    priceLkr: 2500,
    features: [
      'Own clinic + online booking',
      'Rx templates + signed E-Rx',
      'Doctor payouts + reply-time badge',
    ],
  },
  {
    name: 'Clinic Pro',
    priceLkr: 15000,
    features: [
      'Multi-doctor',
      'Wards + IPD + billing + reports',
      'CSV export + priority support',
    ],
  },
];

export default function PricingPage() {
  return (
    <main className="container mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold text-center mb-12">Pricing</h1>
      <div className="grid md:grid-cols-3 gap-6">
        {TIERS.map((t) => (
          <div key={t.name} className="border rounded-lg p-6">
            <h2 className="text-2xl font-semibold">{t.name}</h2>
            <p className="text-3xl font-bold mt-2">
              {t.priceLkr === 0 ? 'Free' : `LKR ${t.priceLkr.toLocaleString()}/mo`}
            </p>
            <ul className="mt-4 space-y-2">
              {t.features.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </main>
  );
}
