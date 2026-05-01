import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Scrolls to `#anchor` after a route change. React Router doesn't do this by default.
 * On `/`, Lenis handles in-page anchors; on other routes a `/#anchor` link first navigates
 * here, then scrolls.
 */
export default function ScrollToHash() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      return
    }
    const id = hash.replace('#', '')
    let attempts = 0
    const tryScroll = () => {
      const el = document.getElementById(id)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
      attempts += 1
      if (attempts < 20) requestAnimationFrame(tryScroll)
    }
    tryScroll()
  }, [pathname, hash])

  return null
}
