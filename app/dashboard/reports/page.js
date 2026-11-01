'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useScope } from '@/components/Scope'
import PrintBtn from '@/components/PrintBtn'
import MonthBar from '@/components/MonthBar'
import ExpenseManager from '@/components/ExpenseManager'
import { thisMonth, today, money, monthRange, monthLabel } from '@/lib/util'

const sum = (rows, k = 'amount') => (rows || []).reduce((a, x) => a + Number(x[k]), 0)

export default function InstituteFinance() {
  const supabase = createClient()
  const { departments, institute } = useScope()
  const [month, setMonth] = useState(thisMonth())
  const [tick, setTick] = useState(0)
  const [r, setR] = useState(null)
  const [pocket, setPocket] = useState([])
  const [pf, setPf] = useState({ type: 'put_in', amount: '', txn_date: today(), note: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    (async () => {
      const [start, end] = monthRange(month)
      const [fees, due, sal, exp, own, stu] = await Promise.all([
        supabase.from('fee_payments').select('amount, payment_type, department_id').gte('paid_on', start).lt('paid_on', end),
        supabase.from('fee_payments').select('amount, department_id').eq('fee_month', start).in('payment_type', ['monthly', 'previous_month']),
        supabase.from('salary_payments').select('amount_paid').gte('paid_on', start).lt('paid_on', end),
        supabase.from('expenses').select('amount, department_id').gte('expense_date', start).lt('expense_date', end),
        supabase.from('owner_transactions').select('id, type, amount, txn_date, note').gte('txn_date', start).lt('txn_date', end).order('txn_date', { ascending: false }),
        supabase.from('students').select('monthly_fee, department_id').eq('status', 'active'),
      ])
      const f = fees.data || []
      const rows = departments.map(d => {
        const of = x => (x || []).filter(y => y.department_id === d.id)
        const feesIn = sum(of(f).filter(y => y.payment_type !== 'admission'))
        const admission = sum(of(f).filter(y => y.payment_type === 'admission')), expenses = sum(of(exp.data))
        return { id: d.id, name: d.name, feesIn, admission, expenses, expected: sum(of(stu.data), 'monthly_fee'), collected: sum(of(due.data)) }
      })
      const instExp = sum((exp.data || []).filter(x => !x.department_id)), salaries = sum(sal.data, 'amount_paid')
      const feesIn = sum(f.filter(y => y.payment_type !== 'admission')), admission = sum(f.filter(y => y.payment_type === 'admission'))
      const totalExp = sum(exp.data)
      setR({ rows, instExp, salaries, feesIn, admission, totalExp, net: feesIn + admission - salaries - totalExp,
        expected: sum(stu.data, 'monthly_fee'), collected: sum(due.data) })
      setPocket(own.data || [])
    })()
  }, [month, departments, tick])

  async function addPocket(e) {
    e.preventDefault(); setError('')
    const { error: err } = await supabase.from('owner_transactions').insert({
      institute_id: institute.id, type: pf.type, amount: Number(pf.amount), txn_date: pf.txn_date, note: pf.note.trim() || null })
    if (err) { setError(err.message); return }
    setPf({ ...pf, amount: '', note: '' }); setTick(t => t + 1)
  }
  async function delPocket(id) {
    if (!confirm('Delete this entry?')) return
    await supabase.from('owner_transactions').delete().eq('id', id); setTick(t => t + 1)
  }
  const putIn = sum(pocket.filter(o => o.type === 'put_in')), taken = sum(pocket.filter(o => o.type === 'taken_out'))

  return (
    <>
      <MonthBar month={month} setMonth={setMonth} />
      <h1>Institute finance, {monthLabel(month)}</h1>
      {error && <p className="msg error">{error}</p>}
      {!r ? <p className="muted">Loading</p> : (
        <>
          <section className="panel">
            <PrintBtn /><h3>Income and expenses by department</h3>
            <div className="scroll"><table>
              <thead><tr><th>Department</th><th className="num">Fees received</th><th className="num">Admission</th><th className="num">Dept expenses</th><th className="num">Net</th><th className="num">Expected</th><th className="num">Collected</th><th className="num">Pending</th></tr></thead>
              <tbody>
                {r.rows.map(x => (
                  <tr key={x.id}><td>{x.name}</td><td className="num">{money(x.feesIn)}</td><td className="num">{money(x.admission)}</td>
                    <td className="num">{money(x.expenses)}</td><td className="num">{money(x.feesIn + x.admission - x.expenses)}</td>
                    <td className="num">{money(x.expected)}</td><td className="num">{money(x.collected)}</td><td className="num">{money(Math.max(x.expected - x.collected, 0))}</td></tr>
                ))}
                <tr><td>Institute expenses</td><td className="num">0</td><td className="num">0</td><td className="num">{money(r.instExp)}</td><td className="num">{money(-r.instExp)}</td><td></td><td></td><td></td></tr>
                <tr className="total"><td>Total</td><td className="num">{money(r.feesIn)}</td><td className="num">{money(r.admission)}</td><td className="num">{money(r.totalExp)}</td>
                  <td className="num">{money(r.feesIn + r.admission - r.totalExp)}</td><td className="num">{money(r.expected)}</td><td className="num">{money(r.collected)}</td><td className="num">{money(Math.max(r.expected - r.collected, 0))}</td></tr>
              </tbody>
            </table></div>
          </section>
          <section className="panel">
            <PrintBtn /><h3>Net profit</h3>
            <table><tbody>
              <tr><td>Fees and admission received</td><td className="num">{money(r.feesIn + r.admission)}</td></tr>
              <tr><td>Teacher salaries paid</td><td className="num">- {money(r.salaries)}</td></tr>
              <tr><td>Department expenses</td><td className="num">- {money(r.totalExp - r.instExp)}</td></tr>
              <tr><td>Institute expenses</td><td className="num">- {money(r.instExp)}</td></tr>
              <tr className="total"><td>Net profit</td><td className="num">{money(r.net)}</td></tr>
            </tbody></table>
          </section>
        </>
      )}

      <h2 className="sect">Institute expenses</h2>
      <p className="muted">Rent, gas, electricity and other expenses of the whole institute, not tied to one department.</p>
      <ExpenseManager departmentId={null} month={month} onChange={() => setTick(t => t + 1)} />

      <h2 className="sect">Owner pocket</h2>
      <section className="panel no-print">
        <h3>Add entry</h3>
        <form onSubmit={addPocket} className="grid">
          <label>Type
            <select value={pf.type} onChange={e => setPf({ ...pf, type: e.target.value })}>
              <option value="put_in">Owner put in</option><option value="taken_out">Owner took out</option>
            </select>
          </label>
          <label>Amount<input required type="number" min="0" value={pf.amount} onChange={e => setPf({ ...pf, amount: e.target.value })} /></label>
          <label>Date<input type="date" value={pf.txn_date} onChange={e => setPf({ ...pf, txn_date: e.target.value })} /></label>
          <label>Note<input value={pf.note} onChange={e => setPf({ ...pf, note: e.target.value })} /></label>
          <div><button className="btn small">Save</button></div>
        </form>
      </section>
      <section className="panel">
        <PrintBtn /><h3>Owner pocket, {monthLabel(month)}</h3>
        <p className="muted">Put in {money(putIn)} · Taken out {money(taken)} · Balance {money(putIn - taken)}. Kept apart from the net profit.</p>
        <div className="scroll"><table>
          <tbody>
            {pocket.map(o => <tr key={o.id}><td>{o.txn_date}</td><td>{o.type === 'put_in' ? 'Put in' : 'Took out'}</td><td className="num">{money(o.amount)}</td><td>{o.note}</td>
              <td className="no-print"><button className="link" onClick={() => delPocket(o.id)}>Delete</button></td></tr>)}
            {pocket.length === 0 && <tr><td className="muted">No entries this month.</td></tr>}
          </tbody>
        </table></div>
      </section>
    </>
  )
}
