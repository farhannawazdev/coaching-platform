'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useScope, NeedDept } from '@/components/Scope'
import PrintBtn from '@/components/PrintBtn'
import MonthBar from '@/components/MonthBar'
import { today, thisMonth, monthRange, monthLabel } from '@/lib/util'

export default function TeacherAttendancePage() {
  const supabase = createClient()
  const { dept, deptObj, institute } = useScope()
  const [tab, setTab] = useState('daily')
  const [teachers, setTeachers] = useState([])
  useEffect(() => {
    if (!dept) return
    supabase.from('teachers').select('id, full_name, subjects').eq('department_id', dept).eq('is_active', true).order('full_name').then(r => setTeachers(r.data || []))
  }, [dept])
  if (!dept) return <NeedDept />
  return (
    <>
      <h1>{deptObj?.name} teacher attendance</h1>
      <div className="row">
        <button className={'btn small' + (tab === 'daily' ? '' : ' ghost')} onClick={() => setTab('daily')}>Daily</button>
        <button className={'btn small' + (tab === 'monthly' ? '' : ' ghost')} onClick={() => setTab('monthly')}>Monthly summary</button>
      </div>
      {tab === 'daily' ? <Daily supabase={supabase} dept={dept} institute={institute} teachers={teachers} /> : <Monthly supabase={supabase} dept={dept} teachers={teachers} />}
    </>
  )
}

function Daily({ supabase, dept, institute, teachers }) {
  const [date, setDate] = useState(today())
  const [rec, setRec] = useState({})
  const [saved, setSaved] = useState({})
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('teacher_attendance').select('teacher_id, status, hours').eq('department_id', dept).eq('attendance_date', date).then(r => {
      setRec(Object.fromEntries((r.data || []).map(x => [x.teacher_id, { status: x.status, hours: x.hours }]))); setSaved({})
    })
  }, [dept, date, teachers])

  const set = (id, patch) => setRec(r => ({ ...r, [id]: { status: 'present', hours: '', ...r[id], ...patch } }))
  async function save(t) {
    setError('')
    const r = rec[t.id] || { status: 'present', hours: 0 }
    const { error: err } = await supabase.from('teacher_attendance').upsert({
      institute_id: institute.id, department_id: dept, teacher_id: t.id, attendance_date: date,
      status: r.status || 'present', hours: Number(r.hours) || 0,
    }, { onConflict: 'teacher_id,attendance_date' })
    if (err) { setError(err.message); return }
    setSaved(s => ({ ...s, [t.id]: true }))
  }

  return (
    <section className="panel">
      <PrintBtn />
      <div className="row no-print"><input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
      {error && <p className="msg error">{error}</p>}
      {teachers.length === 0 ? <p className="muted">No teachers in this department yet.</p> : (
        <div className="scroll"><table>
          <thead><tr><th>Teacher</th><th>Status</th><th>Hours taught</th><th className="no-print"></th></tr></thead>
          <tbody>
            {teachers.map(t => {
              const r = rec[t.id] || {}
              return (
                <tr key={t.id}><td>{t.full_name}<small className="muted"> {t.subjects}</small></td>
                  <td>{['present', 'absent', 'leave'].map(st => <button key={st} className={'pill ' + st + (r.status === st ? ' on' : '')} onClick={() => set(t.id, { status: st })}>{st}</button>)}</td>
                  <td><input className="amt" type="number" min="0" step="0.5" value={r.hours ?? ''} onChange={e => set(t.id, { hours: e.target.value })} /></td>
                  <td className="no-print"><button className="btn small" onClick={() => save(t)}>Save</button>{saved[t.id] && <span className="badge paid"> saved</span>}</td></tr>
              )
            })}
          </tbody>
        </table></div>
      )}
    </section>
  )
}

function Monthly({ supabase, dept, teachers }) {
  const [month, setMonth] = useState(thisMonth())
  const [rows, setRows] = useState([])
  useEffect(() => {
    const [start, end] = monthRange(month)
    supabase.from('teacher_attendance').select('teacher_id, status, hours').eq('department_id', dept).gte('attendance_date', start).lt('attendance_date', end).then(r => setRows(r.data || []))
  }, [dept, month])
  return (
    <>
      <MonthBar month={month} setMonth={setMonth} />
      <section className="panel">
        <PrintBtn /><h3>Summary, {monthLabel(month)}</h3>
        <div className="scroll"><table>
          <thead><tr><th>Teacher</th><th className="num">Days present</th><th className="num">Absent</th><th className="num">Leave</th><th className="num">Hours taught</th></tr></thead>
          <tbody>
            {teachers.map(t => {
              const mine = rows.filter(r => r.teacher_id === t.id)
              const n = st => mine.filter(r => r.status === st).length
              return <tr key={t.id}><td>{t.full_name}</td><td className="num">{n('present')}</td><td className="num">{n('absent')}</td><td className="num">{n('leave')}</td>
                <td className="num">{mine.reduce((a, r) => a + Number(r.hours), 0)}</td></tr>
            })}
          </tbody>
        </table></div>
      </section>
    </>
  )
}
