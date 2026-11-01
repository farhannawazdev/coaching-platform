'use client'
import { useState } from 'react'
import { useScope, NeedDept } from '@/components/Scope'
import MonthBar from '@/components/MonthBar'
import ExpenseManager from '@/components/ExpenseManager'
import { thisMonth } from '@/lib/util'

export default function ExpensesPage() {
  const { dept, deptObj } = useScope()
  const [month, setMonth] = useState(thisMonth())
  if (!dept) return <NeedDept />
  return (
    <>
      <MonthBar month={month} setMonth={setMonth} />
      <h1>{deptObj?.name} expenses</h1>
      <ExpenseManager departmentId={dept} month={month} />
    </>
  )
}
