'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useScope } from '@/components/Scope'

const presets = ['#14b8a6', '#6366f1', '#ef4444', '#f59e0b', '#22c55e', '#ec4899', '#0ea5e9', '#a855f7']

export default function SettingsPage() {
  const supabase = createClient()
  const router = useRouter()
  const { institute } = useScope()
  const [f, setF] = useState({ name: '', phone: '', address: '', brand_color: '#14b8a6' })
  const [depts, setDepts] = useState([])
  const [newDept, setNewDept] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  async function load() {
    const [i, d] = await Promise.all([
      supabase.from('institutes').select('name, phone, address, brand_color').maybeSingle(),
      supabase.from('departments').select('*').order('name'),
    ])
    if (i.data) setF({ name: i.data.name || '', phone: i.data.phone || '', address: i.data.address || '', brand_color: i.data.brand_color || '#14b8a6' })
    setDepts(d.data || [])
  }
  useEffect(() => { load() }, [])

  const preview = c => { setF(x => ({ ...x, brand_color: c })); document.querySelector('.shell')?.style.setProperty('--brand', c) }
  const note = t => { setMsg(t); setError('') }

  async function saveInstitute(e) {
    e.preventDefault()
    const { error: err } = await supabase.from('institutes').update({
      name: f.name.trim(), phone: f.phone.trim() || null, address: f.address.trim() || null, brand_color: f.brand_color,
    }).eq('id', institute.id)
    if (err) { setError(err.message); return }
    note('Institute settings saved'); router.refresh()
  }

  async function uploadLogo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const path = `${institute.id}/logo.${ext}`
    const { error: err } = await supabase.storage.from('logos').upload(path, file, { upsert: true, contentType: file.type })
    if (err) { setError(err.message); return }
    const { data } = supabase.storage.from('logos').getPublicUrl(path)
    const { error: e2 } = await supabase.from('institutes').update({ logo_url: `${data.publicUrl}?v=${Date.now()}` }).eq('id', institute.id)
    if (e2) { setError(e2.message); return }
    note('Logo updated'); router.refresh()
  }

  const edit = (id, patch) => setDepts(ds => ds.map(d => (d.id === id ? { ...d, ...patch } : d)))

  async function saveDept(d) {
    const { error: err } = await supabase.from('departments').update({
      name: d.name.trim(), code: d.code || null, color: d.color || null, default_fee: Number(d.default_fee) || 0, description: d.description || null,
    }).eq('id', d.id)
    if (err) { setError(err.message); return }
    note(`${d.name} saved`); router.refresh()
  }

  async function addDept(e) {
    e.preventDefault()
    const { error: err } = await supabase.from('departments').insert({ institute_id: institute.id, name: newDept.trim() })
    if (err) { setError(err.message); return }
    setNewDept(''); note('Department added'); load(); router.refresh()
  }

  return (
    <>
      <h1>Settings</h1>
      {error && <p className="msg error">{error}</p>}
      {msg && <p className="msg ok">{msg}</p>}

      <section className="panel">
        <h3>Institute and branding</h3>
        <form onSubmit={saveInstitute} className="grid">
          <label>Institute name<input required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></label>
          <label>Phone<input value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></label>
          <label>Address<input value={f.address} onChange={e => setF({ ...f, address: e.target.value })} /></label>
          <label>Brand colour
            <div className="row">
              <input type="color" value={f.brand_color} onChange={e => preview(e.target.value)} />
              {presets.map(c => <button type="button" key={c} className="swatch" style={{ background: c }} aria-label={c} onClick={() => preview(c)} />)}
            </div>
          </label>
          <div><button className="btn small">Save</button></div>
        </form>
        <label className="logoup">Logo (PNG, JPG or SVG)
          <input type="file" accept="image/*" onChange={uploadLogo} />
        </label>
        {institute.logo_url && <img src={institute.logo_url} alt="Current logo" className="logoprev" />}
      </section>

      <section className="panel">
        <h3>Departments</h3>
        <p className="muted">Each department has its own students, batches, attendance and fees. The default monthly fee fills in automatically at admission.</p>
        <div className="scroll"><table>
          <thead><tr><th>Name</th><th>Roll code</th><th>Colour</th><th>Default monthly fee</th><th>Description</th><th></th></tr></thead>
          <tbody>
            {depts.map(d => (
              <tr key={d.id}>
                <td><input value={d.name} onChange={e => edit(d.id, { name: e.target.value })} /></td>
                <td><input className="amt" maxLength={5} value={d.code || ''} onChange={e => edit(d.id, { code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} /></td>
                <td><input type="color" value={d.color || '#14b8a6'} onChange={e => edit(d.id, { color: e.target.value })} /></td>
                <td><input className="amt" type="number" min="0" value={d.default_fee ?? 0} onChange={e => edit(d.id, { default_fee: e.target.value })} /></td>
                <td><input value={d.description || ''} onChange={e => edit(d.id, { description: e.target.value })} /></td>
                <td><button className="btn small" onClick={() => saveDept(d)}>Save</button></td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <form onSubmit={addDept} className="row">
          <input required placeholder="New department name" value={newDept} onChange={e => setNewDept(e.target.value)} />
          <button className="btn small">Add department</button>
        </form>
      </section>
    </>
  )
}
