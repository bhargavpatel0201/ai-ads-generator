import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import '../../styles/authkit.css'

type Props = {
  activeTab: 'in' | 'up'
  showTabs?: boolean
  children: ReactNode
  /** e.g. ?next=/create — preserved when switching to sign-up */
  searchSuffix?: string
}

export default function AuthShell({ activeTab, showTabs = true, children, searchSuffix = '' }: Props) {
  const s = searchSuffix

  return (
    <div className="authkit-page font-sans text-white">
      {/* Same floating blur orbs as LandingPage / hero */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden>
        <div className="absolute rounded-full top-80 left-2/5 -translate-x-1/2 size-130 bg-[#D10A8A] blur-[100px]" />
        <div className="absolute rounded-full top-80 right-0 -translate-x-1/2 size-130 bg-[#2E08CF] blur-[100px]" />
        <div className="absolute rounded-full top-0 left-1/2 -translate-x-1/2 size-130 bg-[#F26A06] blur-[100px]" />
      </div>

      <div className="ak-wrap">
        <div className="ak-brand">
          <Link to="/" title="Home" aria-label="AI LinkedIn Studio — home">
            <div className="ak-brand-mark">
              <img src="/assets/logo-icon.png" alt="" className="h-7 w-7 rounded-md object-cover" />
            </div>
            <span className="ak-brand-name">AI LinkedIn Studio</span>
          </Link>
        </div>

        <div className="ak-card">
          {showTabs && (
            <div className="ak-tabs" role="tablist">
              <Link
                className={`ak-tab${activeTab === 'in' ? ' ak-active' : ''}`}
                to={`/sign-in${s}`}
                aria-current={activeTab === 'in' ? 'true' : undefined}
                role="tab"
              >
                Sign In
              </Link>
              <Link
                className={`ak-tab${activeTab === 'up' ? ' ak-active' : ''}`}
                to={`/sign-up${s}`}
                aria-current={activeTab === 'up' ? 'true' : undefined}
                role="tab"
              >
                Sign Up
              </Link>
            </div>
          )}

          {children}
        </div>
      </div>
    </div>
  )
}
