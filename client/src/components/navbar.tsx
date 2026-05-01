import { MenuIcon, XIcon, LogOutIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import UserMenu from './UserMenu'

export default function Navbar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  /** Logo click — when we're already on "/" Link won't navigate (no URL change),
   *  so ScrollToHash never runs. Smooth-scroll to the top ourselves in that case. */
  function handleLogoClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (location.pathname === '/' && !location.hash) {
      e.preventDefault()
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
    }
  }

  const links = [
    { name: 'Home', href: '/' },
    { name: 'Create', href: '/create' },
    { name: 'Community', href: '/community' },
    { name: 'Plans', href: '/plans' },
    { name: 'FAQ', href: '/faq' },
  ] as const

  async function handleSignOut() {
    await signOut()
    navigate('/', { replace: true })
  }

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <>
      <motion.nav
        className={`sticky top-0 z-50 flex w-full items-center justify-between px-4 py-3.5 md:px-16 lg:px-24 transition-colors ${
          isScrolled ? 'bg-white/15 backdrop-blur-lg' : ''
        }`}
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ type: 'spring', stiffness: 250, damping: 70, mass: 1 }}
      >
        <Link
          to="/"
          onClick={handleLogoClick}
          className="flex items-center gap-2 text-xl font-semibold tracking-wide"
          aria-label="AI LinkedIn Studio — back to top"
        >
          <img src="/assets/logo-icon.png" alt="App logo" className="h-9 w-9 shrink-0 rounded-md object-cover" />
          AI LinkedIn Studio
        </Link>

        <div className="hidden items-center space-x-10 md:flex">
          {links.map((link) => (
            <Link key={link.name} to={link.href} className="transition hover:text-gray-300">
              {link.name}
            </Link>
          ))}
          {user ? (
            <UserMenu />
          ) : (
            <>
              <Link to="/sign-in" className="text-sm text-gray-300 transition hover:text-white">
                Sign in
              </Link>
              <Link to="/sign-up" className="btn glass">
                Get started
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="transition active:scale-90 md:hidden"
          aria-label="Open menu"
          title="Open menu"
        >
          <MenuIcon className="size-6.5" />
        </button>
      </motion.nav>

      <div
        className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black/20 text-lg font-medium backdrop-blur-2xl transition duration-300 md:hidden ${
          isOpen ? 'pointer-events-auto translate-x-0' : 'pointer-events-none -translate-x-full'
        }`}
      >
        {links.map((link) => (
          <Link key={link.name} to={link.href} onClick={() => setIsOpen(false)}>
            {link.name}
          </Link>
        ))}

        {user ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-lg"
            onClick={() => {
              setIsOpen(false)
              void handleSignOut()
            }}
          >
            <LogOutIcon className="size-5" />
            Sign out
          </button>
        ) : (
          <>
            <Link to="/sign-in" className="text-lg" onClick={() => setIsOpen(false)}>
              Sign in
            </Link>
            <Link to="/sign-up" className="btn glass" onClick={() => setIsOpen(false)}>
              Get started
            </Link>
          </>
        )}

        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="rounded-md p-2 glass"
          aria-label="Close menu"
          title="Close menu"
        >
          <XIcon />
        </button>
      </div>
    </>
  )
}
