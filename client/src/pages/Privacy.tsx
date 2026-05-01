export default function Privacy() {
  return (
    <main className="mx-auto max-w-3xl px-4 pt-28 pb-16 text-gray-200 md:px-8">
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Privacy Policy</h1>
      <p className="mt-3 text-sm text-gray-400">
        Last updated: {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
      </p>

      <section className="mt-10 space-y-6 text-sm leading-relaxed text-gray-300">
        <p>
          This policy explains what data AI Video Ads collects, why, and how it's used.
        </p>

        <div>
          <h2 className="text-lg font-semibold text-white">1. Data we collect</h2>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>Account data: email, display name, profile photo (from Supabase Auth or your OAuth provider).</li>
            <li>Usage data: ads you generate, projects you save, credits used.</li>
            <li>Billing data: Stripe customer and subscription IDs. We never store full card details.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-white">2. How we use it</h2>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>To provide the service: authentication, generation, billing, support.</li>
            <li>To improve reliability via aggregated, anonymised metrics.</li>
            <li>To send essential service notices (no marketing emails without consent).</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-white">3. Subprocessors</h2>
          <p className="mt-2">
            We use Supabase (auth & storage), Neon (database), Stripe (payments), and Google Gemini (AI generation).
            Each is GDPR-compliant; data sent to them is the minimum required to operate.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-white">4. Your rights</h2>
          <p className="mt-2">
            You can export or delete your account data at any time from your account settings, or by emailing support.
            Cancelling your subscription does not delete your data.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-white">5. Cookies</h2>
          <p className="mt-2">
            We only use cookies required for sign-in sessions. We don't use third-party advertising trackers.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-white">6. Contact</h2>
          <p className="mt-2">
            Privacy questions or data requests? Email the support address shown in your account settings.
          </p>
        </div>
      </section>
    </main>
  )
}
