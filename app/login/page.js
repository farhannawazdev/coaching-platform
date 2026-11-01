'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const allowSignup = process.env.NEXT_PUBLIC_ALLOW_SIGNUP === 'true'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError(''); setNotice(''); setBusy(true)
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(error.message); setBusy(false); return }
      router.push('/dashboard'); router.refresh()
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) { setError(error.message); setBusy(false); return }
      if (data.session) { router.push('/onboarding'); router.refresh() }
      else { setNotice('Account created. Check your email to confirm it, then log in.'); setBusy(false) }
    }
  }

  return (
    <div className="auth">
      <aside className="auth-side">
        <h1>One place for admissions, attendance and fees.</h1>
        <p>Built for coaching institutes. Each institute sees only its own data.</p>
      </aside>
      <main className="auth-main">
        <form onSubmit={submit} className="auth-form">
          <h2>{mode === 'login' ? 'Log in' : 'Create your account'}</h2>
          <label>Email
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
          </label>
          <label>Password
            <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </label>
          {error && <p className="msg error">{error}</p>}
          {notice && <p className="msg ok">{notice}</p>}
          <button className="btn" disabled={busy}>{busy ? 'Please wait' : mode === 'login' ? 'Log in' : 'Create account'}</button>
          {allowSignup && <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setNotice('') }}>
            {mode === 'login' ? 'New institute? Create an account' : 'Already have an account? Log in'}
          </button>}
        </form>
      </main>
    </div>
  )
}
