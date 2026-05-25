'use client'

import { useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CATEGORIAS_ORCAMENTO, PRODUTOS_ORCAMENTO, formatarNumeroOrcamento, type CategoriaOrcamento } from '@/lib/orcamentos/config'

const schema = z.object({
  nomeCliente: z.string().min(1, 'Nome do cliente obrigatório'),
  contacto: z.string().min(9, 'Contacto obrigatório'),
  categoria: z.enum(['reparacao', 'copas', 'capas', 'outros']),
  produto: z.string().min(1, 'Produto obrigatório'),
  descricao: z.string().optional(),
  matricula: z.string().optional(),
  viatura: z.string().optional(),
  ano: z.string().optional(),
  valorEstimado: z.number().min(0),
})

type FormValues = z.infer<typeof schema>

interface Props {
  tenantId: string
  tenantSlug: string
}

const inputCls = 'w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-gold'
const labelCls = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1'

export default function FormularioOrcamento({ tenantId, tenantSlug }: Props) {
  const [submetido, setSubmetido] = useState(false)
  const [numeroOrcamento, setNumeroOrcamento] = useState<number | null>(null)
  const [valorCriado, setValorCriado] = useState(0)
  const [sugestoes, setSugestoes] = useState<{ id: string; nome: string; contacto: string }[]>([])
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false)
  const timerSugestoes = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      categoria: 'reparacao',
      produto: 'bancos',
      valorEstimado: 0,
    },
  })

  const categoria = watch('categoria')
  const produtos = useMemo(() => PRODUTOS_ORCAMENTO[categoria as CategoriaOrcamento] ?? [], [categoria])

  function buscarSugestoes(texto: string) {
    if (timerSugestoes.current) clearTimeout(timerSugestoes.current)
    if (texto.trim().length < 2) { setSugestoes([]); return }
    timerSugestoes.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/clientes?tenantId=${tenantId}&q=${encodeURIComponent(texto.trim())}`)
        if (!res.ok) return
        const data = await res.json()
        setSugestoes(data.clientes ?? [])
      } catch { setSugestoes([]) }
    }, 250)
  }

  function selecionarSugestao(c: { id: string; nome: string; contacto: string }) {
    setValue('nomeCliente', c.nome)
    if (c.contacto) setValue('contacto', c.contacto)
    setSugestoes([])
    setMostrarSugestoes(false)
  }

  async function onSubmit(data: FormValues) {
    try {
      const response = await fetch('/api/orcamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          clienteNome: data.nomeCliente,
          clienteContacto: data.contacto,
          categoria: data.categoria,
          produto: data.produto,
          descricao: data.descricao,
          matricula: data.matricula,
          viatura: data.viatura,
          ano: data.ano,
          valorEstimado: data.valorEstimado,
          origem: 'web',
        }),
      })

      const resultado = await response.json()
      if (!response.ok) {
        const detalhes = resultado.detalhes ? `\n${resultado.detalhes}` : ''
        throw new Error((resultado.erro ?? 'Erro ao criar orcamento') + detalhes)
      }

      setNumeroOrcamento(resultado.numeroOrcamento)
      setValorCriado(Number(resultado.valorEstimado) || 0)
      setSubmetido(true)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao criar orçamento')
    }
  }

  if (submetido && numeroOrcamento) {
    return (
      <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-2xl p-6 text-center">
        <h2 className="text-xl font-bold text-green-600 dark:text-green-400">Orçamento {formatarNumeroOrcamento(numeroOrcamento)} criado</h2>
        <p className="text-slate-600 dark:text-slate-300 mt-1">Valor estimado: <strong>{valorCriado.toFixed(2)}€</strong></p>
        <div className="mt-4 flex gap-3 justify-center">
          <a href={`/${tenantSlug}/orcamentos`} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm hover:bg-slate-200 dark:hover:bg-slate-700">Ver listagem</a>
          <button onClick={() => { setSubmetido(false); setNumeroOrcamento(null) }} className="px-4 py-2 bg-gold text-slate-900 rounded-lg text-sm hover:bg-gold-dark">Novo orçamento</button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Cliente</h2>
        <div className="relative">
          <label className={labelCls}>Nome <span className="text-red-500">*</span></label>
          <input
            {...register('nomeCliente')}
            className={inputCls}
            placeholder="Nome do cliente"
            autoComplete="off"
            onFocus={() => setMostrarSugestoes(true)}
            onChange={e => { register('nomeCliente').onChange(e); buscarSugestoes(e.target.value); setMostrarSugestoes(true) }}
          />
          {errors.nomeCliente ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.nomeCliente.message}</p> : null}
          {mostrarSugestoes && sugestoes.length > 0 ? (
            <div className="absolute z-20 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden">
              {sugestoes.map(c => (
                <button key={c.id} type="button" onClick={() => selecionarSugestao(c)} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                  <span className="font-medium text-slate-900 dark:text-slate-100">{c.nome}</span>
                  <span className="ml-2 text-slate-400 dark:text-slate-500">{c.contacto}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div>
          <label className={labelCls}>Contacto <span className="text-red-500">*</span></label>
          <input {...register('contacto')} className={inputCls} placeholder="Telemóvel" />
          {errors.contacto ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.contacto.message}</p> : null}
        </div>
      </section>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Viatura</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Matrícula</label>
            <input {...register('matricula')} className={inputCls} placeholder="AA-00-AA" />
          </div>
          <div>
            <label className={labelCls}>Viatura</label>
            <input {...register('viatura')} className={inputCls} placeholder="Marca / modelo" />
          </div>
          <div>
            <label className={labelCls}>Ano</label>
            <input {...register('ano')} className={inputCls} placeholder="2024" />
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Produto</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Categoria <span className="text-red-500">*</span></label>
            <select
              {...register('categoria')}
              className={inputCls}
              onChange={e => {
                register('categoria').onChange(e)
                const primeiraOpcao = PRODUTOS_ORCAMENTO[e.target.value as CategoriaOrcamento]?.[0]?.valor ?? ''
                setValue('produto', primeiraOpcao)
              }}
            >
              {CATEGORIAS_ORCAMENTO.map(c => <option key={c.valor} value={c.valor}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Produto <span className="text-red-500">*</span></label>
            <select {...register('produto')} className={inputCls}>
              {produtos.map(p => <option key={p.valor} value={p.valor}>{p.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Descrição / notas</label>
          <textarea {...register('descricao')} className={`${inputCls} min-h-28`} placeholder="Detalhes do trabalho, medidas, materiais, observações do cliente" />
        </div>
      </section>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Condições</h2>
        <div>
          <label className={labelCls}>Valor estimado</label>
          <input type="number" step="0.01" min="0" {...register('valorEstimado', { valueAsNumber: true })} className={inputCls} />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">A validade será definida automaticamente para 30 dias.</p>
        </div>
      </section>

      <div className="flex gap-3">
        <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 bg-gold text-slate-900 rounded-xl text-sm font-medium hover:bg-gold-dark disabled:opacity-60">
          {isSubmitting ? 'A guardar…' : 'Criar orçamento'}
        </button>
        <a href={`/${tenantSlug}/orcamentos`} className="px-5 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800">Cancelar</a>
      </div>
    </form>
  )
}
