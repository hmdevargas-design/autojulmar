'use client'

import { useState } from 'react'
import { criarClienteBrowser } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginForm() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [erro,     setErro]     = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro('')

    const supabase = criarClienteBrowser()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error || !data.user) {
      setErro('Email ou password incorrectos')
      setLoading(false)
      return
    }

    // Obtém o tenant do profile do utilizador
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, tenants(slug)')
      .eq('id', data.user.id)
      .single()

    const tenantSlug = (profile?.tenants as unknown as { slug: string } | null)?.slug

    if (tenantSlug) {
      router.push(`/${tenantSlug}/pedidos`)
    } else {
      router.push('/demo/pedidos')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="demo@tapetesauto.pt"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'A entrar…' : 'Entrar'}
      </button>
      <p className="text-xs text-center text-gray-400">
        Demo: demo@tapetesauto.pt / demo1234
      </p>
    </form>
  )
}
