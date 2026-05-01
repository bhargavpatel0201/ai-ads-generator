import { motion } from 'framer-motion'
import { Link, useLocation } from 'react-router-dom'

type FooterLink = { name: string; to: string }

export default function Footer() {
  const { pathname } = useLocation()
  const onLanding = pathname === '/'

  const productLinks: FooterLink[] = [
    { name: 'Features', to: onLanding ? '#features' : '/#features' },
    { name: 'How it works', to: onLanding ? '#how-it-works' : '/#how-it-works' },
    { name: 'Pricing', to: '/plans' },
    { name: 'FAQ', to: '/faq' },
  ]

  const legalLinks: FooterLink[] = [
    { name: 'Terms of Service', to: '/terms' },
    { name: 'Privacy Policy', to: '/privacy' },
  ]

  function renderLink(link: FooterLink) {
    if (link.to.startsWith('#')) {
      return (
        <a href={link.to} className="text-gray-300 transition hover:text-white">
          {link.name}
        </a>
      )
    }
    return (
      <Link to={link.to} className="text-gray-300 transition hover:text-white">
        {link.name}
      </Link>
    )
  }

  return (
    <motion.footer
      className="w-full mt-40 border-t border-white/10 bg-black/40 backdrop-blur-xl"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      <div className="mx-auto max-w-6xl px-4 py-14 md:px-8 lg:px-12">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-3 lg:gap-10">
          <div className="space-y-4">
            <Link to="/" className="inline-flex items-center gap-2 text-xl font-semibold tracking-wide">
              <img
                src="/assets/logo-icon.png"
                alt="App logo"
                className="h-9 w-9 shrink-0 rounded-md object-cover"
              />
              AI LinkedIn Studio
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-gray-400">
              Generate LinkedIn-ready copy with Gemini and a 1200×624 header image with Replicate — all through your own
              server so keys stay private.
            </p>
          </div>

          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Product</p>
            <ul className="space-y-3 text-sm">
              {productLinks.map((link) => (
                <li key={link.to}>{renderLink(link)}</li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Legal</p>
            <ul className="space-y-3 text-sm">
              {legalLinks.map((link) => (
                <li key={link.to}>{renderLink(link)}</li>
              ))}
            </ul>
          </div>
        </div>

        <hr className="mt-12 border-white/10" />

        <div className="flex justify-center py-6 text-center text-xs text-gray-500">
          <p>Copyright {new Date().getFullYear()} AI LinkedIn Studio. All rights reserved.</p>
        </div>
      </div>
    </motion.footer>
  )
}
