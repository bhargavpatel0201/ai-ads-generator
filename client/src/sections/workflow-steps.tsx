import type { ReactElement } from 'react'
import { motion } from 'framer-motion'
import SectionTitle from '../components/section-title'

/**
 * Inline SVG illustrations replace the previous Unsplash photos. Each one is a
 * stylised glance of the actual UI for that step (form input → AI variants + image
 * → share page / LinkedIn card). Self-contained, theme-matched, no external HTTP.
 */

function StepDescribe() {
  return (
    <svg viewBox="0 0 480 320" className="h-auto w-full max-w-sm rounded-2xl bg-[#1a1330] shadow-xl shadow-black/30" role="img" aria-label="Topic, tone, and keywords being entered into a form">
      <defs>
        <linearGradient id="w1-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3b1d6e" />
          <stop offset="100%" stopColor="#0f0a1f" />
        </linearGradient>
        <linearGradient id="w1-cta" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      <rect width="480" height="320" fill="url(#w1-bg)" />
      <rect x="32" y="32" width="416" height="256" rx="18" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.16)" />
      <text x="56" y="68" fill="#e9d5ff" fontFamily="ui-sans-serif, system-ui" fontSize="11" fontWeight="600">TOPIC</text>
      <rect x="56" y="78" width="368" height="34" rx="9" fill="rgba(255,255,255,0.08)" stroke="rgba(168,85,247,0.7)" />
      <text x="68" y="100" fill="#fff" fontFamily="ui-sans-serif, system-ui" fontSize="13">Why CS degrees still matter in 2026</text>
      <text x="56" y="138" fill="#e9d5ff" fontFamily="ui-sans-serif, system-ui" fontSize="11" fontWeight="600">TONE</text>
      <g fontFamily="ui-sans-serif, system-ui" fontSize="11">
        <rect x="56" y="148" width="86" height="28" rx="8" fill="rgba(168,85,247,0.85)" />
        <text x="76" y="166" fill="#fff" fontWeight="600">Hot take</text>
        <rect x="150" y="148" width="86" height="28" rx="8" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)" />
        <text x="170" y="166" fill="#e2d9ff">Story</text>
        <rect x="244" y="148" width="86" height="28" rx="8" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)" />
        <text x="254" y="166" fill="#e2d9ff">Casual</text>
        <rect x="338" y="148" width="86" height="28" rx="8" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)" />
        <text x="346" y="166" fill="#e2d9ff">Pro</text>
      </g>
      <text x="56" y="206" fill="#e9d5ff" fontFamily="ui-sans-serif, system-ui" fontSize="11" fontWeight="600">KEYWORDS</text>
      <rect x="56" y="216" width="368" height="30" rx="9" fill="rgba(255,255,255,0.06)" />
      <text x="68" y="236" fill="rgba(255,255,255,0.6)" fontFamily="ui-sans-serif, system-ui" fontSize="12">AI, education, careers</text>
      <rect x="56" y="260" width="368" height="20" rx="10" fill="url(#w1-cta)" />
      <text x="240" y="274" fill="#fff" fontFamily="ui-sans-serif, system-ui" fontSize="11" fontWeight="700" textAnchor="middle">✨ Generate post + image</text>
    </svg>
  )
}

