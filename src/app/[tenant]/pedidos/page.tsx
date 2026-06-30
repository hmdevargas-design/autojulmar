import { resolverTenant } from '@/lib/tenant/resolver'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import SeletorEstado from '@/components/pedidos/SeletorEstado'
import BotaoImprimirLote from '@/components/pedidos/BotaoImprimirLote'
import FiltrosPedidos from './FiltrosPedidos'

const PAGE_SIZE = 100
const MAX_SEARCH_IDS = 5000

interface Props {
  params: Promise<{ tenant: string }>
  searchParams: Promise<{ q?: string; estado?: string; de?: string; ate?: string; pagina?: string }>
}

const CAMPOS_PEDIDO = `
  id, numero_pedido, valor_final, forma_pagamento, criado_em, dados, estado_producao,
  clientes ( nome, contacto ),
  estados_fluxo ( id, nome, cor )
`

const LABEL_PRODUCAO: Record<string, string> = {
  corte:      'Corte',
  acabamento: 'Acabamento',
  separacao:  'Separação',
  avisar:     'Avisar',
  avisado:    'Avisado',
  entregue:   'Entregue',
}

const COR_PRODUCAO: Record<string, string> = {
  corte:      '#EF9F27',
  acabamento: '#BA7517',
  separacao:  '#378ADD',
  avisar:     '#7F77DD',
  avisado:    '#1D9E75',
  entregue:   '#888780',
}

interface PedidoBusca {
  id: string
  criado_em: string
}

