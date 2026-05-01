import PricingPlans from '../sections/pricing-plans'
import CallToAction from '../sections/call-to-action'

export default function Plans() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 md:py-14">
      <div className="fixed inset-0 -z-20 overflow-hidden pointer-events-none">
        <div className="absolute left-2/5 top-80 size-130 -translate-x-1/2 rounded-full bg-[#D10A8A] blur-[100px]" />
        <div className="absolute right-0 top-80 size-130 -translate-x-1/2 rounded-full bg-[#2E08CF] blur-[100px]" />
        <div className="absolute left-1/2 top-0 size-130 -translate-x-1/2 rounded-full bg-[#F26A06] blur-[100px]" />
      </div>

      {/* No extra glass box — title + cards match reference (structure on dark + blurs) */}
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">Pricing Plans</h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-zinc-400 md:text-[15px]">
          Our Pricing Plans are simple, transparent and flexible. Choose the plan that best suits your needs.
        </p>
      </div>

      <PricingPlans showHeading={false} />

      <div className="mt-16">
        <CallToAction />
      </div>
    </div>
  )
}
