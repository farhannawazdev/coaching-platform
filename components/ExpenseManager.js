'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useScope } from '@/components/Scope'
import PrintBtn from '@/components/PrintBtn'
import { today, money, monthRange, monthLabel } from '@/lib/util'

// departmentId = a department, or null for institute-level expenses
export default function ExpenseManager({ departmentId = null, month, onChange = () => {} }) {
  const supabase = createClient()
  const { institute } = useScope()
  const blank = { category: '', amount: '', expense_date: today(), note: '' }
  const [cats, setCats] = useState([])
  const [rows, setRows] = useState([])
  const [f, setF] = useState(blank)
  const [editing, setEditing] = useState(null)
  const [newCat, setNewCat] = useState('')
  const [error, setError] = useState('')
  const scope = q => (departmentId ? q.eq('department_id', departmentId) : q.is('department_id', null))

  async function load() {
    const [start, end] = monthRange(month)
    const [c, e] = await Promise.all([
      scope(supabase.from('expense_categories').select('id, name').order('name')),
      scope(supabase.from('expenses').select('id, category, amount, expense_date, note')
        .gte('expense_date', start).lt('expense_date', end).order('expense_date', { ascending: false })),
    ])
    setCats(c.data || []); setRows(e.data || [])
  }
  useEffect(() => { load() }, [departmentId, month])

  async function addCat(e) {
    e.preventDefault(); setError('')
    const { error: err } = await supabase.from('expense_categories')
      .insert({ institute_id: institute.id, department_id: departmentId, name: newCat.trim() })
    if (err) { setError(err.message); return }
    setNewCat(''); load()
  }
  async function delCat(id) { await supabase.from('expense_categories').delete().eq('id', id); load() }

  async function save(e) {
    e.preventDefault(); setError('')
    const payload = {
      institute_id: institute.id, department_id: departmentId, category: f.category,
      amount: Number(f.amount), expense_date: f.expense_date, note: f.note.trim() || null,
    }
    const q = editing ? supabase.from('expenses').update(payload).eq('id', editing) : supabase.from('expenses').insert(payload)
    const { error: err } = await q
    if (err) { setError(err.message); return }
    setF({ ...blank, expense_date: f.expense_date }); setEditing(null); load(); onChange()
  }
  function edit(x) { setEditing(x.id); setF({ category: x.category, amount: x.amount, expense_date: x.expense_date, note: x.note || '' }) }
  async function del(id) {
    if (!confirm('Delete this expense?')) return
    await supabase.from('expenses').delete().eq('id', id); load(); onChange()
  }

  const total = rows.reduce((a, x) => a + Number(x.amount), 0)
  const options = f.category && !cats.some(c => c.name === f.category) ? [...cats, { id: 'cur', name: f.category }] : cats

  return (
    <>
      {error && <p className="msg error">{error}</p>}
      <section className="panel no-print">
        <h3>Expense settings</h3>
        <p className="muted">Add the expense types you use here (for example Rent, Electricity, Cables). They appear in the dropdown below.</p>
        <form onSubmit={addCat} className="row">
          <input required placeholder="New expense type" value={newCat} onChange={e => setNewCat(e.target.value)} />
          <button className="btn small">Add type</button>
        </form>
        <ul className="chips">
          {cats.map(c => <li key={c.id}>{c.name} <button className="x" onClick={() => delCat(c.id)} aria-label="Remove">x</button></li>)}
        </ul>
      </section>

      <section className="panel no-print">
        <h3>{editing ? 'Edit expense' : 'Add expense'}</h3>
        <form onSubmit={save} className="grid">
          <label>Type
            <select required value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>
              <option value="">{cats.length ? 'Choose' : 'Add a type first'}</option>
              {options.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </label>
          <label>Amount<input required type="number" min="0" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} /></label>
          <label>Date<input type="date" value={f.expense_date} onChange={e => setF({ ...f, expense_date: e.target.value })} /></label>
          <label>Note<input value={f.note} onChange={e => setF({ ...f, note: e.target.value })} /></label>
          <div className="row">
            <button className="btn small">{editing ? 'Update' : 'Save expense'}</button>
            {editing && <button type="button" className="btn small ghost" onClick={() => { setEditing(null); setF(blank) }}>Cancel</button>}
          </div>
        </form>
      </section>

      <section className="panel">
        <PrintBtn />
        <h3>Expenses, {monthLabel(month)}</h3>
        <p className="muted">Total {money(total)}</p>
        <div className="scroll"><table>
          <thead><tr><th>Date</th><th>Type</th><th className="num">Amount</th><th>Note</th><th className="no-print"></th></tr></thead>
          <tbody>
            {rows.map(x => (
              <tr key={x.id}><td>{x.expense_date}</td><td>{x.category}</td><td className="num">{money(x.amount)}</td><td>{x.note}</td>
                <td className="no-print"><button className="link" onClick={() => edit(x)}>Edit</button> &nbsp; <button className="link" onClick={() => del(x.id)}>Delete</button></td></tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="5" className="muted">No expenses this month.</td></tr>}
          </tbody>
        </table></div>
      </section>
    </>
  )
}
