'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [fullName, setFullName] = useState('')
  const [institute, setInstitute] = useState('')
  const [departments, setDepartments] = useState('Computer, Coaching, English Language')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError(''); setBusy(true)
    const { data: instituteId, error: e1 } = await supabase.rpc('create_institute', {
      p_institute_name: institute.trim(),
      p_full_name: fullName.trim(),
    })
    if (e1) { setError(e1.message); setBusy(false); return }

    const names = departments.split(',').map(s => s.trim()).filter(Boolean)
    if (names.length) {
      const { error: e2 } = await supabase.from('departments')
        .insert(names.map(name => ({ institute_id: instituteId, name })))
      if (e2) { setError(e2.message); setBusy(false); return }
    }
    router.push('/dashboard'); router.refresh()
  }

  return (
    <div className="auth">
      <aside className="auth-side">
        <h1>Set up your institute.</h1>
        <p>This takes a minute. You can add or rename departments later.</p>
      </aside>
      <main className="auth-main">
        <form onSubmit={submit} className="auth-form">
          <h2>Institute details</h2>
          <label>Your name
            <input required value={fullName} onChange={e => setFullName(e.target.value)} />
          </label>
          <label>Institute name
            <input required value={institute} onChange={e => setInstitute(e.target.value)} />
          </label>
          <label>Departments, separated by commas
            <input value={departments} onChange={e => setDepartments(e.target.value)} />
          </label>
          {error && <p className="msg error">{error}</p>}
          <button className="btn" disabled={busy}>{busy ? 'Setting up' : 'Create institute'}</button>
        </form>
      </main>
    </div>
  )
}
