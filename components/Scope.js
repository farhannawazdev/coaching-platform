'use client'
import { createContext, useContext, useEffect, useState } from 'react'

const Ctx = createContext({ dept: '', setDept() {}, departments: [], institute: {}, deptObj: null })
export const useScope = () => useContext(Ctx)

export function ScopeProvider({ departments, institute, children }) {
  const [dept, setDeptState] = useState('')
  useEffect(() => {
    let s = ''
    try { s = localStorage.getItem('dept') || '' } catch {}
    setDeptState(departments.some(d => d.id === s) ? s : (departments[0]?.id || ''))
  }, [departments])
  const setDept = v => { setDeptState(v); try { localStorage.setItem('dept', v) } catch {} }
  const deptObj = departments.find(d => d.id === dept) || null
  return <Ctx.Provider value={{ dept, setDept, departments, institute, deptObj }}>{children}</Ctx.Provider>
}

export function DeptSwitcher() {
  const { dept, setDept, departments } = useScope()
  if (departments.length === 0) return <p className="muted">No department yet. Add one in Settings.</p>
  return (
    <label className="deptsw">Department
      <select value={dept} onChange={e => setDept(e.target.value)}>
        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
    </label>
  )
}

export function NeedDept() {
  return <section className="panel"><p className="muted">Choose a department from the sidebar. If there is none yet, add one in Settings.</p></section>
}
