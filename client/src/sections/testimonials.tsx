import SectionTitle from '../components/section-title'
import { motion } from 'framer-motion'
import { useRef } from 'react'

export default function Testimonials() {
  const ref = useRef<(HTMLDivElement | null)[]>([])
  const data: { review: string; name: string; about: string; image: string }[] = [
    {
      review:
        'I went from a blank page to a publish-ready post in under a minute. The 3-variant tabs gave me angles I would not have written myself.',
      name: 'Aarav Shah',
      about: 'Indie Founder',
      image: 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=200',
    },
    {
      review:
        'The header image actually matches the topic now — no more generic neon rooms. The Cyberpunk style is my new default for hot takes.',
      name: 'Sophia Martin',
      about: 'Content Marketer',
      image: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200',
    },
    {
      review:
        'Solid full-stack reference: Gemini for text, Replicate for image, Sharp for the overlay. Server-side keys, rate limited, even has tests.',
      name: 'Rahul Verma',
      about: 'Full Stack Developer',
      image: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=200&auto=format&fit=crop&q=60',
    },
  ]

  return (
    <section className="mt-32 flex flex-col items-center">
      <SectionTitle
        title="What users say about AI LinkedIn Studio"
        description="Real feedback from builders, marketers, and founders shipping LinkedIn posts."
      />
      <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {data.map((item, index) => (
          <motion.div
            key={index}
            className="w-full max-w-88 space-y-5 rounded-lg glass p-5 hover:-translate-y-1"
            initial={{ y: 150, opacity: 0 }}
            ref={(el) => {
              ref.current[index] = el
            }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.15, type: 'spring', stiffness: 320, damping: 70, mass: 1 }}
            onAnimationComplete={() => {
              const card = ref.current[index]
              if (card) card.classList.add('transition', 'duration-300')
            }}
          >
            <div className="flex items-center justify-between">
              <p className="font-medium">{item.about}</p>
              <img className="size-10 rounded-full" src={item.image} alt={item.name} />
            </div>
            <p className="line-clamp-3">&quot;{item.review}&quot;</p>
            <p className="text-gray-300">- {item.name}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
