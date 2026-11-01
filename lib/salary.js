import { monthRange } from '@/lib/util'

// returns { base, collected?, hours? } for a teacher and month 'YYYY-MM'
export async function salaryBase(supabase, t, month) {
  const [start, end] = monthRange(month)
  if (t.pay_type === 'percentage') {
    const { data } = await supabase.rpc('teacher_fee_collected', { p_teacher: t.id, p_month: start })
    const collected = Number(data || 0)
    return { base: Math.round(collected * Number(t.percentage) / 100), collected }
  }
  if (t.pay_type === 'hourly') {
    const { data } = await supabase.from('teacher_attendance').select('hours')
      .eq('teacher_id', t.id).gte('attendance_date', start).lt('attendance_date', end)
    const hours = (data || []).reduce((a, x) => a + Number(x.hours), 0)
    return { base: Math.round(hours * Number(t.hourly_rate)), hours }
  }
  return { base: Number(t.fixed_salary) || 0 }
}