function StepGenerate() {
  return (
    <svg viewBox="0 0 480 320" className="h-auto w-full max-w-sm rounded-2xl bg-[#1a1330] shadow-xl shadow-black/30" role="img" aria-label="Three post variants and a generated banner image">
      <defs>
        <linearGradient id="w2-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1f1146" />
          <stop offset="100%" stopColor="#0a0716" />
        </linearGradient>
        <linearGradient id="w2-banner" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="55%" stopColor="#db2777" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
      </defs>
      <rect width="480" height="320" fill="url(#w2-bg)" />
      <rect x="28" y="28" width="424" height="120" rx="14" fill="url(#w2-banner)" />
      <rect x="28" y="100" width="424" height="48" rx="0" fill="rgba(0,0,0,0.55)" />
      <text x="44" y="130" fill="#fff" fontFamily="ui-sans-serif, system-ui" fontSize="14" fontWeight="700">Why CS degrees still matter in 2026</text>
      <text x="436" y="142" fill="rgba(255,255,255,0.6)" fontFamily="ui-sans-serif, system-ui" fontSize="8" textAnchor="end">AI LinkedIn Studio</text>
      <g fontFamily="ui-sans-serif, system-ui" fontSize="10">
        <rect x="28" y="164" width="92" height="22" rx="11" fill="#fff" />
        <text x="74" y="180" fill="#1f1146" fontWeight="700" textAnchor="middle">Hot take · 2,840</text>
        <rect x="128" y="164" width="92" height="22" rx="11" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)" />
        <text x="174" y="180" fill="#e2d9ff" textAnchor="middle">Story · 2,612</text>
        <rect x="228" y="164" width="92" height="22" rx="11" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)" />
        <text x="274" y="180" fill="#e2d9ff" textAnchor="middle">Framework · 2,310</text>
      </g>
      <rect x="28" y="200" width="424" height="92" rx="12" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.12)" />
      <g fill="rgba(229,222,255,0.85)" fontFamily="ui-sans-serif, system-ui" fontSize="10">
        <rect x="44" y="216" width="392" height="6" rx="3" fill="rgba(255,255,255,0.18)" />
        <rect x="44" y="232" width="360" height="6" rx="3" fill="rgba(255,255,255,0.14)" />
        <rect x="44" y="248" width="376" height="6" rx="3" fill="rgba(255,255,255,0.14)" />
        <rect x="44" y="264" width="220" height="6" rx="3" fill="rgba(255,255,255,0.18)" />
      </g>
      <g fontFamily="ui-sans-serif, system-ui" fontSize="9" fontWeight="600">
        <rect x="44" y="278" width="60" height="10" rx="5" fill="rgba(99,102,241,0.85)" />
        <text x="74" y="286" fill="#fff" textAnchor="middle">#BuildInPublic</text>
        <rect x="112" y="278" width="46" height="10" rx="5" fill="rgba(168,85,247,0.85)" />
        <text x="135" y="286" fill="#fff" textAnchor="middle">#WebDev</text>
        <rect x="166" y="278" width="22" height="10" rx="5" fill="rgba(236,72,153,0.85)" />
        <text x="177" y="286" fill="#fff" textAnchor="middle">#AI</text>
      </g>
    </svg>
  )
}

function StepShare() {
  return (
    <svg viewBox="0 0 480 320" className="h-auto w-full max-w-sm rounded-2xl bg-[#1a1330] shadow-xl shadow-black/30" role="img" aria-label="LinkedIn share preview card pulled from the OG meta tags of the share page">
      <defs>
        <linearGradient id="w3-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0a1a3a" />
          <stop offset="100%" stopColor="#040814" />
        </linearGradient>
        <linearGradient id="w3-card" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
      </defs>
      <rect width="480" height="320" fill="url(#w3-bg)" />
      <rect x="32" y="34" width="416" height="36" rx="10" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.14)" />
      <circle cx="52" cy="52" r="6" fill="#22c55e" />
      <text x="68" y="56" fill="#cbe2ff" fontFamily="ui-monospace, monospace" fontSize="11">https://your-app.com/share/k7Hx9p2qLm</text>
      <rect x="404" y="44" width="32" height="16" rx="4" fill="rgba(34,197,94,0.18)" stroke="rgba(34,197,94,0.6)" />
      <text x="420" y="55" fill="#86efac" fontFamily="ui-sans-serif, system-ui" fontSize="9" fontWeight="700" textAnchor="middle">OG ✓</text>
      <rect x="32" y="90" width="416" height="206" rx="14" fill="#0d1117" stroke="rgba(255,255,255,0.1)" />
      <rect x="32" y="90" width="416" height="124" rx="14" fill="url(#w3-card)" />
      <rect x="32" y="160" width="416" height="54" fill="rgba(0,0,0,0.55)" />
      <text x="48" y="190" fill="#fff" fontFamily="ui-sans-serif, system-ui" fontSize="13" fontWeight="700">Why CS degrees still matter in 2026</text>
      <g fontFamily="ui-sans-serif, system-ui">
        <text x="48" y="234" fill="rgba(255,255,255,0.85)" fontSize="11" fontWeight="600">your-app.com</text>
        <text x="48" y="250" fill="rgba(255,255,255,0.65)" fontSize="10">Three angles · banner ready · ~$0.002</text>
        <text x="48" y="278" fill="rgba(120,180,255,0.95)" fontSize="11" fontWeight="700">Like</text>
        <text x="92" y="278" fill="rgba(120,180,255,0.95)" fontSize="11" fontWeight="700">Comment</text>
        <text x="160" y="278" fill="rgba(120,180,255,0.95)" fontSize="11" fontWeight="700">Share</text>
        <text x="208" y="278" fill="rgba(120,180,255,0.95)" fontSize="11" fontWeight="700">Send</text>
      </g>
    </svg>
  )
}

