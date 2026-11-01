'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useScope, NeedDept } from '@/components/Scope'
import PrintBtn from '@/components/PrintBtn'
import { thisMonth } from '@/lib/util'

const empty = { batch_id: '', full_name: '', father_name: '', phone: '', roll_no: '', monthly_fee: '', admission_fee: '' }
const h12 = h => ((h + 11) % 12) + 1
const hourLabel = h => `${h12(h)} ${h % 24 >= 12 ? 'PM' : 'AM'}`

export default function StudentsPage() {
  const supabase = createClient()
  const { dept, deptObj, institute } = useScope()
  const [batches, setBatches] = useState([])
  const [students, setStudents] = useState([])
  const [form, setForm] = useState(empty)
  const [bf, setBf] = useState({ name: '', timing: '' })
  const [gen, setGen] = useState({ from: 16, to: 22 })
  const [q, setQ] = useState('')
  const [batchFilter, setBatchFilter] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    if (!dept) return
    const [b, s] = await Promise.all([
      supabase.from('batches').select('id, name, timing').eq('department_id', dept).order('name'),
      supabase.from('students').select('id, full_name, father_name, phone, roll_no, monthly_fee, batch_id, photo_url, batches(name)')
        .eq('department_id', dept).eq('status', 'active').order('created_at', { ascending: false }),
    ])
    if (b.error || s.error) setError((b.error || s.error).message)
    setBatches(b.data || []); setStudents(s.data || [])
  }
  useEffect(() => { setError(''); setBatchFilter(''); setForm({ ...empty, monthly_fee: deptObj?.default_fee || '' }); load() }, [dept])

  const set = k => e => setForm({ ...form, [k]: e.target.value })

  async function addStudent(e) {
    e.preventDefault(); setError(''); setBusy(true)
    const admissionFee = Number(form.admission_fee) || 0
    const { data, error: err } = await supabase.from('students').insert({
      institute_id: institute.id, department_id: dept, batch_id: form.batch_id || null,
      full_name: form.full_name.trim(), father_name: form.father_name.trim() || null, phone: form.phone.trim() || null,
      roll_no: form.roll_no.trim() || null, monthly_fee: Number(form.monthly_fee) || 0, admission_fee: admissionFee,
    }).select('id').single()
    if (err) { setError(err.message); setBusy(false); return }
    if (admissionFee > 0) {
      await supabase.from('fee_payments').insert({
        institute_id: institute.id, department_id: dept, student_id: data.id,
        payment_type: 'admission', fee_month: `${thisMonth()}-01`, amount: admissionFee,
      })
    }
    setForm({ ...empty, batch_id: form.batch_id, monthly_fee: deptObj?.default_fee || '' }); setBusy(false); load()
  }

  async function addBatch(e) {
    e.preventDefault(); setError('')
    const { error: err } = await supabase.from('batches').insert({
      institute_id: institute.id, department_id: dept, name: bf.name.trim(), timing: bf.timing.trim() || null,
    })
    if (err) { setError(err.message); return }
    setBf({ name: '', timing: '' }); load()
  }

  async function genBatches(e) {
    e.preventDefault(); setError('')
    const from = Number(gen.from), to = Number(gen.to)
    if (to <= from) { setError('End hour must be after start hour'); return }
    const rows = []
    for (let h = from; h < to; h++) {
      const name = `${h12(h)}-${h12(h + 1)} ${(h + 1) % 24 >= 12 ? 'PM' : 'AM'}`
      if (!batches.some(b => b.name === name)) rows.push({ institute_id: institute.id, department_id: dept, name })
    }
    if (!rows.length) return
    const { error: err } = await supabase.from('batches').insert(rows)
    if (err) { setError(err.message); return }
    load()
  }

  async function delBatch(b) {
    if (!confirm(`Delete batch ${b.name}? Its students will stay but will have no batch.`)) return
    await supabase.from('batches').delete().eq('id', b.id); load()
  }

  const shown = students.filter(s =>
    (!batchFilter || s.batch_id === batchFilter) &&
    (!q || `${s.full_name} ${s.father_name || ''} ${s.roll_no || ''} ${s.phone || ''}`.toLowerCase().includes(q.toLowerCase())))

  if (!dept) return <NeedDept />

  return (
    <>
      <h1>{deptObj?.name} students</h1>
      {error && <p className="msg error">{error}</p>}

      <section className="panel no-print">
        <h3>Batches</h3>
        <p className="muted">Batches belong to this department only. Make hourly slots in one go, or add your own.</p>
        <form onSubmit={genBatches} className="row">
          <label className="inline">From
            <select value={gen.from} onChange={e => setGen({ ...gen, from: e.target.value })}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
            </select>
          </label>
          <label className="inline">To
            <select value={gen.to} onChange={e => setGen({ ...gen, to: e.target.value })}>
              {Array.from({ length: 24 }, (_, h) => h + 1).map(h => <option key={h} value={h}>{hourLabel(h)}</option>)}
            </select>
          </label>
          <button className="btn small ghost">Create hourly batches</button>
        </form>
        <form onSubmit={addBatch} className="row">
          <input required placeholder="Batch name (Class 9, Weekend ...)" value={bf.name} onChange={e => setBf({ ...bf, name: e.target.value })} />
          <input placeholder="Timing (optional)" value={bf.timing} onChange={e => setBf({ ...bf, timing: e.target.value })} />
          <button className="btn small">Add batch</button>
        </form>
        <ul className="chips">
          {batches.map(b => <li key={b.id}>{b.name}{b.timing ? ` (${b.timing})` : ''} <button className="x" onClick={() => delBatch(b)} aria-label="Delete batch">x</button></li>)}
        </ul>
      </section>

      <section className="panel no-print">
        <h3>New admission</h3>
        <form onSubmit={addStudent} className="grid">
          <label>Batch
            <select value={form.batch_id} onChange={set('batch_id')}>
              <option value="">No batch</option>
              {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label>Student name<input required value={form.full_name} onChange={set('full_name')} /></label>
          <label>Father name<input value={form.father_name} onChange={set('father_name')} /></label>
          <label>Phone<input value={form.phone} onChange={set('phone')} /></label>
          <label>Roll number (optional)<input placeholder="Leave empty for automatic" value={form.roll_no} onChange={set('roll_no')} /></label>
          <label>Monthly fee<input type="number" min="0" value={form.monthly_fee} onChange={set('monthly_fee')} /></label>
          <label>Admission fee (optional)<input type="number" min="0" value={form.admission_fee} onChange={set('admission_fee')} /></label>
          <div><button className="btn small" disabled={busy}>{busy ? 'Saving' : 'Admit student'}</button></div>
        </form>
      </section>

      <section className="panel">
        <PrintBtn />
        <h3>Students ({shown.length})</h3>
        <div className="row no-print">
          <input placeholder="Search name, roll, phone" value={q} onChange={e => setQ(e.target.value)} />
          <select value={batchFilter} onChange={e => setBatchFilter(e.target.value)}>
            <option value="">All batches</option>
            {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <Link className="btn small" href="/dashboard/students/cards">Print ID cards</Link>
        </div>
        {shown.length === 0 ? <p className="muted">No students yet.</p> : (
          <div className="scroll"><table>
            <thead><tr><th>Roll</th><th>Name</th><th>Father</th><th>Batch</th><th>Phone</th><th className="num">Fee</th><th className="no-print"></th></tr></thead>
            <tbody>
              {shown.map(s => (
                <tr key={s.id}>
                  <td>{s.roll_no}</td>
                  <td>{s.photo_url ? <img className="avatar" src={s.photo_url} alt="" /> : <span className="avatar">{s.full_name?.[0]}</span>}{s.full_name}</td>
                  <td>{s.father_name}</td><td>{s.batches?.name}</td><td>{s.phone}</td><td className="num">{s.monthly_fee}</td>
                  <td className="no-print"><Link href={`/dashboard/students/${s.id}`}>Profile / edit</Link> &nbsp; <Link href={`/dashboard/students/cards?student=${s.id}`}>ID card</Link></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </section>
    </>
  )
}
