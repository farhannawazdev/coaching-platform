export const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' })
export const thisMonth = () => today().slice(0, 7)
export const money = n => Number(n || 0).toLocaleString('en-PK')
export function monthRange(m) {
  const [y, mo] = m.split('-').map(Number)
  const next = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`
  return [`${m}-01`, `${next}-01`]
}
export async function getInstituteId(supabase) {
  const { data } = await supabase.from('institutes').select('id').maybeSingle()
  return data?.id
}
export function shiftMonth(m, d) {
  const [y, mo] = m.split('-').map(Number)
  const dt = new Date(y, mo - 1 + d, 1)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
}
export function monthLabel(m) {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}
