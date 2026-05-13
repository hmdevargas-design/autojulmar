import { resolverTenant } from '@/lib/tenant/resolver'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import PesquisaClientes from './PesquisaClientes'
import EditarCliente from './EditarCliente'

const PAGE_SIZE = 50

interface Props {
  params: Promise<{ tenant: string }>
  searchParams: Promise<{ q?: string; arquivados?: string; tipo?: string; pagina?: string }>
}

export default async function PaginaClientes({ params, searchParams }: Props) {
  const { tenant: slug } = await params
  const { q, arquivados: arquivadosParam, tipo: tipoFiltroId, pagina: paginaParam } = await searchParams
  const mostrarArquivados = arquivadosParam === '1'
  const paginaAtual = Math.max(1, parseInt(paginaParam ?? '1', 10))
  const offset = (paginaAtual - 1) * PAGE_SIZE

  const tenant = await resolverTenant(slug)
  if (!tenant) notFound()

  const supabase = criarClienteAdmin()

  // 1. Tipos (necessário para saber o ID do tipo ARQUIVADO)
  const tiposRes = await supabase
    .from('tipos_cliente')
    .select('id, nome')
    .eq('tenant_id', tenant.id)
    .order('ordem')

  const tipos = (tiposRes.data ?? []).map(t => ({ id: t.id, nome: t.nome }))
  const arquivadoTipoId = tipos.find(t => t.nome.toUpperCase() === 'ARQUIVADO')?.id ?? null

  // 2. Clientes paginados + contagem de arquivados (paralelo)
  const clientesQuery = (() => {
    let query = supabase
      .from('clientes')
      .select(`
        id, nome, contacto, tipo_cliente_id, codigo,
        tipos_cliente ( id, nome ),
        pedidos ( id )
      `, { count: 'exact' })
      .eq('tenant_id', tenant.id)
      .order('nome')
      .range(offset, offset + PAGE_SIZE - 1)

    if (q?.trim()) {
      query = query.or(`nome.ilike.%${q.trim()}%,contacto.ilike.%${q.trim()}%`)
    }
    if (tipoFiltroId === 'sem-tipo') {
      query = query.is('tipo_cliente_id', null)
    } else if (tipoFiltroId) {
      query = query.eq('tipo_cliente_id', tipoFiltroId)
    } else if (!mostrarArquivados && arquivadoTipoId) {
      query = query.or(`tipo_cliente_id.is.null,tipo_cliente_id.neq.${arquivadoTipoId}`)
    }
    return query
  })()

  const arquivadosCountQuery = arquivadoTipoId
    ? supabase
        .from('clientes')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .eq('tipo_cliente_id', arquivadoTipoId)
    : Promise.resolve({ count: 0 })

  const [clientesRes, arquivadosRes] = await Promise.all([clientesQuery, arquivadosCountQuery])

  const totalArquivados = arquivadosRes.count ?? 0
  const totalResultados  = clientesRes.count ?? 0
  const totalPaginas     = Math.ceil(totalResultados / PAGE_SIZE)

  const clientes = (clientesRes.data ?? []).map(c => ({
    id:            c.id,
    nome:          c.nome,
    contacto:      c.contacto,
    tipoClienteId: c.tipo_cliente_id as string | null,
    codigo:        (c.codigo as string | null) ?? null,
    tipoNome:      (c.tipos_cliente as unknown as { nome: string } | null)?.nome ?? '—',
    numPedidos:    Array.isArray(c.pedidos) ? c.pedidos.length : 0,
  }))

  const isArquivado = (tipoNome: string) => tipoNome.toUpperCase() === 'ARQUIVADO'

  function buildUrl(pagina: number) {
    const p = new URLSearchParams()
    if (q?.trim()) p.set('q', q.trim())
    if (mostrarArquivados) p.set('arquivados', '1')
    if (tipoFiltroId) p.set('tipo', tipoFiltroId)
    if (pagina > 1) p.set('pagina', pagina.toString())
    const qs = p.toString()
    return `/${slug}/clientes${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Clientes</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {totalResultados} {totalResultados === 1 ? 'registo' : 'registos'}
            {totalPaginas > 1 && ` · página ${paginaAtual} de ${totalPaginas}`}
          </p>
        </div>
      </div>

      <PesquisaClientes
        q={q ?? ''}
        mostrarArquivados={mostrarArquivados}
        totalArquivados={totalArquivados}
        tipos={tipos}
        tipoFiltroId={tipoFiltroId ?? ''}
      />

      {/* Cards mobile */}
      <div className="md:hidden space-y-2">
        {clientes.map((c) => (
          <div key={c.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/${slug}/clientes/${c.id}`} className="min-w-0 flex-1 hover:opacity-80 transition-opacity">
                <div className="font-medium text-slate-900 dark:text-slate-100">{c.nome}</div>
                <div className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">{c.contacto}</div>
              </Link>
              <div className="text-right shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full ${isArquivado(c.tipoNome) ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 line-through' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>{c.tipoNome}</span>
                <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">{c.numPedidos} pedidos</div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2">
              {c.codigo
                ? <span className="font-mono text-xs bg-gold/10 text-gold border border-gold/30 px-2 py-0.5 rounded">{c.codigo}</span>
                : <span />
              }
              <EditarCliente tenantId={tenant.id} cliente={{ id: c.id, nome: c.nome, contacto: c.contacto, tipoClienteId: c.tipoClienteId, codigo: c.codigo }} tipos={tipos} />
            </div>
          </div>
        ))}
        {clientes.length === 0 && (
          <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">
            {q ? `Nenhum cliente encontrado para "${q}".` : 'Nenhum cliente registado.'}
          </div>
        )}
      </div>

      {/* Tabela desktop */}
      <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Código</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Nome</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Contacto</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Tipo</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Pedidos</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="px-4 py-3">
                  {c.codigo
                    ? <span className="font-mono text-xs bg-gold/10 text-gold border border-gold/30 px-2 py-0.5 rounded">{c.codigo}</span>
                    : <span className="text-slate-300 dark:text-slate-600">—</span>
                  }
                </td>
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                  <Link href={`/${slug}/clientes/${c.id}`} className="hover:text-gold transition-colors">
                    {c.nome}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">{c.contacto}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${isArquivado(c.tipoNome) ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 line-through' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>{c.tipoNome}</span>
                </td>
                <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400">{c.numPedidos}</td>
                <td className="px-4 py-3 text-right">
                  <EditarCliente tenantId={tenant.id} cliente={{ id: c.id, nome: c.nome, contacto: c.contacto, tipoClienteId: c.tipoClienteId, codigo: c.codigo }} tipos={tipos} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {clientes.length === 0 && (
          <div className="text-center py-12 text-slate-400 dark:text-slate-500">
            {q ? `Nenhum cliente encontrado para "${q}".` : 'Nenhum cliente registado.'}
          </div>
        )}
      </div>

      {/* Paginação */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between pt-1">
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
