import { lazy, Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/navbar'
import Footer from './components/footer'
import ScrollToHash from './components/ScrollToHash'
const LandingPage = lazy(() => import('./pages/LandingPage'))
const Generator = lazy(() => import('./pages/Generator'))
const Community = lazy(() => import('./pages/Community'))
const Plans = lazy(() => import('./pages/Plans'))
const Faq = lazy(() => import('./pages/Faq'))
const SignIn = lazy(() => import('./pages/SignIn'))
const SignUp = lazy(() => import('./pages/SignUp'))
const Terms = lazy(() => import('./pages/Terms'))
const Privacy = lazy(() => import('./pages/Privacy'))
const Account = lazy(() => import('./pages/Account'))

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-gray-400 text-sm">
      Loading…
    </div>
  )
}

export default function App() {
  const { pathname } = useLocation()
  const authOnly = pathname === '/sign-in' || pathname === '/sign-up'

  return (
    <>
      <ScrollToHash />
      {!authOnly && <Navbar />}
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/create" element={<Generator />} />
          <Route path="/generator" element={<Generator />} />
          <Route path="/plans" element={<Plans />} />
          <Route path="/community" element={<Community />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/account" element={<Account />} />
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/sign-up" element={<SignUp />} />
        </Routes>
      </Suspense>
      {!authOnly && <Footer />}
    </>
  )
}
