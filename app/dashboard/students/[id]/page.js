'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useScope } from '@/components/Scope'
import PrintBtn from '@/components/PrintBtn'
import { money, monthLabel } from '@/lib/util'

export default function StudentProfile() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()
  const { institute } = useScope()
  const [s, setS] = useState(null)
  const [batches, setBatches] = useState([])
  const [pays, setPays] = useState([])
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  async function load() {
    const { data, error: err } = await supabase.from('students').select('*, departments(name)').eq('id', id).single()
    if (err) { setError(err.message); return }
    setS(data)
    const [b, p] = await Promise.all([
      supabase.from('batches').select('id, name').eq('department_id', data.department_id).order('name'),
      supabase.from('fee_payments').select('id, amount, payment_type, fee_month, paid_on').eq('student_id', id).order('paid_on', { ascending: false }),
    ])
    setBatches(b.data || []); setPays(p.data || [])
  }
  useEffect(() => { load() }, [id])

  const set = k => e => setS({ ...s, [k]: e.target.value })

  async function save(e) {
    e.preventDefault(); setError(''); setMsg('')
    const { error: err } = await supabase.from('students').update({
      full_name: s.full_name.trim(), father_name: s.father_name || null, phone: s.phone || null,
      roll_no: s.roll_no?.trim() || undefined, batch_id: s.batch_id || null, monthly_fee: Number(s.monthly_fee) || 0, status: s.status,
    }).eq('id', id)
    if (err) { setError(err.message); return }
    setMsg('Saved')
  }

  async function photo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(''); setMsg('')
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${institute.id}/${id}.${ext}`
    const { error: err } = await supabase.storage.from('student-photos').upload(path, file, { upsert: true, contentType: file.type })
    if (err) { setError(err.message); return }
    const url = `${supabase.storage.from('student-photos').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`
    const { error: e2 } = await supabase.from('students').update({ photo_url: url }).eq('id', id)
    if (e2) { setError(e2.message); return }
    setS({ ...s, photo_url: url }); setMsg('Photo updated')
  }

  async function remove() {
    if (!confirm('Delete this student permanently? Their attendance and fee records will also be deleted. To keep the records, set the status to Left instead.')) return
    const { error: err } = await supabase.from('students').delete().eq('id', id)
    if (err) { setError(err.message); return }
    router.push('/dashboard/students')
  }

  if (!s) return <p className="muted">{error || 'Loading'}</p>
  const label = p => (p.payment_type === 'admission' ? 'Admission fee' : p.payment_type === 'previous_month' ? `Previous month fee (${monthLabel(p.fee_month.slice(0, 7))})` : `Monthly fee (${monthLabel(p.fee_month.slice(0, 7))})`)

  return (
    <>
      <div className="row between no-print">
        <h1>{s.full_name}</h1>
        <div className="row">
          <Link href="/dashboard/students" className="btn small ghost">Back</Link>
          <Link href={`/dashboard/students/cards?student=${id}`} className="btn small">ID card</Link>
        </div>
      </div>
      {error && <p className="msg error">{error}</p>}
      {msg && <p className="msg ok">{msg}</p>}

      <section className="panel">
        <div className="profile">
          <div>
            {s.photo_url ? <img className="bigavatar" src={s.photo_url} alt="" /> : <div className="bigavatar">{s.full_name?.[0]}</div>}
            <label className="logoup no-print">Photo<input type="file" accept="image/*" onChange={photo} /></label>
          </div>
          <form onSubmit={save} className="grid grow">
            <label>Name<input required value={s.full_name || ''} onChange={set('full_name')} /></label>
            <label>Father name<input value={s.father_name || ''} onChange={set('father_name')} /></label>
            <label>Phone<input value={s.phone || ''} onChange={set('phone')} /></label>
            <label>Roll number<input value={s.roll_no || ''} onChange={set('roll_no')} /></label>
            <label>Department<input disabled value={s.departments?.name || ''} /></label>
            <label>Batch
              <select value={s.batch_id || ''} onChange={set('batch_id')}>
                <option value="">No batch</option>
                {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            <label>Monthly fee<input type="number" min="0" value={s.monthly_fee ?? 0} onChange={set('monthly_fee')} /></label>
            <label>Status
              <select value={s.status} onChange={set('status')}>
                <option value="active">Active</option><option value="left">Left</option>
              </select>
            </label>
            <div className="row"><button className="btn small">Save changes</button>
              <button type="button" className="btn small ghost" onClick={remove}>Delete student</button></div>
          </form>
        </div>
      </section>

      <section className="panel">
        <PrintBtn /><h3>Fee history</h3>
        {pays.length === 0 ? <p className="muted">No payments yet.</p> : (
          <div className="scroll"><table>
            <thead><tr><th>Paid on</th><th>For</th><th className="num">Amount</th></tr></thead>
            <tbody>{pays.map(p => <tr key={p.id}><td>{p.paid_on}</td><td>{label(p)}</td><td className="num">{money(p.amount)}</td></tr>)}</tbody>
          </table></div>
        )}
      </section>
    </>
  )
}
