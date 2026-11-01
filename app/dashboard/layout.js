import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SignOut from '@/components/SignOut'
import Nav from '@/components/Nav'
import PrintBtn from '@/components/PrintBtn'
import { ScopeProvider, DeptSwitcher } from '@/components/Scope'

export default async function DashboardLayout({ children }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('full_name, role, institutes(id, name, logo_url, phone, address)').eq('id', user.id).maybeSingle()
  if (!profile) redirect('/onboarding')

  const { data: departments } = await supabase.from('departments').select('id, name, default_fee').order('name')
  const { data: brand } = await supabase.from('institutes').select('brand_color').maybeSingle()
  const inst = { ...profile.institutes, brand_color: brand?.brand_color || '#14b8a6' }

  return (
    <ScopeProvider departments={departments || []} institute={inst}>
      <div className="shell" style={{ '--brand': inst.brand_color }}>
        <aside className="sidebar">
          <div className="brandrow">
            {inst.logo_url ? <img src={inst.logo_url} alt="" className="logo" /> : <div className="logo ph">{inst.name?.[0]}</div>}
            <div className="brand">{inst.name}</div>
          </div>
          <DeptSwitcher />
          <Nav />
          <div className="me">
            <div>{profile.full_name}</div>
            <small>{profile.role === 'owner' ? 'Super admin' : profile.role}</small>
            <SignOut />
          </div>
        </aside>
        <main className="content">
          <div className="pagebar no-print"><PrintBtn page label="Print / save as PDF" /></div>
          <div className="print-head print-only">
            {inst.logo_url && <img src={inst.logo_url} alt="" className="logo" />}
            <div><strong>{inst.name}</strong><div>{new Date().toLocaleDateString('en-GB')}</div></div>
          </div>
          {children}
        </main>
      </div>
    </ScopeProvider>
  )
}
