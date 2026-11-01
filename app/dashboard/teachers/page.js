'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useScope, NeedDept } from '@/components/Scope'
import PrintBtn from '@/components/PrintBtn'
import MonthBar from '@/components/MonthBar'
import { salaryBase } from '@/lib/salary'
import { thisMonth, money, monthRange, monthLabel } from '@/lib/util'

const blank = { full_name: '', phone: '', subjects: '', pay_type: 'fixed', fixed_salary: '', percentage: '', hourly_rate: '' }
export const payText = t => (t.pay_type === 'fixed' ? `Fixed ${money(t.fixed_salary)}` : t.pay_type === 'percentage' ? `${t.percentage}% of fees` : `Rs ${money(t.hourly_rate)} per hour`)

export default function TeachersPage() {
  const supabase = createClient()
  const { dept, deptObj, institute } = useScope()
  const [month, setMonth] = useState(thisMonth())
  const [teachers, setTeachers] = useState([])
  const [batches, setBatches] = useState([])
  const [calc, setCalc] = useState({})
  const [amounts, setAmounts] = useState({})
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState(null)
  const [tab, setTab] = useState('all')
  const [error, setError] = useState('')

  async function load() {
    if (!dept) return
    const [start] = monthRange(month)
    const [t, b, sp] = await Promise.all([
      supabase.from('teachers').select('*').eq('department_id', dept).eq('is_active', true).order('full_name'),
      supabase.from('batches').select('id, name, teacher_id').eq('department_id', dept).order('name'),
      supabase.from('salary_payments').select('teacher_id, amount_paid').eq('for_month', start),
    ])
    if (t.error) { setError(t.error.message); return }
    const list = t.data || []
    const paid = {}
    ;(sp.data || []).forEach(r => { paid[r.teacher_id] = (paid[r.teacher_id] || 0) + Number(r.amount_paid) })
    const c = {}
    await Promise.all(list.map(async te => { const s = await salaryBase(supabase, te, month); c[te.id] = { ...s, paid: paid[te.id] || 0 } }))
    setTeachers(list); setBatches(b.data || []); setCalc(c); setAmounts({})
  }
  useEffect(() => { setError(''); setEditing(null); setForm(blank); load() }, [dept, month])

  const set = k => e => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault(); setError('')
    const payload = {
      institute_id: institute.id, department_id: dept, full_name: form.full_name.trim(), phone: form.phone.trim() || null,
      subjects: form.subjects.trim() || null, pay_type: form.pay_type, fixed_salary: Number(form.fixed_salary) || 0,
      percentage: Number(form.percentage) || 0, hourly_rate: Number(form.hourly_rate) || 0,
    }
    const { error: err } = editing ? await supabase.from('teachers').update(payload).eq('id', editing) : await supabase.from('teachers').insert(payload)
    if (err) { setError(err.message); return }
    setForm(blank); setEditing(null); load()
  }
  function edit(t) {
    setEditing(t.id)
    setForm({ full_name: t.full_name, phone: t.phone || '', subjects: t.subjects || '', pay_type: t.pay_type, fixed_salary: t.fixed_salary, percentage: t.percentage, hourly_rate: t.hourly_rate })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  async function remove(t) {
    if (!confirm(`Delete ${t.full_name}? Past salary records are kept.`)) return
    await supabase.from('teachers').update({ is_active: false }).eq('id', t.id); load()
  }
  async function assign(batchId, teacherId) {
    const { error: err } = await supabase.from('batches').update({ teacher_id: teacherId || null }).eq('id', batchId)
    if (err) setError(err.message); else load()
  }
  async function pay(te, due) {
    setError('')
    const amt = Number(amounts[te.id] ?? Math.max(due, 0))
    if (!amt || amt <= 0) return
    const { error: err } = await supabase.from('salary_payments').insert({ institute_id: institute.id, teacher_id: te.id, for_month: `${month}-01`, amount_paid: amt })
    if (err) { setError(err.message); return }
    load()
  }

  if (!dept) return <NeedDept />
  const rows = teachers.map(te => { const c = calc[te.id] || { base: 0, paid: 0 }; const due = c.base - c.paid; return { te, c, due, status: due <= 0 && c.base > 0 ? 'paid' : c.paid > 0 ? 'partial' : 'unpaid' } })
  const shown = rows.filter(r => tab === 'all' || (tab === 'paid' ? r.status === 'paid' : r.status !== 'paid'))

  return (
    <>
      <MonthBar month={month} setMonth={setMonth} />
      <h1>{deptObj?.name} teachers</h1>
      {error && <p className="msg error">{error}</p>}

      <section className="panel no-print">
        <h3>{editing ? 'Edit teacher' : 'Add teacher'}</h3>
        <form onSubmit={submit} className="grid">
          <label>Name<input required value={form.full_name} onChange={set('full_name')} /></label>
          <label>Phone<input value={form.phone} onChange={set('phone')} /></label>
          <label>Subjects / classes<input placeholder="Maths, Class 9 and 10" value={form.subjects} onChange={set('subjects')} /></label>
          <label>Pay type
            <select value={form.pay_type} onChange={set('pay_type')}>
              <option value="fixed">Fixed monthly salary</option>
              <option value="percentage">Percentage of fees</option>
              <option value="hourly">Per hour</option>
            </select>
          </label>
          {form.pay_type === 'fixed' && <label>Monthly salary<input type="number" min="0" value={form.fixed_salary} onChange={set('fixed_salary')} /></label>}
          {form.pay_type === 'percentage' && <label>Percentage (%)<input type="number" min="0" max="100" value={form.percentage} onChange={set('percentage')} /></label>}
          {form.pay_type === 'hourly' && <label>Rate per hour<input type="number" min="0" value={form.hourly_rate} onChange={set('hourly_rate')} /></label>}
          <div className="row"><button className="btn small">{editing ? 'Update teacher' : 'Add teacher'}</button>
            {editing && <button type="button" className="btn small ghost" onClick={() => { setEditing(null); setForm(blank) }}>Cancel</button>}</div>
        </form>
      </section>

      <section className="panel">
        <PrintBtn />
        <div className="tabs no-print">
          {[['all', 'All'], ['paid', 'Paid'], ['unpaid', 'Unpaid and partial']].map(([k, l]) =>
            <button key={k} className={'btn small' + (tab === k ? '' : ' ghost')} onClick={() => setTab(k)}>{l}</button>)}
        </div>
        <h3>Salaries, {monthLabel(month)}</h3>
        {shown.length === 0 ? <p className="muted">No teachers in this list.</p> : (
          <div className="scroll"><table>
            <thead><tr><th>Teacher</th><th>Subjects</th><th>Pay</th><th className="num">Salary</th><th className="num">Paid</th><th className="num">Balance</th><th>Status</th><th className="no-print">Pay now</th><th className="no-print"></th></tr></thead>
            <tbody>
              {shown.map(({ te, c, due, status }) => (
                <tr key={te.id}>
                  <td><Link href={`/dashboard/teachers/${te.id}`}>{te.full_name}</Link></td><td>{te.subjects}</td><td>{payText(te)}</td>
                  <td className="num">{money(c.base)}</td><td className="num">{money(c.paid)}</td><td className="num">{money(Math.max(due, 0))}</td>
                  <td><span className={'badge ' + status}>{status}</span></td>
                  <td className="no-print"><input className="amt" type="number" min="0" value={amounts[te.id] ?? Math.max(due, 0)} onChange={e => setAmounts({ ...amounts, [te.id]: e.target.value })} />
                    <button className="btn small" onClick={() => pay(te, due)}>Pay</button></td>
                  <td className="no-print"><button className="link" onClick={() => edit(te)}>Edit</button> &nbsp; <button className="link" onClick={() => remove(te)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </section>

      <section className="panel no-print">
        <h3>Batches and their teachers</h3>
        <p className="muted">Percentage salary is worked out from the fees collected in the teacher's batches.</p>
        {batches.length === 0 ? <p className="muted">No batches yet. Create them on the Students page.</p> : (
          <table><tbody>
            {batches.map(b => (
              <tr key={b.id}><td>{b.name}</td><td>
                <select value={b.teacher_id || ''} onChange={e => assign(b.id, e.target.value)}>
                  <option value="">No teacher</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select></td></tr>
            ))}
          </tbody></table>
        )}
      </section>
    </>
  )
}
