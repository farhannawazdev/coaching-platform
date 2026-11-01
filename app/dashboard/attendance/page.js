'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useScope, NeedDept } from '@/components/Scope'
import PrintBtn from '@/components/PrintBtn'
import MonthBar from '@/components/MonthBar'
import { thisMonth, monthRange, monthLabel } from '@/lib/util'

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' })

export default function AttendancePage() {
  const supabase = createClient()
  const [tab, setTab] = useState('scan')
  return (
    <>
      <h1>Attendance</h1>
      <div className="row">
        <button className={'btn small' + (tab === 'scan' ? '' : ' ghost')} onClick={() => setTab('scan')}>Scan QR</button>
        <button className={'btn small' + (tab === 'register' ? '' : ' ghost')} onClick={() => setTab('register')}>Daily register</button>
        <button className={'btn small' + (tab === 'monthly' ? '' : ' ghost')} onClick={() => setTab('monthly')}>Monthly sheet</button>
      </div>
      {tab === 'scan' ? <Scan supabase={supabase} /> : tab === 'register' ? <Register supabase={supabase} /> : <Monthly supabase={supabase} />}
    </>
  )
}

function Scan({ supabase }) {
  const scanner = useRef(null)
  const last = useRef({ code: '', at: 0 })
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [recent, setRecent] = useState([])
  const [error, setError] = useState('')

  async function onCode(code) {
    const now = Date.now()
    if (code === last.current.code && now - last.current.at < 4000) return
    last.current = { code, at: now }
    const { data, error: err } = await supabase.rpc('mark_attendance_by_qr', { p_qr: code })
    if (err) { setResult({ ok: false, text: err.message }); return }
    const name = data?.[0]?.out_name
    setResult({ ok: true, text: name })
    setRecent(r => [{ name, time: new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Karachi' }) }, ...r].slice(0, 15))
  }

  async function start() {
    setError('')
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      scanner.current = new Html5Qrcode('qr-reader')
      await scanner.current.start({ facingMode: 'environment' }, { fps: 10, qrbox: 240 }, onCode, () => {})
      setRunning(true)
    } catch (e) {
      setError('Camera could not start. Allow camera access, and open the site over https (or localhost).')
    }
  }
  async function stop() {
    try { await scanner.current?.stop(); scanner.current?.clear() } catch {}
    setRunning(false)
  }
  useEffect(() => () => { try { scanner.current?.stop() } catch {} }, [])

  return (
    <section className="panel">
      <div id="qr-reader" className="reader" />
      {error && <p className="msg error">{error}</p>}
      <div className="row">
        {!running ? <button className="btn small" onClick={start}>Start camera</button>
                  : <button className="btn small ghost" onClick={stop}>Stop camera</button>}
      </div>
      {result && (
        <div className={'scanresult ' + (result.ok ? 'good' : 'bad')}>
          {result.ok ? <><strong>{result.text}</strong><span>Present</span></> : result.text}
        </div>
      )}
      {recent.length > 0 && (
        <>
          <h3>Scanned now</h3>
          <ul className="plain">{recent.map((r, i) => <li key={i}>{r.time} &nbsp; {r.name}</li>)}</ul>
        </>
      )}
    </section>
  )
}

function useBatches(supabase, dept) {
  const [batches, setBatches] = useState([])
  useEffect(() => {
    if (!dept) return
    supabase.from('batches').select('id, name').eq('department_id', dept).order('name').then(r => setBatches(r.data || []))
  }, [dept])
  return batches
}

function Register({ supabase }) {
  const { dept } = useScope()
  const batches = useBatches(supabase, dept)
  const [batch, setBatch] = useState('')
  const [q, setQ] = useState('')
  const [date, setDate] = useState(today())
  const [students, setStudents] = useState([])
  const [marks, setMarks] = useState({})
  const [error, setError] = useState('')

  useEffect(() => { setBatch('') }, [dept])

  async function load() {
    if (!dept) return
    let s = supabase.from('students').select('id, full_name, roll_no, institute_id, department_id, batch_id')
      .eq('department_id', dept).eq('status', 'active').order('full_name')
    if (batch) s = s.eq('batch_id', batch)
    const [st, a] = await Promise.all([s, supabase.from('attendance').select('student_id, status').eq('attendance_date', date).eq('department_id', dept)])
    setStudents(st.data || [])
    setMarks(Object.fromEntries((a.data || []).map(r => [r.student_id, r.status])))
  }
  useEffect(() => { load() }, [dept, batch, date])

  const row = (s, status) => ({
    institute_id: s.institute_id, department_id: s.department_id, batch_id: s.batch_id,
    student_id: s.id, attendance_date: date, status,
  })
  async function mark(s, status) {
    setError('')
    const { error: err } = await supabase.from('attendance').upsert(row(s, status), { onConflict: 'student_id,attendance_date' })
    if (err) { setError(err.message); return }
    setMarks(m => ({ ...m, [s.id]: status }))
  }
  const shown = students.filter(s => !q || `${s.full_name} ${s.roll_no || ''}`.toLowerCase().includes(q.toLowerCase()))
  async function markAll() {
    setError('')
    const { error: err } = await supabase.from('attendance').upsert(shown.map(s => row(s, 'present')), { onConflict: 'student_id,attendance_date' })
    if (err) { setError(err.message); return }
    setMarks(m => ({ ...m, ...Object.fromEntries(shown.map(s => [s.id, 'present'])) }))
  }
  const count = st => students.filter(s => marks[s.id] === st).length

  if (!dept) return <NeedDept />
  return (
    <section className="panel">
      <PrintBtn />
      <div className="row no-print">
        <select value={batch} onChange={e => setBatch(e.target.value)}>
          <option value="">All batches</option>
          {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        <input placeholder="Search name or roll" value={q} onChange={e => setQ(e.target.value)} />
        <button className="btn small ghost" onClick={markAll}>Mark shown as present</button>
      </div>
      {error && <p className="msg error">{error}</p>}
      <p className="muted">{date} · Present {count('present')} · Absent {count('absent')} · Leave {count('leave')} · Not marked {students.length - count('present') - count('absent') - count('leave')}</p>
      {shown.length === 0 ? <p className="muted">No students in this selection.</p> : (
        <div className="scroll"><table>
          <thead><tr><th>Roll</th><th>Name</th><th>Status</th></tr></thead>
          <tbody>
            {shown.map(s => (
              <tr key={s.id}><td>{s.roll_no}</td><td>{s.full_name}</td>
                <td>{['present', 'absent', 'leave'].map(st => (
                  <button key={st} className={'pill ' + st + (marks[s.id] === st ? ' on' : '')} onClick={() => mark(s, st)}>{st}</button>
                ))}</td></tr>
            ))}
          </tbody>
        </table></div>
      )}
    </section>
  )
}

function Monthly({ supabase }) {
  const { dept } = useScope()
  const batches = useBatches(supabase, dept)
  const [month, setMonth] = useState(thisMonth())
  const [batch, setBatch] = useState('')
  const [q, setQ] = useState('')
  const [students, setStudents] = useState([])
  const [recs, setRecs] = useState({})

  useEffect(() => { setBatch('') }, [dept])
  useEffect(() => {
    if (!dept) return
    ;(async () => {
      const [start, end] = monthRange(month)
      let s = supabase.from('students').select('id, full_name, roll_no').eq('department_id', dept).eq('status', 'active').order('full_name')
      if (batch) s = s.eq('batch_id', batch)
      const [st, a] = await Promise.all([s, supabase.from('attendance').select('student_id, attendance_date, status')
        .eq('department_id', dept).gte('attendance_date', start).lt('attendance_date', end)])
      const m = {}
      ;(a.data || []).forEach(r => { (m[r.student_id] = m[r.student_id] || {})[Number(r.attendance_date.slice(8, 10))] = r.status })
      setStudents(st.data || []); setRecs(m)
    })()
  }, [dept, batch, month])

  if (!dept) return <NeedDept />
  const [y, mo] = month.split('-').map(Number)
  const days = Array.from({ length: new Date(y, mo, 0).getDate() }, (_, i) => i + 1)
  const shown = students.filter(s => !q || `${s.full_name} ${s.roll_no || ''}`.toLowerCase().includes(q.toLowerCase()))
  const letter = { present: 'P', absent: 'A', leave: 'L' }

  return (
    <>
      <MonthBar month={month} setMonth={setMonth} />
      <section className="panel">
        <PrintBtn />
        <h3>Attendance sheet, {monthLabel(month)}</h3>
        <div className="row no-print">
          <select value={batch} onChange={e => setBatch(e.target.value)}>
            <option value="">All batches</option>
            {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <input placeholder="Search name or roll" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        {shown.length === 0 ? <p className="muted">No students in this selection.</p> : (
          <div className="scroll"><table className="sheet">
            <thead><tr><th>Name</th>{days.map(d => <th key={d}>{d}</th>)}<th>P</th><th>A</th><th>L</th><th>%</th></tr></thead>
            <tbody>
              {shown.map(s => {
                const r = recs[s.id] || {}
                const c = { present: 0, absent: 0, leave: 0 }
                Object.values(r).forEach(v => { c[v]++ })
                const total = c.present + c.absent + c.leave
                return (
                  <tr key={s.id}>
                    <td className="left">{s.full_name}<small className="muted"> {s.roll_no}</small></td>
                    {days.map(d => <td key={d} className={'cell ' + (letter[r[d]] || '')}>{letter[r[d]] || ''}</td>)}
                    <td>{c.present}</td><td>{c.absent}</td><td>{c.leave}</td><td>{total ? Math.round(c.present * 100 / total) : 0}</td>
                  </tr>
                )
              })}
            </tbody>
          </table></div>
        )}
      </section>
    </>
  )
}
