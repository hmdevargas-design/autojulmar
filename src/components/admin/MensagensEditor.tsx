'use client'

import { useState } from 'react'
import {
  CHAVE_MENSAGEM_PEDIDO_PRONTO,
  PLACEHOLDERS_PEDIDO_PRONTO,
  renderMensagemPedidoPronto,
} from '@/core/messages/templates'

interface Props {
  tenantId: string
  corpoInicial: string
}

export default function MensagensEditor({ tenantId, corpoInicial }: Props) {
  const [corpo, setCorpo] = useState(corpoInicial)
  const [guardado, setGuardado] = useState(corpoInicial)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  const preview = renderMensagemPedidoPronto(corpo, {
    primeiroNome: 'João',
    numeroPedido: 1234,
    tipoTapete: 'FRENTES',
    lojaNome: 'Autojulmar',
  })
  const alterado = corpo !== guardado

  async function guardar() {
    setLoading(true)
    setErro('')
    setSucesso('')
    try {
      const res = await fetch('/api/admin/mensagens', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          chave: CHAVE_MENSAGEM_PEDIDO_PRONTO,
          corpo,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErro(json.erro ?? 'Erro ao guardar mensagem')
        return
      }
      setCorpo(json.mensagem.corpo)
      setGuardado(json.mensagem.corpo)
      setSucesso('Mensagem guardada')
    } catch {
      setErro('Erro de rede')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <div>
        <label htmlFor="mensagem-pedido-pronto" className="text-sm font-medium text-slate-900 dark:text-slate-100">
          Pedido pronto para levantamento
        </label>
        <textarea
          id="mensagem-pedido-pronto"
          value={corpo}
          onChange={e => setCorpo(e.target.value)}
          rows={5}
          maxLength={1000}
          className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none focus:border-gold focus:ring-1 focus:ring-gold dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PLACEHOLDERS_PEDIDO_PRONTO.map(item => (
          <button
            key={item}
            type="button"
            onClick={() => setCorpo(texto => `${texto}${item}`)}
            className="rounded border border-slate-300 px-2 py-1 text-xs font-mono text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {item}
          </button>
        ))}
      </div>

      <div className="rounded bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-300">
        <p className="mb-1 font-medium text-slate-800 dark:text-slate-100">Pré-visualização</p>
        <p className="whitespace-pre-wrap leading-relaxed">{preview}</p>
      </div>

      {(erro || sucesso) && (
        <p className={`text-xs ${erro ? 'text-red-600' : 'text-emerald-600'}`}>
          {erro || sucesso}
        </p>
      )}

      <button
        type="button"
        onClick={guardar}
        disabled={loading || !alterado}
        className="inline-flex items-center justify-center rounded bg-gold px-3 py-2 text-sm font-medium text-white hover:bg-gold-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'A guardar…' : 'Guardar mensagem'}
      </button>
    </div>
  )
}
