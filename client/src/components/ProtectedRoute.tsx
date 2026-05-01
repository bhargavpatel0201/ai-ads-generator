import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { safeNextPath } from '../lib/nav'

type Props = { children: ReactNode }

/**
 * Requires a loaded auth session before rendering children.
 * Unauthenticated users go to sign-in with ?next= preserved.
 */
export default function ProtectedRoute({ children }: Props) {
  const { user, loading, configured } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-sm text-gray-400">
        Loading…
      </div>
    )
  }

  if (!configured || !user) {
    const next = safeNextPath(`${location.pathname}${location.search}`)
    return <Navigate to={`/sign-in?next=${encodeURIComponent(next)}`} replace />
  }

  return <>{children}</>
}
