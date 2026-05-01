import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { EyeIcon, EyeOffIcon, LockIcon, MailIcon, UserIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { safeNextPath } from '../lib/nav'
import { getSiteOrigin } from '../lib/site-origin'
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

function passwordStrength(v: string) {
  if (!v) return { score: 0, label: '' }
  // Length is a hard requirement; without it, no bars light up and we surface
  // a clear "Too short" label.
  if (v.length < 8) return { score: 0, label: 'Too short' }
  let s = 1
  if (/[A-Z]/.test(v)) s++
  if (/[0-9]/.test(v)) s++
  if (/[^A-Za-z0-9]/.test(v)) s++
  const labels = ['Weak', 'Fair', 'Good', 'Strong']
  return { score: s, label: labels[s - 1] ?? 'Weak' }
}

export default function SignUp() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const nextQuery = searchParams.toString() ? `?${searchParams.toString()}` : ''

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [unErr, setUnErr] = useState(false)
  const [ueErr, setUeErr] = useState(false)
  const [upErr, setUpErr] = useState(false)

  const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
  const strength = useMemo(() => passwordStrength(password), [password])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isSupabaseConfigured) {
      toast.error('Supabase is not configured (missing env keys).')
      return
    }
    const n = name.trim()
    setUnErr(n.length === 0)
    setUeErr(!isEmail(email.trim()))
    setUpErr(password.length < 8)
    if (n.length === 0 || !isEmail(email.trim()) || password.length < 8) return

    setSubmitting(true)
    try {
      const origin = getSiteOrigin()
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${origin}/`,
          data: { full_name: n, name: n },
        },
      })
      if (error) {
        toast.error(error.message)
        return
      }
      if (data.user && !data.session) {
        toast.success('Check your email to confirm your account, then sign in.')
        navigate(`/sign-in${nextQuery}`, { replace: true })
        return
      }
      if (data.session) {
        await supabase.auth.getSession()
      }
      toast.success('Account created')
      navigate(safeNextPath(searchParams.get('next')), { replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign up failed. Please try again.'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell activeTab="up" searchSuffix={nextQuery}>
      <div className="ak-screen">
        <div className="ak-head">
          <h1>Create account</h1>
          <p>Free to start. Generate viral LinkedIn posts and banner images in minutes.</p>
        </div>

        {!isSupabaseConfigured && (
          <p className="ak-banner">
            Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in <code>client/.env</code> (and
            mirror in <code>server/.env</code>), then restart.
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
            <label className="ak-label" htmlFor="su-name">
              Full name
            </label>
            <div className={`ak-input-wrap${unErr ? ' ak-err' : ''}`}>
              <span className="ak-ico">
                <UserIcon size={14} strokeWidth={2} />
              </span>
              <input
                id="su-name"
                className="ak-input"
                type="text"
                autoComplete="name"
                placeholder="Your full name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setUnErr(false)
                }}
              />
            </div>
            {unErr && <p className="ak-errmsg">Name is required.</p>}
          </div>

          <div className="ak-field">
            <label className="ak-label" htmlFor="su-email">
              Email address
            </label>
            <div className={`ak-input-wrap${ueErr ? ' ak-err' : ''}`}>
              <span className="ak-ico">
                <MailIcon size={14} strokeWidth={2} />
              </span>
              <input
                id="su-email"
                className="ak-input"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setUeErr(false)
                }}
                onBlur={() => {
                  if (email.trim().length > 0) setUeErr(!isEmail(email.trim()))
                }}
              />
            </div>
            {ueErr && <p className="ak-errmsg">Enter a valid email address.</p>}
          </div>

          <div className="ak-field">
            <label className="ak-label" htmlFor="su-password">
              Password
            </label>
            <div className={`ak-input-wrap${upErr ? ' ak-err' : ''}`}>
              <span className="ak-ico">
                <LockIcon size={14} strokeWidth={2} />
              </span>
              <input
                id="su-password"
                className="ak-input ak-pw"
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setUpErr(false)
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
            {upErr && <p className="ak-errmsg">Password must be at least 8 characters.</p>}
            {password.length > 0 && (
              <div className="ak-str" data-level={strength.score}>
                <div className="ak-str-bars">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`ak-str-bar${i <= strength.score ? ' is-on' : ''}`}
                    />
                  ))}
                </div>
                <span className="ak-str-lbl">{strength.label}</span>
              </div>
            )}
          </div>

          <button type="submit" className="ak-btn" disabled={submitting}>
            {submitting ? <div className="ak-spin" /> : 'Create account →'}
          </button>
        </form>

        <p className="ak-badges">
          By signing up you agree to our{' '}
          <button type="button" className="ak-link">
            Terms
          </button>{' '}
          and{' '}
          <button type="button" className="ak-link">
            Privacy
          </button>
          .
        </p>

        <p className="ak-foot">
          Already have an account?{' '}
          <Link to={`/sign-in${nextQuery}`} className="ak-link">
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  )
}
