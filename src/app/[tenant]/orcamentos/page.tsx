import { resolverTenant } from '@/lib/tenant/resolver'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import FiltrosOrcamentos from './FiltrosOrcamentos'
import SeletorEstadoOrcamento from '@/components/orcamentos/SeletorEstadoOrcamento'
import { corEstadoOrcamento, formatarNumeroOrcamento, labelCategoriaOrcamento, labelProdutoOrcamento } from '@/lib/orcamentos/config'

interface Props {
  params: Promise<{ tenant: string }>
  searchParams: Promise<{ q?: string; estado?: string; categoria?: string; de?: string; ate?: string }>
}

const CAMPOS_ORCAMENTO = `
  id, numero_orcamento, estado, categoria, produto, descricao, dados, valor_estimado, validade_em, criado_em,
  clientes ( nome, contacto )
`

interface OrcamentoRow {
  id: string
  numero_orcamento: number
  estado: string
  categoria: string
  produto: string
  descricao: string | null
  dados: Record<string, unknown> | null
  valor_estimado: number | string
  validade_em: string | null
  criado_em: string
  clientes: { nome: string; contacto: string } | null
}

export default async function PaginaOrcamentos({ params, searchParams }: Props) {
  const { tenant: slug } = await params
  const { q, estado, categoria, de, ate } = await searchParams
  const tenant = await resolverTenant(slug)
  if (!tenant) notFound()

  const termo = q?.trim().toLowerCase() ?? ''
  const ateISO = ate ? new Date(ate + 'T23:59:59').toISOString() : null
  const deISO = de ? new Date(de + 'T00:00:00').toISOString() : null
  const supabase = criarClienteAdmin()

  let query = supabase
    .from('orcamentos')
    .select(CAMPOS_ORCAMENTO)
    .eq('tenant_id', tenant.id)

  if (estado) query = query.eq('estado', estado)
  if (categoria) query = query.eq('categoria', categoria)
  if (deISO) query = query.gte('criado_em', deISO)
  if (ateISO) query = query.lte('criado_em', ateISO)

  const { data } = await query.order('criado_em', { ascending: false }).limit(200)
  let orcamentos = (data ?? []) as unknown as OrcamentoRow[]

  if (termo) {
    orcamentos = orcamentos.filter(o => {
      const cliente = o.clientes
      const dados = (o.dados ?? {}) as Record<string, string>
      const haystack = [
        formatarNumeroOrcamento(o.numero_orcamento),
        cliente?.nome,
        cliente?.contacto,
        dados.matricula,
        dados.viatura,
        dados.ano,
        labelCategoriaOrcamento(o.categoria),
        labelProdutoOrcamento(o.categoria, o.produto),
        o.descricao,
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(termo)
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Orçamentos</h1>
          {(termo || estado || categoria || de || ate) && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{orcamentos.length} resultado(s)</p>
          )}
        </div>
        <Link href={`/${slug}/orcamentos/novo`} className="px-4 py-2 bg-gold text-slate-900 text-sm font-medium rounded-xl hover:bg-gold-dark transition-colors shadow-sm">
          + Novo Orçamento
        </Link>
      </div>

      <div className="mb-4">
        <Suspense>
          <FiltrosOrcamentos q={q ?? ''} estado={estado ?? ''} categoria={categoria ?? ''} de={de ?? ''} ate={ate ?? ''} />
        </Suspense>
      </div>

      <div className="md:hidden space-y-2">
        {orcamentos.map(orcamento => {
          const cliente = orcamento.clientes
          const dados = (orcamento.dados ?? {}) as Record<string, string>
          const dataCriacao = new Date(orcamento.criado_em).toLocaleDateString('pt-PT')
          return (
            <div key={orcamento.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/${slug}/orcamentos/${orcamento.id}`} className="min-w-0 flex-1">
                  <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{cliente?.nome ?? '—'}</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{formatarNumeroOrcamento(orcamento.numero_orcamento)} · {labelCategoriaOrcamento(orcamento.categoria)}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{[dados.matricula, dados.viatura, dados.ano].filter(Boolean).join(' · ') || '—'}</div>
                </Link>
                <div className="text-right shrink-0">
                  <div className="font-bold text-slate-900 dark:text-slate-100">{Number(orcamento.valor_estimado).toFixed(2)}€</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500">{dataCriacao}</div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-slate-600 dark:text-slate-300">{labelProdutoOrcamento(orcamento.categoria, orcamento.produto)}</span>
                <div className="flex items-center gap-2">
                  <a href={`/api/orcamentos/${orcamento.id}/pdf`} target="_blank" className="text-xs text-gold font-medium hover:underline">PDF</a>
                  <SeletorEstadoOrcamento orcamentoId={orcamento.id} tenantId={tenant.id} estadoAtual={orcamento.estado} />
                </div>
              </div>
            </div>
          )
        })}
        {orcamentos.length === 0 ? <Vazio slug={slug} temFiltros={Boolean(termo || estado || categoria || de || ate)} /> : null}
      </div>

      <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">#</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Cliente</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Viatura</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Produto</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Estado</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Valor</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Validade</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Data</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {orcamentos.map(orcamento => {
              const cliente = orcamento.clientes
              const dados = (orcamento.dados ?? {}) as Record<string, string>
              const dataCriacao = new Date(orcamento.criado_em).toLocaleDateString('pt-PT')
              const validade = orcamento.validade_em ? new Date(orcamento.validade_em).toLocaleDateString('pt-PT') : '—'
              return (
                <tr key={orcamento.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-slate-400 dark:text-slate-500">
                    <Link href={`/${slug}/orcamentos/${orcamento.id}`} className="hover:text-gold transition-colors">{formatarNumeroOrcamento(orcamento.numero_orcamento)}</Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/${slug}/orcamentos/${orcamento.id}`} className="block hover:text-gold transition-colors">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{cliente?.nome ?? '—'}</div>
                      <div className="text-xs text-slate-400 dark:text-slate-500">{cliente?.contacto}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{dados.viatura || '—'}</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500">{[dados.matricula, dados.ano].filter(Boolean).join(' · ') || '—'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{labelProdutoOrcamento(orcamento.categoria, orcamento.produto)}</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500">{labelCategoriaOrcamento(orcamento.categoria)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <SeletorEstadoOrcamento orcamentoId={orcamento.id} tenantId={tenant.id} estadoAtual={orcamento.estado} />
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-slate-100">{Number(orcamento.valor_estimado).toFixed(2)}€</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{validade}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{dataCriacao}</td>
                  <td className="px-4 py-2"><a href={`/api/orcamentos/${orcamento.id}/pdf`} target="_blank" className="text-xs text-gold hover:underline">PDF</a></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {orcamentos.length === 0 ? <Vazio slug={slug} temFiltros={Boolean(termo || estado || categoria || de || ate)} /> : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
        {['rascunho', 'enviado', 'em_acompanhamento', 'aprovado', 'recusado', 'convertido'].map(e => (
          <span key={e} className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: corEstadoOrcamento(e) }} />
            {e.replace('_', ' ')}
          </span>
        ))}
      </div>
    </div>
  )
}

function Vazio({ slug, temFiltros }: { slug: string; temFiltros: boolean }) {
  return (
    <div className="text-center py-12 text-slate-400 dark:text-slate-500">
      {temFiltros
        ? 'Nenhum orçamento encontrado para os filtros aplicados.'
        : <><span>Nenhum orçamento encontrado. </span><Link href={`/${slug}/orcamentos/novo`} className="text-gold hover:underline">Criar primeiro orçamento</Link></>}
    </div>
  )
}
