'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface TipoCliente {
  id: string
  nome: string
}

interface Props {
  tenantId: string
  cliente: {
    id: string
    nome: string
    contacto: string
    tipoClienteId: string | null
    codigo: string | null
  }
  tipos: TipoCliente[]
}

export default function EditarCliente({ tenantId, cliente, tipos }: Props) {
  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState(cliente.nome)
  const [contacto, setContacto] = useState(cliente.contacto)
  const [tipoClienteId, setTipoClienteId] = useState(cliente.tipoClienteId ?? '')
  const [codigo, setCodigo] = useState(cliente.codigo ?? '')
  const [a_guardar, setAGuardar] = useState(false)
  const [erro, setErro] = useState('')
  const router = useRouter()

  function abrir() {
    setNome(cliente.nome)
    setContacto(cliente.contacto)
    setTipoClienteId(cliente.tipoClienteId ?? '')
    setCodigo(cliente.codigo ?? '')
    setErro('')
    setAberto(true)
  }

  async function guardar() {
    if (!nome.trim() || !contacto.trim()) return
    setAGuardar(true)
    setErro('')
    try {
      const res = await fetch('/api/clientes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: cliente.id,
          tenantId,
          nome: nome.trim(),
          contacto: contacto.trim(),
          tipoClienteId: tipoClienteId || null,
          codigo: codigo.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.erro ?? 'Erro ao guardar'); return }
      setAberto(false)
      router.refresh()
    } catch {
      setErro('Erro de ligação')
    } finally {
      setAGuardar(false)
    }
  }

  if (!aberto) {
    return (
      <button
        onClick={abrir}
        className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
      >
        editar
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setAberto(false)}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold text-gray-900">Editar cliente</h3>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nome</label>
          <input
            value={nome}
            onChange={e => setNome(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Contacto</label>
          <input
            value={contacto}
            onChange={e => setContacto(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Código de identificação
            <span className="ml-1 font-normal text-gray-400">(opcional — ex: c12, miguel)</span>
          </label>
          <input
            value={codigo}
            onChange={e => setCodigo(e.target.value)}
            placeholder="ex: c12"
            maxLength={20}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de cliente</label>
          <select
            value={tipoClienteId}
            onChange={e => setTipoClienteId(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— sem tipo —</option>
            {tipos.map(t => (
              <option key={t.id} value={t.id}>{t.nome}</option>
            ))}
          </select>
        </div>

        {erro && <p className="text-xs text-red-600">{erro}</p>}

        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={() => setAberto(false)}
            className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={a_guardar || !nome.trim() || !contacto.trim()}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {a_guardar ? 'A guardar…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
