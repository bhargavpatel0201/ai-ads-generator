import SectionTitle from '../components/section-title'
import { SparklesIcon, PenLine, Image as ImageIcon, Server, Share2, KeyRound, type LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import { useRef } from 'react'

export default function Features() {
  const refs = useRef<(HTMLDivElement | null)[]>([])

  const featuresData: { icon: LucideIcon; title: string; description: string }[] = [
    {
      icon: PenLine,
      title: 'Topic → full post',
      description:
        'Describe a topic, tone, and keywords. Gemini returns a hook, tight paragraphs, a discussion question, and three hashtags.',
    },
    {
      icon: ImageIcon,
      title: 'LinkedIn-sized hero image',
      description:
        'Replicate SDXL renders abstract tech art at 1200×624 so you have a visual to attach — no Gemini image quota on the free image model.',
    },
    {
      icon: SparklesIcon,
      title: 'Text + image in one flow',
      description:
        'One API call from the app: post body plus image URL. Copy everything to the clipboard when you are ready to publish.',
    },
    {
      icon: Server,
      title: 'Server-side AI keys',
      description:
        'Gemini and Replicate tokens live in server/.env. The browser never sees them — good for class demos and production hygiene.',
    },
    {
      icon: KeyRound,
      title: 'Provider flexibility',
      description:
        'Same Express stack you can extend: swap SDXL for another Replicate model or change Gemini text model via GEMINI_TEXT_MODEL.',
    },
    {
      icon: Share2,
      title: 'Built for LinkedIn',
      description:
        'Workflow is optimized for feed posts: professional or casual tone, readable structure, and imagery without fake logos or watermarks.',
    },
  ]

  return (
    <section className="mt-32" id="features">
      <SectionTitle
        title="LinkedIn generator features"
        description="One server route combines Gemini text and Replicate imagery — tuned for posts you can paste into LinkedIn today."
      />

      <div className="flex flex-wrap items-center justify-center gap-6 mt-10 px-6">
        {featuresData.map((feature, index) => {
          const FeatureIcon = feature.icon
          return (
            <motion.div
              key={index}
              ref={(el) => {
                refs.current[index] = el
              }}
              className="hover:-translate-y-0.5 p-6 rounded-xl space-y-4 glass max-w-80 w-full"
              initial={{ y: 150, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15, type: 'spring', stiffness: 320, damping: 70, mass: 1 }}
              onAnimationComplete={() => {
                const card = refs.current[index]
                if (card) card.classList.add('transition', 'duration-300')
              }}
            >
              <FeatureIcon className="size-8.5" />
              <h3 className="text-base font-medium text-white">{feature.title}</h3>
              <p className="text-gray-100 text-sm/6 pb-2">{feature.description}</p>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
