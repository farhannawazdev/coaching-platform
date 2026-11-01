'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useScope, NeedDept } from '@/components/Scope'
import PrintBtn from '@/components/PrintBtn'
import MonthBar from '@/components/MonthBar'
import { thisMonth, money, monthRange, monthLabel, shiftMonth } from '@/lib/util'

export default function FeesPage() {
  const supabase = createClient()
  const { dept, deptObj, institute } = useScope()
  const [month, setMonth] = useState(thisMonth())
  const [students, setStudents] = useState([])
  const [pays, setPays] = useState([])
  const [tab, setTab] = useState('all')
  const [q, setQ] = useState('')
  const [collect, setCollect] = useState(null)
  const [form, setForm] = useState({})
  const [receipt, setReceipt] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    if (!dept) return
    const [start] = monthRange(month)
    const [s, p] = await Promise.all([
      supabase.from('students').select('id, full_name, roll_no, phone, monthly_fee, batches(name)').eq('department_id', dept).eq('status', 'active').order('full_name'),
      supabase.from('fee_payments').select('id, student_id, amount, payment_type, fee_month, created_at').eq('department_id', dept).eq('fee_month', start),
    ])
    if (s.error || p.error) setError((s.error || p.error).message)
    setStudents(s.data || []); setPays(p.data || [])
  }
  useEffect(() => { setCollect(null); setReceipt(null); load() }, [dept, month])

  const rows = students.map(s => {
    const paid = pays.filter(p => p.student_id === s.id && p.payment_type !== 'admission').reduce((a, p) => a + Number(p.amount), 0)
    const fee = Number(s.monthly_fee), bal = fee - paid
    return { ...s, paid, bal, status: bal <= 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid' }
  })
  const count = st => rows.filter(r => r.status === st).length
  const shown = rows.filter(r => (tab === 'all' || (tab === 'paid' ? r.status === 'paid' : r.status !== 'paid')) &&
    (!q || `${r.full_name} ${r.roll_no || ''} ${r.phone || ''}`.toLowerCase().includes(q.toLowerCase())))
  const expected = rows.reduce((a, r) => a + Number(r.monthly_fee), 0), received = rows.reduce((a, r) => a + r.paid, 0)

  function openCollect(r) {
    setReceipt(null)
    setCollect(r)
    setForm({ amt: Math.max(r.bal, 0), prevOn: false, prevMonth: shiftMonth(month, -1), prevAmt: '', adm: '' })
  }

  async function save(e) {
    e.preventDefault(); setError('')
    const ins = [], items = []
    const add = (type, fm, amount, label) => {
      ins.push({ institute_id: institute.id, department_id: dept, student_id: collect.id, payment_type: type, fee_month: `${fm}-01`, amount })
      items.push({ label, amount })
    }
    const m = Number(form.amt) || 0
    if (m > 0) add(month < thisMonth() ? 'previous_month' : 'monthly', month, m, `Monthly fee (${monthLabel(month)})`)
    if (form.prevOn && Number(form.prevAmt) > 0) add('previous_month', form.prevMonth, Number(form.prevAmt), `Previous month fee (${monthLabel(form.prevMonth)})`)
    if (Number(form.adm) > 0) add('admission', thisMonth(), Number(form.adm), 'Admission fee')
    if (!ins.length) { setError('Enter an amount to receive'); return }
    const { data, error: err } = await supabase.from('fee_payments').insert(ins).select('id')
    if (err) { setError(err.message); return }
    setReceipt({
      no: data[0].id.slice(0, 8).toUpperCase(), when: new Date().toLocaleString('en-GB', { timeZone: 'Asia/Karachi' }),
      student: collect, items, total: items.reduce((a, i) => a + i.amount, 0), balance: Math.max(collect.bal - m, 0),
    })
    setCollect(null); load()
  }

  function reprint(r) {
    const mine = pays.filter(p => p.student_id === r.id).sort((a, b) => a.created_at.localeCompare(b.created_at))
    if (!mine.length) return
    const items = mine.map(p => ({
      label: p.payment_type === 'admission' ? 'Admission fee' : p.payment_type === 'previous_month' ? `Previous month fee (${monthLabel(month)})` : `Monthly fee (${monthLabel(month)})`,
      amount: Number(p.amount),
    }))
    setCollect(null)
    setReceipt({ no: mine[mine.length - 1].id.slice(0, 8).toUpperCase(), when: new Date(mine[mine.length - 1].created_at).toLocaleString('en-GB', { timeZone: 'Asia/Karachi' }),
      student: r, items, total: items.reduce((a, i) => a + i.amount, 0), balance: Math.max(r.bal, 0) })
  }

  if (!dept) return <NeedDept />

  return (
    <>
      <MonthBar month={month} setMonth={setMonth} />
      <h1>{deptObj?.name} fees</h1>
      {error && <p className="msg error">{error}</p>}
      <p>Expected {money(expected)} · Received {money(received)} · Pending {money(Math.max(expected - received, 0))}</p>

      {receipt && (
        <section className="panel receipt">
          <PrintBtn label="Print receipt" />
          <div className="rc-head">
            {institute.logo_url && <img src={institute.logo_url} alt="" className="logo" />}
            <div><strong>{institute.name}</strong></div>
            {institute.phone && <div>{institute.phone}</div>}
            {institute.address && <div>{institute.address}</div>}
          </div>
          <div className="rc-title">FEE RECEIPT</div>
          <div className="rc-line"><span>Receipt no</span><span>{receipt.no}</span></div>
          <div className="rc-line"><span>Date</span><span>{receipt.when}</span></div>
          <div className="rc-line"><span>Student</span><span>{receipt.student.full_name}</span></div>
          <div className="rc-line"><span>Roll no</span><span>{receipt.student.roll_no}</span></div>
          <div className="rc-line"><span>Class</span><span>{deptObj?.name}{receipt.student.batches?.name ? ` / ${receipt.student.batches.name}` : ''}</span></div>
          <div className="rc-title">DETAILS</div>
          {receipt.items.map((i, k) => <div className="rc-line" key={k}><span>{i.label}</span><span>{money(i.amount)}</span></div>)}
          <div className="rc-line rc-total"><span>TOTAL PAID</span><span>Rs {money(receipt.total)}</span></div>
          <div className="rc-line"><span>Balance for {monthLabel(month)}</span><span>Rs {money(receipt.balance)}</span></div>
          <div className="rc-foot">Thank you</div>
          <button className="btn small ghost no-print" onClick={() => setReceipt(null)}>Close</button>
        </section>
      )}

      {collect && (
        <section className="panel no-print">
          <h3>Receive fee: {collect.full_name} ({collect.roll_no})</h3>
          <form onSubmit={save} className="grid">
            <label>Fee for {monthLabel(month)}<input type="number" min="0" value={form.amt} onChange={e => setForm({ ...form, amt: e.target.value })} /></label>
            <label>Admission fee (optional)<input type="number" min="0" value={form.adm} onChange={e => setForm({ ...form, adm: e.target.value })} /></label>
            <label className="inline"><input type="checkbox" checked={form.prevOn} onChange={e => setForm({ ...form, prevOn: e.target.checked })} /> Also receive a previous month fee</label>
            {form.prevOn && <>
              <label>Which month<input type="month" value={form.prevMonth} onChange={e => setForm({ ...form, prevMonth: e.target.value })} /></label>
              <label>Amount<input type="number" min="0" value={form.prevAmt} onChange={e => setForm({ ...form, prevAmt: e.target.value })} /></label>
            </>}
            <div className="row"><button className="btn small">Receive and make receipt</button>
              <button type="button" className="btn small ghost" onClick={() => setCollect(null)}>Cancel</button></div>
          </form>
        </section>
      )}

      <section className="panel">
        <PrintBtn />
        <div className="tabs no-print">
          {[['all', `All (${rows.length})`], ['paid', `Paid (${count('paid')})`], ['unpaid', `Unpaid and partial (${count('unpaid') + count('partial')})`]].map(([k, l]) =>
            <button key={k} className={'btn small' + (tab === k ? '' : ' ghost')} onClick={() => setTab(k)}>{l}</button>)}
          <input placeholder="Search name, roll, phone" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <h3>{tab === 'paid' ? 'Paid students' : tab === 'unpaid' ? 'Unpaid and partial' : 'All students'}, {monthLabel(month)}</h3>
        {shown.length === 0 ? <p className="muted">No students in this list.</p> : (
          <div className="scroll"><table>
            <thead><tr><th>Roll</th><th>Name</th><th>Batch</th><th>Phone</th><th className="num">Fee</th><th className="num">Paid</th><th className="num">Balance</th><th>Status</th><th className="no-print"></th></tr></thead>
            <tbody>
              {shown.map(r => (
                <tr key={r.id}><td>{r.roll_no}</td><td>{r.full_name}</td><td>{r.batches?.name}</td><td>{r.phone}</td>
                  <td className="num">{money(r.monthly_fee)}</td><td className="num">{money(r.paid)}</td><td className="num">{money(Math.max(r.bal, 0))}</td>
                  <td><span className={'badge ' + r.status}>{r.status}</span></td>
                  <td className="no-print"><button className="btn small" onClick={() => openCollect(r)}>Receive</button>
                    {pays.some(p => p.student_id === r.id) && <> <button className="btn small ghost" onClick={() => reprint(r)}>Receipt</button></>}</td></tr>
              ))}
            </tbody>
          </table></div>
        )}
      </section>
    </>
  )
}
