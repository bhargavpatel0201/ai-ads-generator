import FaqSection from '../sections/faq-section'
import CallToAction from '../sections/call-to-action'

export default function Faq() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:py-10">
      <div className="fixed inset-0 overflow-hidden -z-20 pointer-events-none">
        <div className="absolute rounded-full top-80 left-2/5 -translate-x-1/2 size-130 bg-[#D10A8A] blur-[100px]" />
        <div className="absolute rounded-full top-80 right-0 -translate-x-1/2 size-130 bg-[#2E08CF] blur-[100px]" />
        <div className="absolute rounded-full top-0 left-1/2 -translate-x-1/2 size-130 bg-[#F26A06] blur-[100px]" />
      </div>

      <section className="glass rounded-2xl border border-white/20 p-6 md:p-10">
        <div className="text-center">
          <h1 className="text-3xl font-semibold md:text-4xl">Frequently Asked Questions</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-gray-300">
            Everything you need to know about generating LinkedIn posts and header images with Gemini, Replicate SDXL,
            and Sharp.
          </p>
        </div>

        <FaqSection />

        <CallToAction />
      </section>
    </div>
  )
}
