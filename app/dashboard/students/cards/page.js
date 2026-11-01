'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import { createClient } from '@/lib/supabase/client'
import { useScope } from '@/components/Scope'

function Cards() {
  const supabase = createClient()
  const one = useSearchParams().get('student')
  const { dept, institute } = useScope()
  const [students, setStudents] = useState([])
  const [sel, setSel] = useState({})

  useEffect(() => {
    (async () => {
      let q = supabase.from('students')
        .select('id, full_name, father_name, roll_no, qr_token, photo_url, departments(name), batches(name)')
        .eq('status', 'active').order('full_name')
      if (one) q = q.eq('id', one); else if (dept) q = q.eq('department_id', dept)
      const { data } = await q
      setStudents(data || []); setSel(Object.fromEntries((data || []).map(s => [s.id, true])))
    })()
  }, [dept, one])

  const count = Object.values(sel).filter(Boolean).length
  const setAll = v => setSel(Object.fromEntries(students.map(s => [s.id, v])))

  return (
    <>
      <div className="row between no-print">
        <h1>ID cards</h1>
        <div className="row">
          <Link href="/dashboard/students" className="btn small ghost">Back</Link>
          {one && <Link href="/dashboard/students/cards" className="btn small ghost">All students</Link>}
          <button className="btn small ghost" onClick={() => setAll(true)}>Select all</button>
          <button className="btn small ghost" onClick={() => setAll(false)}>Select none</button>
          <button className="btn small" disabled={!count} onClick={() => window.print()}>Print {count} card{count === 1 ? '' : 's'}</button>
        </div>
      </div>
      <p className="muted no-print">{one ? 'Card for one student.' : dept ? 'Students of the selected department.' : 'All students.'} Tick the cards you want, then print or save as PDF.</p>
      {students.length === 0 && <p className="muted">No students to show.</p>}
      <div className="cardgrid">
        {students.map(s => (
          <div className={'cardwrap' + (sel[s.id] ? '' : ' skip')} key={s.id}>
            <label className="pick no-print"><input type="checkbox" checked={!!sel[s.id]} onChange={e => setSel({ ...sel, [s.id]: e.target.checked })} /></label>
            <div className="idcard">
              <div className="idtop">
                {institute.logo_url ? <img src={institute.logo_url} alt="" className="idlogo" /> : <div className="idlogo ph">{institute.name?.[0]}</div>}
                <div className="idinst">{institute.name}</div>
              </div>
              <div className="idmain">
                <div className="idavatar">{s.photo_url ? <img src={s.photo_url} alt="" /> : s.full_name?.[0]}</div>
                <div className="idinfo">
                  <div className="idname">{s.full_name}</div>
                  <div>S/O {s.father_name || '-'}</div>
                  <div>Roll no {s.roll_no || '-'}</div>
                  <div>{s.departments?.name}{s.batches?.name ? ` · ${s.batches.name}` : ''}</div>
                </div>
                <div className="idqr"><QRCodeSVG value={s.qr_token} size={70} /></div>
              </div>
              <div className="idfoot">STUDENT ID · scan the QR for attendance</div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

export default function CardsPage() {
  return <Suspense fallback={null}><Cards /></Suspense>
}
