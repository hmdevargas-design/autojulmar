'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { criarClienteBrowser } from '@/lib/supabase/client'

export default function BotaoLogout() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function sair() {
    setLoading(true)
    const supabase = criarClienteBrowser()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button
      onClick={sair}
      disabled={loading}
      title="Sair"
      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
    </button>
  )
}
