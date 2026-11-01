'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PrintBtn from '@/components/PrintBtn'
import MonthBar from '@/components/MonthBar'
import { salaryBase } from '@/lib/salary'
import { thisMonth, money, monthRange, monthLabel } from '@/lib/util'

export default function TeacherProfile() {
  const { id } = useParams()
  const supabase = createClient()
  const [month, setMonth] = useState(thisMonth())
  const [t, setT] = useState(null)
  const [batches, setBatches] = useState([])
  const [att, setAtt] = useState([])
  const [pays, setPays] = useState([])
  const [info, setInfo] = useState({ base: 0 })
  const [error, setError] = useState('')

  useEffect(() => {
    (async () => {
      const [start, end] = monthRange(month)
      const [te, b, a, p] = await Promise.all([
        supabase.from('teachers').select('*, departments(name)').eq('id', id).single(),
        supabase.from('batches').select('id, name').eq('teacher_id', id),
        supabase.from('teacher_attendance').select('attendance_date, status, hours').eq('teacher_id', id).gte('attendance_date', start).lt('attendance_date', end).order('attendance_date'),
        supabase.from('salary_payments').select('id, for_month, amount_paid, paid_on').eq('teacher_id', id).order('paid_on', { ascending: false }),
      ])
      if (te.error) { setError(te.error.message); return }
      setT(te.data); setBatches(b.data || []); setAtt(a.data || []); setPays(p.data || [])
      setInfo(await salaryBase(supabase, te.data, month))
    })()
  }, [id, month])

  if (!t) return <p className="muted">{error || 'Loading'}</p>
  const [start] = monthRange(month)
  const c = { present: 0, absent: 0, leave: 0 }, hours = att.reduce((a, r) => { c[r.status]++; return a + Number(r.hours) }, 0)
  const paid = pays.filter(p => p.for_month === start).reduce((a, p) => a + Number(p.amount_paid), 0)
  const pay = t.pay_type === 'fixed' ? `Fixed ${money(t.fixed_salary)}` : t.pay_type === 'percentage' ? `${t.percentage}% of fees` : `Rs ${money(t.hourly_rate)} per hour`

  return (
    <>
      <MonthBar month={month} setMonth={setMonth} />
      <div className="row between no-print"><h1>{t.full_name}</h1><Link href="/dashboard/teachers" className="btn small ghost">Back</Link></div>
      <section className="panel">
        <PrintBtn /><h3>Profile</h3>
        <p>{t.departments?.name} department · {t.phone || 'no phone'}</p>
        <p>Subjects: {t.subjects || '-'}</p>
        <p>Pay: {pay}</p>
        <p>Batches: {batches.map(b => b.name).join(', ') || '-'}</p>
      </section>
      <section className="panel">
        <PrintBtn /><h3>{monthLabel(month)}</h3>
        <div className="stats">
          <div className="stat"><div className="sv">{c.present}</div><div className="sl">Days present</div></div>
          <div className="stat alt"><div className="sv">{c.absent} / {c.leave}</div><div className="sl">Absent / leave</div></div>
          <div className="stat"><div className="sv">{hours}</div><div className="sl">Hours taught</div></div>
          <div className="stat alt"><div className="sv">Rs {money(info.base)}</div><div className="sl">Salary</div></div>
          <div className="stat"><div className="sv">Rs {money(paid)}</div><div className="sl">Paid</div></div>
          <div className="stat alt"><div className="sv">Rs {money(Math.max(info.base - paid, 0))}</div><div className="sl">Balance to pay</div></div>
        </div>
        {att.length > 0 && (
          <div className="scroll"><table>
            <thead><tr><th>Date</th><th>Status</th><th className="num">Hours</th></tr></thead>
            <tbody>{att.map(r => <tr key={r.attendance_date}><td>{r.attendance_date}</td><td>{r.status}</td><td className="num">{r.hours}</td></tr>)}</tbody>
          </table></div>
        )}
      </section>
      <section className="panel">
        <PrintBtn /><h3>Salary payments</h3>
        {pays.length === 0 ? <p className="muted">No payments yet.</p> : (
          <div className="scroll"><table>
            <thead><tr><th>Paid on</th><th>For month</th><th className="num">Amount</th></tr></thead>
            <tbody>{pays.map(p => <tr key={p.id}><td>{p.paid_on}</td><td>{monthLabel(p.for_month.slice(0, 7))}</td><td className="num">{money(p.amount_paid)}</td></tr>)}</tbody>
          </table></div>
        )}
      </section>
    </>
  )
}
