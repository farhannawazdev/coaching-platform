'use client'
import { useState } from 'react'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { thisMonth, monthRange, today } from '@/lib/util'

export default function ExportPage() {
  const supabase = createClient()
  const [month, setMonth] = useState(thisMonth())
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  async function all(table, build = q => q, select = '*') {
    let rows = [], from = 0
    for (;;) {
      const { data, error: err } = await build(supabase.from(table).select(select)).range(from, from + 999)
      if (err) throw err
      rows = rows.concat(data || [])
      if (!data || data.length < 1000) return rows
      from += 1000
    }
  }
  const flat = rows => rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) =>
    [k, v && typeof v === 'object' ? (v.name ?? JSON.stringify(v)) : v])))

  async function run(key, jobs, file) {
    setError(''); setBusy(key)
    try {
      const wb = XLSX.utils.book_new()
      for (const [sheet, rowsPromise] of jobs) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flat(await rowsPromise)), sheet)
      XLSX.writeFile(wb, `${file}.xlsx`)
    } catch (e) { setError(e.message) }
    setBusy('')
  }

  const [start, end] = monthRange(month)
  const items = [
    ['students', 'Students', () => run('students', [['Students', all('students', q => q, '*, departments(name), batches(name)')]], 'students')],
    ['fees', `Fees for ${month}`, () => run('fees', [['Fees', all('fee_payments', q => q.eq('fee_month', start), '*, students(full_name, roll_no), departments(name)')]], `fees-${month}`)],
    ['att', `Attendance for ${month}`, () => run('att', [['Attendance', all('attendance', q => q.gte('attendance_date', start).lt('attendance_date', end), '*, students(full_name, roll_no)')]], `attendance-${month}`)],
    ['exp', `Expenses for ${month}`, () => run('exp', [['Expenses', all('expenses', q => q.gte('expense_date', start).lt('expense_date', end), '*, departments(name)')]], `expenses-${month}`)],
    ['sal', `Salaries for ${month}`, () => run('sal', [['Salaries', all('salary_payments', q => q.eq('for_month', start), '*, teachers(full_name)')]], `salaries-${month}`)],
  ]

  const backup = () => run('backup', [
    ['Students', all('students')], ['Teachers', all('teachers')], ['Batches', all('batches')],
    ['Fees', all('fee_payments')], ['Attendance', all('attendance')], ['Salaries', all('salary_payments')],
    ['Expenses', all('expenses')], ['Owner pocket', all('owner_transactions')],
  ], `backup-${today()}`)

  return (
    <>
      <h1>Export and backup</h1>
      {error && <p className="msg error">{error}</p>}
      <section className="panel">
        <h3>Export to Excel</h3>
        <label className="inline">Month <input type="month" value={month} onChange={e => setMonth(e.target.value)} /></label>
        <div className="row">
          {items.map(([k, label, fn]) => <button key={k} className="btn small ghost" disabled={!!busy} onClick={fn}>{busy === k ? 'Preparing' : label}</button>)}
        </div>
      </section>
      <section className="panel">
        <h3>Full backup</h3>
        <p className="muted">One Excel file with every table of your institute. Keep a copy somewhere safe each month.</p>
        <button className="btn small" disabled={!!busy} onClick={backup}>{busy === 'backup' ? 'Preparing' : 'Download full backup'}</button>
      </section>
    </>
  )
}
