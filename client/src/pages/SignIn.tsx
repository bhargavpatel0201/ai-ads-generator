import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { EyeIcon, EyeOffIcon, LockIcon, MailIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { safeNextPath } from '../lib/nav'
import AuthShell from '../components/auth/AuthShell'
import { isOAuthSectionVisible, signInWithOAuth } from '../components/auth/oauthSupabase'

function GoogleIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M5.27 9.76A7.08 7.08 0 0 1 12 4.92c1.7 0 3.24.63 4.44 1.67l2.73-2.73A11 11 0 0 0 12 1 11 11 0 0 0 2.17 7.38L5.27 9.76z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-1.05 7.28-2.77l-2.9-2.25A7.04 7.04 0 0 1 12 19.08a7.07 7.07 0 0 1-6.73-4.85l-3.1 2.38A11 11 0 0 0 12 23z"
      />
      <path
        fill="#4A90D9"
        d="M19.28 20.23C21.05 18.5 22 16.07 22 13c0-.68-.06-1.34-.18-1.96H12v3.7h5.74a4.8 4.8 0 0 1-2.1 3.2l2.9 2.25-.26.04z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.23A7.15 7.15 0 0 1 4.92 12c0-.77.13-1.52.35-2.24L2.17 7.38A11.02 11.02 0 0 0 1 12c0 1.72.4 3.34 1.17 4.77l3.1-2.54z"
      />
    </svg>
  )
}