export default async function PaginaPedidos({ params, searchParams }: Props) {
  const { tenant: slug } = await params
  const { q, estado: estadoFiltroId, de, ate, pagina: paginaParam } = await searchParams

  const paginaPedida = Number.parseInt(paginaParam ?? '1', 10)
  const paginaAtual = Number.isFinite(paginaPedida) && paginaPedida > 0 ? paginaPedida : 1
  const offset = (paginaAtual - 1) * PAGE_SIZE

  const tenant = await resolverTenant(slug)
  if (!tenant) notFound()

  const supabase = criarClienteAdmin()

  const estadosRes = await supabase
    .from('estados_fluxo')
    .select('id, nome, cor')
    .eq('tenant_id', tenant.id)
    .order('ordem')

  const estados = (estadosRes.data ?? []).map(e => ({ id: e.id, nome: e.nome, cor: e.cor }))

  const termo = q?.trim() ?? ''
  const termoLike = `%${termo}%`
  const digitsTermo = termo.replace(/\D/g, '')
  const ateISO = ate ? new Date(ate + 'T23:59:59').toISOString() : null
  const deISO  = de  ? new Date(de  + 'T00:00:00').toISOString() : null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function aplicarFiltrosPedido(query: any) {
    if (estadoFiltroId) query = query.eq('estado_id', estadoFiltroId)
    if (deISO)  query = query.gte('criado_em', deISO)
    if (ateISO) query = query.lte('criado_em', ateISO)
    return query
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pedidos: any[] = []
  let totalResultados = 0

  if (termo) {
    const clienteQueries = [
      supabase.from('clientes').select('id').eq('tenant_id', tenant.id).ilike('nome', termoLike).limit(1000),
      supabase.from('clientes').select('id').eq('tenant_id', tenant.id).ilike('codigo', termoLike).limit(1000),
      supabase.from('clientes').select('id').eq('tenant_id', tenant.id).ilike('contacto', `%${digitsTermo || termo}%`).limit(1000),
    ]

    const clientesRes = await Promise.all(clienteQueries)
    const clienteIds = Array.from(new Set(
      clientesRes.flatMap(res => (res.data ?? []).map(cliente => cliente.id as string))
    ))

    const numeroPedido = Number.parseInt(termo.replace(/^#/, ''), 10)
    const buscaNumeroPedido = Number.isFinite(numeroPedido) && /^\#?\d+$/.test(termo)

    const pedidoIdQueries = [
      clienteIds.length > 0
        ? aplicarFiltrosPedido(
            supabase.from('pedidos').select('id, criado_em').eq('tenant_id', tenant.id).in('cliente_id', clienteIds)
          ).order('criado_em', { ascending: false }).limit(MAX_SEARCH_IDS)
        : Promise.resolve({ data: [] }),
      aplicarFiltrosPedido(
        supabase.from('pedidos').select('id, criado_em').eq('tenant_id', tenant.id).filter('dados->>matricula', 'ilike', termoLike)
      ).order('criado_em', { ascending: false }).limit(MAX_SEARCH_IDS),
      aplicarFiltrosPedido(
        supabase.from('pedidos').select('id, criado_em').eq('tenant_id', tenant.id).filter('dados->>viatura', 'ilike', termoLike)
      ).order('criado_em', { ascending: false }).limit(MAX_SEARCH_IDS),
      aplicarFiltrosPedido(
        supabase.from('pedidos').select('id, criado_em').eq('tenant_id', tenant.id).filter('dados->>material', 'ilike', termoLike)
      ).order('criado_em', { ascending: false }).limit(MAX_SEARCH_IDS),
      buscaNumeroPedido
        ? aplicarFiltrosPedido(
            supabase.from('pedidos').select('id, criado_em').eq('tenant_id', tenant.id).eq('numero_pedido', numeroPedido)
          ).order('criado_em', { ascending: false }).limit(MAX_SEARCH_IDS)
        : Promise.resolve({ data: [] }),
    ]

    const pedidoIdRes = await Promise.all(pedidoIdQueries)
    const mapaIds = new Map<string, string>()
    for (const res of pedidoIdRes) {
      for (const pedido of ((res.data ?? []) as PedidoBusca[])) {
        const dataActual = mapaIds.get(pedido.id)
        if (!dataActual || new Date(pedido.criado_em).getTime() > new Date(dataActual).getTime()) {
          mapaIds.set(pedido.id, pedido.criado_em)
        }
      }
    }

    const idsOrdenados = Array.from(mapaIds.entries())
      .sort((a, b) => new Date(b[1]).getTime() - new Date(a[1]).getTime())
      .map(([id]) => id)

    totalResultados = idsOrdenados.length
    const idsPagina = idsOrdenados.slice(offset, offset + PAGE_SIZE)

    if (idsPagina.length > 0) {
      const pedidosRes = await supabase
        .from('pedidos')
        .select(CAMPOS_PEDIDO)
        .eq('tenant_id', tenant.id)
        .in('id', idsPagina)

      const porId = new Map((pedidosRes.data ?? []).map(pedido => [pedido.id, pedido]))
      pedidos = idsPagina.map(id => porId.get(id)).filter(Boolean)
    }
  } else {
    let query = supabase
      .from('pedidos')
      .select(CAMPOS_PEDIDO, { count: 'exact' })
      .eq('tenant_id', tenant.id)

    query = aplicarFiltrosPedido(query)

    const res = await query
      .order('criado_em', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    pedidos = res.data ?? []
    totalResultados = res.count ?? 0
  }

  const totalPaginas = Math.ceil(totalResultados / PAGE_SIZE)
  const temFiltros = Boolean(termo || estadoFiltroId || de || ate)

  function buildUrl(pagina: number) {
    const params = new URLSearchParams()
    if (termo) params.set('q', termo)
    if (estadoFiltroId) params.set('estado', estadoFiltroId)
    if (de) params.set('de', de)
    if (ate) params.set('ate', ate)
    if (pagina > 1) params.set('pagina', pagina.toString())
    const qs = params.toString()
    return `/${slug}/pedidos${qs ? `?${qs}` : ''}`
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Pedidos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {totalResultados} {totalResultados === 1 ? 'resultado' : 'resultados'}
            {totalPaginas > 1 && ` · página ${paginaAtual} de ${totalPaginas}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BotaoImprimirLote
            tenantId={tenant.id}
            pedidoIds={pedidos.map(p => p.id)}
            className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <Link
            href={`/${slug}/pedidos/novo`}
            className="px-4 py-2 bg-gold text-slate-900 text-sm font-medium rounded-xl hover:bg-gold-dark transition-colors shadow-sm"
          >
            + Novo Pedido
          </Link>
        </div>
      </div>

      <div className="mb-4">
        <Suspense>
          <FiltrosPedidos q={termo} estadoId={estadoFiltroId ?? ''} de={de ?? ''} ate={ate ?? ''} estados={estados} />
        </Suspense>
      </div>

      {/* Cards mobile */}
      <div className="md:hidden space-y-2">
        {pedidos.map((pedido) => {
          const cliente = pedido.clientes as unknown as { nome: string; contacto: string } | null
          const estado  = pedido.estados_fluxo as unknown as { id: string; nome: string; cor: string } | null
          const dados   = pedido.dados as Record<string, string>
          const data    = new Date(pedido.criado_em).toLocaleDateString('pt-PT')
          return (
            <div key={pedido.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/${slug}/pedidos/${pedido.id}`} className="min-w-0 flex-1">
                  <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{cliente?.nome ?? '—'}</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-mono">{dados?.matricula ?? ''} · #{pedido.numero_pedido}</div>
                </Link>
                <div className="text-right shrink-0">
                  <div className="font-bold text-slate-900 dark:text-slate-100">{Number(pedido.valor_final).toFixed(2)}€</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500">{data}</div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  {estado ? (
                    <SeletorEstado pedidoId={pedido.id} tenantId={tenant.id} estadoAtual={estado} estados={estados} numeroPedido={pedido.numero_pedido} />
                  ) : null}
                  {pedido.estado_producao && (
                    <span
                      className="text-[10px] text-white font-medium px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: COR_PRODUCAO[pedido.estado_producao] ?? '#888' }}
                    >
                      {LABEL_PRODUCAO[pedido.estado_producao] ?? pedido.estado_producao}
                    </span>
                  )}
                </div>
                <a href={`/api/pedidos/${pedido.id}/pdf`} target="_blank" className="text-xs text-gold font-medium hover:underline">PDF</a>
              </div>
            </div>
          )
        })}

        {pedidos.length === 0 && (
          <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">
            {temFiltros
              ? 'Nenhum pedido encontrado para os filtros aplicados.'
              : <><span>Nenhum pedido encontrado. </span><Link href={`/${slug}/pedidos/novo`} className="text-gold hover:underline">Criar primeiro pedido</Link></>
            }
          </div>
        )}
      </div>

      {/* Tabela desktop */}
      <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">#</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Cliente</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Matrícula</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Estado</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Produção</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Valor</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Data</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((pedido) => {
              const cliente = pedido.clientes as unknown as { nome: string; contacto: string } | null
              const estado  = pedido.estados_fluxo as unknown as { id: string; nome: string; cor: string } | null
              const dados   = pedido.dados as Record<string, string>
              const data    = new Date(pedido.criado_em).toLocaleDateString('pt-PT')

              return (
                <tr key={pedido.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-slate-400 dark:text-slate-500">
                    <Link href={`/${slug}/pedidos/${pedido.id}`} className="hover:text-gold transition-colors">
                      #{pedido.numero_pedido}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/${slug}/pedidos/${pedido.id}`} className="block hover:text-gold transition-colors">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{cliente?.nome ?? '—'}</div>
                      <div className="text-xs text-slate-400 dark:text-slate-500">{cliente?.contacto}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300">{dados?.matricula ?? '—'}</td>
                  <td className="px-4 py-3">
                    {estado ? (
                      <SeletorEstado
                        pedidoId={pedido.id}
                        tenantId={tenant.id}
                        estadoAtual={estado}
                        estados={estados}
                        numeroPedido={pedido.numero_pedido}
                      />
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {pedido.estado_producao ? (
                      <span
                        className="text-xs text-white font-medium px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: COR_PRODUCAO[pedido.estado_producao] ?? '#888' }}
                      >
                        {LABEL_PRODUCAO[pedido.estado_producao] ?? pedido.estado_producao}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-slate-100">
                    {Number(pedido.valor_final).toFixed(2)}€
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{data}</td>
                  <td className="px-4 py-2">
                    <a
                      href={`/api/pedidos/${pedido.id}/pdf`}
                      target="_blank"
                      className="text-xs text-gold hover:underline"
                    >
                      PDF
                    </a>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {pedidos.length === 0 && (
          <div className="text-center py-12 text-slate-400 dark:text-slate-500">
            {temFiltros
              ? 'Nenhum pedido encontrado para os filtros aplicados.'
              : <><span>Nenhum pedido encontrado. </span><Link href={`/${slug}/pedidos/novo`} className="text-gold hover:underline">Criar primeiro pedido</Link></>
            }
          </div>
        )}
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between pt-3">
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, totalResultados)} de {totalResultados}
          </span>
          <div className="flex gap-2">
            {paginaAtual > 1 && (
              <Link
                href={buildUrl(paginaAtual - 1)}
                className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
              >
                ← Anterior
              </Link>
            )}
            {paginaAtual < totalPaginas && (
              <Link
                href={buildUrl(paginaAtual + 1)}
                className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
              >
                Próxima →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
