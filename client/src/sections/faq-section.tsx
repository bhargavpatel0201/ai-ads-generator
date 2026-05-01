import SectionTitle from '../components/section-title'
import { ChevronDownIcon } from 'lucide-react'
import { useState } from 'react'
import { motion } from 'framer-motion'

export default function FaqSection() {
  const [isOpen, setIsOpen] = useState<number | null>(null)
  const data = [
    {
      question: 'How does AI LinkedIn Studio create the post and image?',
      answer:
        'Enter a topic, pick a tone, and (optionally) keywords + image style. The server calls Gemini for the post text, Replicate SDXL for a 1200×624 banner, then Sharp burns your topic onto the image so the header reads cleanly on LinkedIn.',
    },
    {
      question: 'What goes into a good topic, tone, and keywords?',
      answer:
        'Topic = the angle (e.g. “Why CS degrees still matter in 2026”). Tone = Professional, Casual, Controversial, or Storytelling. Keywords are optional but help the image: words like “AI”, “ecommerce”, “startup”, “code”, or “leadership” steer the visual to a matching style.',
    },
    {
      question: 'Why do my images look different each time, even for the same topic?',
      answer:
        'Each request uses a random seed and topic-aware prompt mapping, so SDXL takes a different path through latent space. That’s deliberate — it keeps your headers from looking identical run to run.',
    },
    {
      question: 'Can I pick the look of the image?',
      answer:
        'Yes. Use the Image Style selector — Auto, Minimal, Corporate, Cyberpunk, Isometric, or 3D Render. Auto picks a style from your topic; the others append a presentation layer to the prompt.',
    },
    {
      question: 'How do I post the result to LinkedIn?',
      answer:
        'Click “Copy for LinkedIn” to copy the text and open the LinkedIn feed, then “Download image” to save the banner. In the LinkedIn composer, paste the text and attach the downloaded PNG.',
    },
    {
      question: 'How much does each generation cost?',
      answer:
        'Roughly $0.002 per run — Gemini text is free at small scale; the cost is one Replicate SDXL image. Check your Replicate dashboard for current pricing and usage.',
    },
    {
      question: 'Are my API keys safe?',
      answer:
        'Yes. Gemini and Replicate keys live only in server/.env. The browser only ever sees the generated post and the image URL or PNG — never the keys.',
    },
  ]

  return (
    <section className="mt-32" id="faq">
      <SectionTitle
        title="FAQ"
        description="Common questions about generating LinkedIn posts and header images with Gemini, Replicate SDXL, and Sharp."
      />
      <div className="mx-auto mt-12 space-y-4 w-full max-w-xl">
        {data.map((item, index) => (
          <motion.div
            key={index}
            className="flex flex-col glass rounded-md"
            initial={{ y: 150, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.15, type: 'spring', stiffness: 320, damping: 70, mass: 1 }}
          >
            <h3
              className="flex cursor-pointer hover:bg-white/10 transition items-start justify-between gap-4 p-4 font-medium"
              onClick={() => setIsOpen(isOpen === index ? null : index)}
            >
              {item.question}
              <ChevronDownIcon
                className={`size-5 transition-all shrink-0 duration-400 ${isOpen === index ? 'rotate-180' : ''}`}
              />
            </h3>
            <p
              className={`px-4 text-sm/6 transition-all duration-400 overflow-hidden ${
                isOpen === index ? 'pt-2 pb-4 max-h-80' : 'max-h-0'
              }`}
            >
              {item.answer}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
