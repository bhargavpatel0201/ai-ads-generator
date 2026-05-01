export default function Terms() {
  return (
    <main className="mx-auto max-w-3xl px-4 pt-28 pb-16 text-gray-200 md:px-8">
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Terms of Service</h1>
      <p className="mt-3 text-sm text-gray-400">
        Last updated: {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
      </p>

      <section className="mt-10 space-y-6 text-sm leading-relaxed text-gray-300">
        <p>
          Welcome to AI Video Ads. By creating an account or using the service you agree to these terms. If you do not
          agree, do not use the service.
        </p>

        <div>
          <h2 className="text-lg font-semibold text-white">1. Your account</h2>
          <p className="mt-2">
            You are responsible for keeping your sign-in credentials secure and for all activity under your account.
            You must be at least 13 years old to create an account.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-white">2. Generated content</h2>
          <p className="mt-2">
            You retain rights to ads, scripts, and renders you generate, subject to the licences of the underlying AI
            models. You must not generate content that is unlawful, defamatory, or infringes someone else's rights.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-white">3. Subscriptions and credits</h2>
          <p className="mt-2">
            Paid plans renew monthly until cancelled. Credits granted by your plan reset on each renewal and do not
            roll over. You can manage or cancel your subscription anytime from the Stripe billing portal.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-white">4. Acceptable use</h2>
          <p className="mt-2">
            Don't abuse the service: no scraping, reverse engineering, attempting to bypass rate limits, or using the
            output to train competing models.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-white">5. Disclaimer</h2>
          <p className="mt-2">
            The service is provided "as is" without warranties of any kind. We are not liable for any indirect or
            consequential damages arising from your use of the service.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-white">6. Contact</h2>
          <p className="mt-2">
            Questions? Reach out via the support email shown in your account settings.
          </p>
        </div>
      </section>
    </main>
  )
}