export default function SignIn() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const next = safeNextPath(searchParams.get('next'))
  const nextQuery = searchParams.toString() ? `?${searchParams.toString()}` : ''

  const [mode, setMode] = useState<'in' | 'forgot'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [ieErr, setIeErr] = useState(false)
  const [ipErr, setIpErr] = useState(false)
  const [feErr, setFeErr] = useState(false)
  const [emailUnconfirmed, setEmailUnconfirmed] = useState(false)
  const [resendBusy, setResendBusy] = useState(false)

  const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

  function isUnconfirmedEmailError(err: { message?: string; code?: string } | null) {
    if (!err) return false
    const m = (err.message || '').toLowerCase()
    const c = (err.code || '').toLowerCase()
    return (
      c === 'email_not_confirmed' ||
      m.includes('email not confirmed') ||
      m.includes('email address not confirmed')
    )
  }

  async function handleResendConfirmation() {
    if (!isSupabaseConfigured || !isEmail(email.trim())) {
      toast.error('Enter your email address above first.')
      return
    }
    setResendBusy(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/` },
      })
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success('Check your inbox for a new confirmation link (and spam).')
    } finally {
      setResendBusy(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isSupabaseConfigured) {
      toast.error('Supabase is not configured (missing env keys).')
      return
    }
    setEmailUnconfirmed(false)
    setIeErr(!isEmail(email.trim()))
    setIpErr(password.length === 0)
    if (!isEmail(email.trim()) || !password) return

    setSubmitting(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) {
        if (isUnconfirmedEmailError(error)) {
          setEmailUnconfirmed(true)
          toast.error('Confirm your email first — we sent a link when you signed up. Use the button below to resend.')
          return
        }
        toast.error(error.message)
        return
      }
      if (!data.session) {
        toast.error(
          'No active session. Confirm your email, or in Supabase disable “Confirm email” for local development.'
        )
        return
      }
      await supabase.auth.getSession()
      toast.success('Signed in')
      navigate(next, { replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign in failed. Please try again.'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    if (!isSupabaseConfigured) {
      toast.error('Supabase is not configured.')
      return
    }
    const v = forgotEmail.trim()
    setFeErr(!isEmail(v))
    if (!isEmail(v)) return
    setSubmitting(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(v, {
        redirectTo: `${window.location.origin}/sign-in`,
      })
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success('Check your email for a reset link.')
      setMode('in')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not send reset link. Please try again.'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (mode === 'forgot') {
    return (
      <AuthShell activeTab="in" showTabs={false} searchSuffix={nextQuery}>
        <div className="ak-screen">
          <div className="ak-head">
            <h1>Reset password</h1>
            <p>Enter your email and we&apos;ll send a reset link.</p>
          </div>

          <form onSubmit={handleForgot} className="ak-screen">
            <div className="ak-field" style={{ marginTop: 8 }}>
              <label className="ak-label" htmlFor="fe">
                Email address
              </label>
              <div className={`ak-input-wrap${feErr ? ' ak-err' : ''}`}>
                <span className="ak-ico">
                  <MailIcon size={14} strokeWidth={2} />
                </span>
                <input
                  id="fe"
                  className="ak-input"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={forgotEmail}
                  onChange={(e) => {
                    setForgotEmail(e.target.value)
                    setFeErr(false)
                  }}
                />
              </div>
              {feErr && <p className="ak-errmsg">Enter a valid email address.</p>}
            </div>

            <button type="submit" className="ak-btn" disabled={submitting}>
              {submitting ? <div className="ak-spin" /> : 'Send reset link →'}
            </button>
          </form>

          <div className="ak-foot" style={{ marginTop: 18 }}>
            <button type="button" className="ak-link" onClick={() => setMode('in')}>
              ← Back to Sign In
            </button>
          </div>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell activeTab="in" searchSuffix={nextQuery}>
      <div className="ak-screen">
        <div className="ak-head">
          <h1>Welcome back</h1>
          <p>Sign in to your account to continue.</p>
        </div>

        {!isSupabaseConfigured && (
          <p className="ak-banner">
            Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in <code>client/.env</code>, and{' '}
            <code>SUPABASE_URL</code> / <code>SUPABASE_ANON_KEY</code> in <code>server/.env</code>, then restart both
            processes.
          </p>
        )}

        {isOAuthSectionVisible() && (
          <>
            <div className="ak-socials">
              <button
                type="button"
                className="ak-social"
                onClick={() => void signInWithOAuth('google')}
                disabled={!isSupabaseConfigured}
              >
                <GoogleIcon /> Continue with Google
              </button>
            </div>
            <div className="ak-div">or email</div>
          </>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="ak-field">
            <label className="ak-label" htmlFor="signin-email">
              Email address
            </label>
            <div className={`ak-input-wrap${ieErr ? ' ak-err' : ''}`}>
              <span className="ak-ico">
                <MailIcon size={14} strokeWidth={2} />
              </span>
              <input
                id="signin-email"
                className="ak-input"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setIeErr(false)
                  setEmailUnconfirmed(false)
                }}
              />
            </div>
            {ieErr && <p className="ak-errmsg">Enter a valid email address.</p>}
          </div>

          <div className="ak-field">
            <div className="ak-input-row">
              <label className="ak-label" htmlFor="signin-password">
                Password
              </label>
              <button type="button" className="ak-link" onClick={() => setMode('forgot')}>
                Forgot?
              </button>
            </div>
            <div className={`ak-input-wrap${ipErr ? ' ak-err' : ''}`}>
              <span className="ak-ico">
                <LockIcon size={14} strokeWidth={2} />
              </span>
              <input
                id="signin-password"
                className="ak-input ak-pw"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setIpErr(false)
                }}
              />
              <button
                type="button"
                className="ak-eye"
                onClick={() => setShowPw((s) => !s)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
              </button>
            </div>
            {ipErr && <p className="ak-errmsg">Password is required.</p>}
          </div>

          {emailUnconfirmed && (
            <div className="ak-confirm-pending">
              <p>
                Open the confirmation link we sent to <strong>{email.trim()}</strong>. For local testing you can also
                disable “Confirm email” in Supabase → Authentication → Providers → Email.
              </p>
              <button
                type="button"
                className="ak-btn ak-btn-secondary"
                onClick={() => void handleResendConfirmation()}
                disabled={resendBusy}
              >
                {resendBusy ? 'Sending…' : 'Resend confirmation email'}
              </button>
            </div>
          )}

          <button type="submit" className="ak-btn" disabled={submitting}>
            {submitting ? <div className="ak-spin" /> : 'Sign in →'}
          </button>
        </form>

        <p className="ak-foot">
          Don&apos;t have an account?{' '}
          <Link to={`/sign-up${nextQuery}`} className="ak-link">
            Sign up free
          </Link>
        </p>
      </div>
    </AuthShell>
  )
}
