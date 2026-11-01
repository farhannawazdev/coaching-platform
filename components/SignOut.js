'use client'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignOut() {
  const router = useRouter()
  async function out() {
    await createClient().auth.signOut()
    router.push('/login'); router.refresh()
  }
  return <button className="signout" onClick={out}>Log out</button>
}
