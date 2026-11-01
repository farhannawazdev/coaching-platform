'use client'
import { shiftMonth, monthLabel, thisMonth } from '@/lib/util'

export default function MonthBar({ month, setMonth }) {
  return (
    <div className="topbar no-print">
      <button className="btn small ghost" onClick={() => setMonth(shiftMonth(month, -1))}>Prev</button>
      <strong className="monthlabel">{monthLabel(month)}</strong>
      <button className="btn small ghost" onClick={() => setMonth(shiftMonth(month, 1))}>Next</button>
      <button className="btn small" onClick={() => setMonth(thisMonth())}>This month</button>
    </div>
  )
}