const steps: { id: number; title: string; description: string; Illustration: () => ReactElement }[] = [
  {
    id: 1,
    title: 'Describe your idea',
    description:
      'Type a topic, pick a tone (or hit Auto-pick and let Gemini choose), drop in optional keywords, and select a format — banner, square, or portrait.',
    Illustration: StepDescribe,
  },
  {
    id: 2,
    title: 'Generate 3 variants + a topic-aware image',
    description:
      'One Gemini call returns three labelled post variants. Replicate SDXL paints a banner with a topic-aware prompt and random seed. Sharp burns the title and a faint watermark on top — no in-image AI text artifacts.',
    Illustration: StepGenerate,
  },
  {
    id: 3,
    title: 'Share with a real preview card',
    description:
      'Click Get share link to save a public /share/:id page on Neon with full OG meta tags. Paste the URL anywhere — LinkedIn, Slack, Twitter — and you get a real preview card. Or download the PDF / copy the bundle in one click.',
    Illustration: StepShare,
  },
]

export default function WorkflowSteps() {
  return (
    <section className="mt-32 relative" id="how-it-works">
      <SectionTitle
        title="Your LinkedIn post in 3 steps"
        description="From topic to a publish-ready post, banner image, and shareable preview link — without leaving the page."
      />

      <motion.div
        className="relative space-y-20 md:space-y-30 mt-20"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex-col items-center hidden md:flex absolute left-1/2 -translate-x-1/2">
          <p className="flex items-center justify-center font-medium my-10 aspect-square bg-black/15 p-2 rounded-full">01</p>
          <div className="h-72 w-0.5 bg-linear-to-b from-transparent via-white to-transparent" />
          <p className="flex items-center justify-center font-medium my-10 aspect-square bg-black/15 p-2 rounded-full">02</p>
          <div className="h-72 w-0.5 bg-linear-to-b from-transparent via-white to-transparent" />
          <p className="flex items-center justify-center font-medium my-10 aspect-square bg-black/15 p-2 rounded-full">03</p>
        </div>
        {steps.map((step, index) => {
          const { Illustration } = step
          return (
            <motion.div
              key={step.id}
              className={`flex items-center justify-center gap-6 md:gap-20 ${
                index % 2 !== 0 ? 'flex-col md:flex-row-reverse' : 'flex-col md:flex-row'
              }`}
              initial={{ y: 150, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15, type: 'spring', stiffness: 320, damping: 70, mass: 1 }}
            >
              <div className="flex-1 flex justify-center w-full">
                <Illustration />
              </div>
              <div className="flex-1 flex flex-col gap-6 md:px-6 max-w-md">
                <h3 className="text-2xl font-medium text-white">{step.title}</h3>
                <p className="text-gray-100 text-sm/6 pb-2">{step.description}</p>
              </div>
            </motion.div>
          )
        })}
      </motion.div>
    </section>
  )
}
