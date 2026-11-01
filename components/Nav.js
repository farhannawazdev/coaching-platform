'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  ['/dashboard', 'Dashboard'], ['/dashboard/students', 'Students'], ['/dashboard/attendance', 'Attendance'],
  ['/dashboard/fees', 'Fees'], ['/dashboard/teachers', 'Teachers'], ['/dashboard/teacher-attendance', 'Teacher attendance'],
  ['/dashboard/expenses', 'Expenses'], ['/dashboard/reports', 'Institute finance'],
  ['/dashboard/export', 'Export to Excel'], ['/dashboard/settings', 'Settings'],
]

export default function Nav() {
  const path = usePathname()
  return (
    <nav>
      {items.map(([href, label]) => {
        const active = href === '/dashboard' ? path === href : path.startsWith(href)
        return <Link key={href} href={href} className={'nav' + (active ? ' active' : '')}>{label}</Link>
      })}
    </nav>
  )
}
