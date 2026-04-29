'use client'

import { useEffect, useState } from 'react'

interface Utilizador {
  id: string
  nome: string
  email: string
  role: 'admin' | 'operador'
  criadoEm: string
}

interface AlterarPassword {
  userId: string
  nome: string
}

interface Props {
  tenantId: string
}

export default function UtilizadoresEditor({ tenantId }: Props) {
  const [utilizadores, setUtilizadores] = useState<Utilizador[]>([])
  const [loading, setLoading]           = useState(true)
  const [mostrarForm, setMostrarForm]   = useState(false)
  const [apagando, setApagando]         = useState<string | null>(null)
  const [erro, setErro]                 = useState('')
  const [alterarPwd, setAlterarPwd]     = useState<AlterarPassword | null>(null)
  const [novaPwd, setNovaPwd]           = useState('')
  const [salvandoPwd, setSalvandoPwd]   = useState(false)

  // Form novo utilizador
  const [nome,     setNome]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [role,     setRole]     = useState<'admin' | 'operador'>('operador')
  const [criando,  setCriando]  = useState(false)

  async function carregar() {
    setLoading(true)
    const res = await fetch(`/api/admin/utilizadores?tenantId=${tenantId}`)
    if (res.ok) setUtilizadores(await res.json())
    setLoading(false)
  }

  useEffect(() => { carregar() }, [tenantId])

  async function criar() {
    if (!nome.trim() || !email.trim() || !password.trim()) return
    setCriando(true)
    setErro('')
    const res = await fetch('/api/admin/utilizadores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, nome: nome.trim(), email: email.trim(), password, role }),
    })
    const data = await res.json()
    if (!res.ok) { setErro(data.erro ?? 'Erro ao criar'); setCriando(false); return }

    setUtilizadores(prev => [...prev, {
      id: data.id, nome: data.nome, email: data.email, role: data.role,
      criadoEm: new Date().toISOString(),
    }])
    setNome(''); setEmail(''); setPassword(''); setRole('operador')
    setMostrarForm(false)
    setCriando(false)
  }

  async function salvarPassword() {
    if (!alterarPwd || novaPwd.length < 6) return
    setSalvandoPwd(true)
    setErro('')
    const res = await fetch('/api/admin/utilizadores', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: alterarPwd.userId, tenantId, password: novaPwd }),
    })
    const data = await res.json()
    if (!res.ok) { setErro(data.erro ?? 'Erro ao alterar'); setSalvandoPwd(false); return }
    setAlterarPwd(null)
    setNovaPwd('')
    setSalvandoPwd(false)
  }

  async function apagar(id: string, nomeUtil: string) {
    if (!confirm(`Remover o acesso de "${nomeUtil}"? Esta acção não pode ser desfeita.`)) return
    setApagando(id)
    setErro('')
    const res = await fetch('/api/admin/utilizadores', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id, tenantId }),
    })
    const data = await res.json()
    if (!res.ok) { setErro(data.erro ?? 'Erro ao remover'); setApagando(null); return }
    setUtilizadores(prev => prev.filter(u => u.id !== id))
    setApagando(null)
  }

  if (loading) {
    return <div className="text-sm text-slate-400 dark:text-slate-500 py-8 text-center">A carregar…</div>
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Nome</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Email</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Perfil</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {utilizadores.map(u => (
              <tr key={u.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{u.nome}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    u.role === 'admin'
                      ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}>
                    {u.role === 'admin' ? 'Admin' : 'Operador'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {apagando === u.id ? (
                    <span className="text-xs text-slate-400">a remover…</span>
                  ) : (
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => { setAlterarPwd({ userId: u.id, nome: u.nome }); setNovaPwd(''); setErro('') }}
                        className="text-xs text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      >
                        password
                      </button>
                      <button
                        onClick={() => apagar(u.id, u.nome)}
                        className="text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors"
                      >
                        remover
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {utilizadores.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                  Nenhum utilizador registado.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            onClick={() => { setMostrarForm(true); setErro('') }}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
          >
            + Novo utilizador
          </button>
        </div>
      </div>

      {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}

      {/* Modal alterar password */}
      {alterarPwd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setAlterarPwd(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Alterar password — {alterarPwd.nome}
            </h3>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Nova password</label>
              <input
                type="password"
                value={novaPwd}
                onChange={e => setNovaPwd(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') salvarPassword() }}
                placeholder="Mínimo 6 caracteres"
                autoFocus
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {erro && <p className="text-xs text-red-600 dark:text-red-400">{erro}</p>}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setAlterarPwd(null); setErro('') }}
                className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={salvarPassword}
                disabled={salvandoPwd || novaPwd.length < 6}
                className="px-4 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50 transition-colors font-medium"
              >
                {salvandoPwd ? 'A guardar…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarForm && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm space-y-3">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Novo utilizador</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Nome</label>
              <input
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Nome completo"
                autoFocus
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="email@exemplo.pt"
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Perfil</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as 'admin' | 'operador')}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="operador">Operador — acesso normal</option>
                <option value="admin">Admin — acesso total</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={() => { setMostrarForm(false); setErro('') }}
              className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={criar}
              disabled={criando || !nome.trim() || !email.trim() || password.length < 6}
              className="px-4 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50 transition-colors font-medium"
            >
              {criando ? 'A criar…' : 'Criar acesso'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
