'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useScope, NeedDept } from '@/components/Scope'
import PrintBtn from '@/components/PrintBtn'
import MonthBar from '@/components/MonthBar'
import { salaryBase } from '@/lib/salary'
import { thisMonth, money, monthRange, monthLabel } from '@/lib/util'

const sum = (rows, k = 'amount') => (rows || []).reduce((a, x) => a + Number(x[k]), 0)

export default function Dashboard() {
  const supabase = createClient()
  const { dept, deptObj } = useScope()
  const [month, setMonth] = useState(thisMonth())
  const [d, setD] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!dept) return
    ;(async () => {
      try {
        setError(''); setD(null)
        const [start, end] = monthRange(month)
        const res = await Promise.all([
          supabase.from('students').select('id, full_name, roll_no, phone, monthly_fee, batch_id, batches(name)').eq('department_id', dept).eq('status', 'active'),
          supabase.from('attendance').select('batch_id, status').eq('department_id', dept).gte('attendance_date', start).lt('attendance_date', end),
          supabase.from('fee_payments').select('student_id, amount').eq('department_id', dept).eq('fee_month', start).in('payment_type', ['monthly', 'previous_month']),
          supabase.from('fee_payments').select('amount').eq('department_id', dept).eq('payment_type', 'admission').gte('paid_on', start).lt('paid_on', end),
          supabase.from('expenses').select('amount').eq('department_id', dept).gte('expense_date', start).lt('expense_date', end),
          supabase.from('teachers').select('*').eq('department_id', dept).eq('is_active', true),
          supabase.from('salary_payments').select('teacher_id, amount_paid').eq('for_month', start),
          supabase.from('batches').select('id, name').eq('department_id', dept).order('name'),
        ])
        const bad = res.find(r => r.error)
        if (bad) throw new Error(bad.error.message)
        const [stu, att, fee, adm, exp, teach, sal, bat] = res

        const students = stu.data || []
        const paidBy = {}
        ;(fee.data || []).forEach(f => { paidBy[f.student_id] = (paidBy[f.student_id] || 0) + Number(f.amount) })
        const remaining = students.map(s => ({ ...s, paid: paidBy[s.id] || 0, rem: Number(s.monthly_fee) - (paidBy[s.id] || 0) })).filter(s => s.rem > 0)

        const cnt = { present: 0, absent: 0, leave: 0 }, perBatch = {}
        ;(att.data || []).forEach(a => {
          cnt[a.status]++
          if (a.batch_id) { perBatch[a.batch_id] = perBatch[a.batch_id] || { present: 0, absent: 0, leave: 0 }; perBatch[a.batch_id][a.status]++ }
        })

        const teachers = teach.data || []
        const ids = new Set(teachers.map(t => t.id))
        const bases = await Promise.all(teachers.map(t => salaryBase(supabase, t, month)))
        const salBase = bases.reduce((a, b) => a + b.base, 0)
        const salPaid = sum((sal.data || []).filter(x => ids.has(x.teacher_id)), 'amount_paid')
        const collected = sum(fee.data), expenses = sum(exp.data), marked = cnt.present + cnt.absent + cnt.leave

        setD({
          students, remaining, cnt, perBatch, batches: bat.data || [], teachers: teachers.length,
          pct: marked ? Math.round(cnt.present * 100 / marked) : 0, collected, feesRemaining: sum(remaining, 'rem'),
          salPaid, salRemaining: Math.max(salBase - salPaid, 0), expenses, net: collected - salPaid - expenses, admission: sum(adm.data),
        })
      } catch (e) { setError(e.message) }
    })()
  }, [dept, month])

  if (!dept) return <NeedDept />

  const cards = d && [
    [d.students.length, 'Enrolled students'],
    [`${d.pct}%`, `Attendance (${d.cnt.present}P / ${d.cnt.absent}A / ${d.cnt.leave}L)`],
    [`Rs ${money(d.collected)}`, 'Fees collected'],
    [`Rs ${money(d.feesRemaining)}`, `Fees remaining (${d.remaining.length})`],
    [`Rs ${money(d.salPaid)}`, 'Salaries paid'],
    [`Rs ${money(d.salRemaining)}`, 'Salaries remaining'],
    [`Rs ${money(d.expenses)}`, 'Expenses'],
    [`Rs ${money(d.net)}`, 'Net balance'],
    [`Rs ${money(d.admission)}`, 'Admission fees (separate)'],
    [d.teachers, 'Teachers'],
  ]

  return (
    <>
      <MonthBar month={month} setMonth={setMonth} />
      <h1>{deptObj?.name} dashboard</h1>
      <p className="muted">{monthLabel(month)}</p>
      {error && <p className="msg error">Could not load the data: {error}. Make sure phase3_core.sql was run in Supabase.</p>}
      {!d && !error && <p className="muted">Loading</p>}
      {d && (
        <>
          <div className="stats">
            {cards.map(([v, l], i) => <div className={'stat ' + (i % 2 ? 'alt' : '')} key={l}><div className="sv">{v}</div><div className="sl">{l}</div></div>)}
          </div>

          <section className="panel">
            <PrintBtn /><h3>Batch overview</h3>
            {d.batches.length === 0 ? <p className="muted">No batches yet. Create them on the Students page.</p> : (
              <div className="scroll"><table>
                <thead><tr><th>Batch</th><th className="num">Students</th><th className="num">Present</th><th className="num">Absent</th><th className="num">Leave</th></tr></thead>
                <tbody>
                  {d.batches.map(b => {
                    const a = d.perBatch[b.id] || { present: 0, absent: 0, leave: 0 }
                    return <tr key={b.id}><td>{b.name}</td><td className="num">{d.students.filter(s => s.batch_id === b.id).length}</td>
                      <td className="num">{a.present}</td><td className="num">{a.absent}</td><td className="num">{a.leave}</td></tr>
                  })}
                </tbody>
              </table></div>
            )}
          </section>

          <section className="panel">
            <PrintBtn /><h3>Remaining fees</h3>
            {d.remaining.length === 0 ? <p className="muted">No pending fees for this month.</p> : (
              <div className="scroll"><table>
                <thead><tr><th>Roll</th><th>Student</th><th>Batch</th><th>Phone</th><th className="num">Fee</th><th className="num">Paid</th><th className="num">Remaining</th></tr></thead>
                <tbody>
                  {d.remaining.map(s => (
                    <tr key={s.id}><td>{s.roll_no}</td><td>{s.full_name}</td><td>{s.batches?.name}</td><td>{s.phone}</td>
                      <td className="num">{money(s.monthly_fee)}</td><td className="num">{money(s.paid)}</td><td className="num"><strong>{money(s.rem)}</strong></td></tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </section>
        </>
      )}
    </>
  )
}
