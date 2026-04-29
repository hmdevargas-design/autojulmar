import { resolverTenant } from '@/lib/tenant/resolver'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import EditarCliente from '../EditarCliente'

interface Props {
  params: Promise<{ tenant: string; id: string }>
}

const LABEL_PRODUCAO: Record<string, string> = {
  corte:    'Corte',
  costura:  'Costura',
  acabamento:'Acabamento',
  avisado:  'Avisado',
  entregue: 'Entregue',
}

export default async function PerfilCliente({ params }: Props) {
  const { tenant: slug, id } = await params
  const tenant = await resolverTenant(slug)
  if (!tenant) notFound()

  const supabase = criarClienteAdmin()

  const [clienteRes, tiposRes, pedidosRes] = await Promise.all([
    supabase
      .from('clientes')
      .select('id, nome, contacto, codigo, tipo_cliente_id, tipos_cliente ( id, nome )')
      .eq('id', id)
      .eq('tenant_id', tenant.id)
      .single(),
    supabase
      .from('tipos_cliente')
      .select('id, nome')
      .eq('tenant_id', tenant.id)
      .order('ordem'),
    supabase
      .from('pedidos')
      .select(`
        id, numero_pedido, valor_final, sinal, forma_pagamento,
        criado_em, dados, estado_producao,
        estados_fluxo ( nome, cor )
      `)
      .eq('tenant_id', tenant.id)
      .eq('cliente_id', id)
      .order('criado_em', { ascending: false }),
  ])

  if (!clienteRes.data) notFound()

  const cliente = clienteRes.data
  const tipos   = (tiposRes.data ?? []).map(t => ({ id: t.id, nome: t.nome }))
  const pedidos = pedidosRes.data ?? []

  const tipoNome      = (cliente.tipos_cliente as unknown as { nome: string } | null)?.nome ?? null
  const totalGasto    = pedidos.reduce((s, p) => s + Number(p.valor_final), 0)
  const ultimoPedido  = pedidos[0]
  const mediaValor    = pedidos.length > 0 ? totalGasto / pedidos.length : 0

  function formatarData(iso: string) {
    return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  return (
    <div className="space-y-6">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500">
        <Link href={`/${slug}/clientes`} className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
          Clientes
        </Link>
        <span>›</span>
        <span className="text-slate-700 dark:text-slate-300 font-medium">{cliente.nome}</span>
      </div>

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{cliente.nome}</h1>
              {cliente.codigo && (
                <span className="font-mono text-xs bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded">
                  {cliente.codigo}
                </span>
              )}
            </div>
            <div className="text-sm font-mono text-slate-500 dark:text-slate-400 mt-1">{cliente.contacto}</div>
            {tipoNome && (
              <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {tipoNome}
              </span>
            )}
          </div>
          <EditarCliente
            tenantId={tenant.id}
            cliente={{
              id: cliente.id,
              nome: cliente.nome,
              contacto: cliente.contacto,
              tipoClienteId: cliente.tipo_cliente_id as string | null,
              codigo: (cliente.codigo as string | null) ?? null,
            }}
            tipos={tipos}
          />
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Pedidos</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{pedidos.length}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Total gasto</div>
          <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">{totalGasto.toFixed(2)}€</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Valor médio</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{mediaValor.toFixed(2)}€</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Último pedido</div>
          <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
            {ultimoPedido ? formatarData(ultimoPedido.criado_em) : '—'}
          </div>
        </div>
      </div>

      {/* Histórico de pedidos */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3">
          Histórico de pedidos
        </h2>

        {pedidos.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 py-12 text-center text-sm text-slate-400 dark:text-slate-500">
            Nenhum pedido registado.
          </div>
        ) : (
          <>
            {/* Cards mobile */}
            <div className="md:hidden space-y-2">
              {pedidos.map(p => {
                const estado = p.estados_fluxo as unknown as { nome: string; cor: string } | null
                const dados  = p.dados as Record<string, unknown>
                const material = typeof dados?.material === 'string' ? dados.material : null
                const matricula = typeof dados?.matricula === 'string' && dados.matricula ? dados.matricula : null
                return (
                  <Link
                    key={p.id}
                    href={`/${slug}/pedidos/${p.id}`}
                    className="block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-3 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs text-slate-400 dark:text-slate-500">#{p.numero_pedido}</span>
                        {material && <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mt-0.5">{material}</div>}
                        {matricula && <div className="text-xs font-mono text-slate-400 dark:text-slate-500">{matricula}</div>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{Number(p.valor_final).toFixed(2)}€</div>
                        {estado && (
                          <span className="text-xs font-medium" style={{ color: estado.cor }}>{estado.nome}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-xs text-slate-400 dark:text-slate-500">{formatarData(p.criado_em)}</span>
                      {p.estado_producao && p.estado_producao !== 'entregue' && (
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          {LABEL_PRODUCAO[p.estado_producao] ?? p.estado_producao}
                        </span>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>

            {/* Tabela desktop */}
            <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">#</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Data</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Material</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Estado</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Pagamento</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidos.map(p => {
                    const estado  = p.estados_fluxo as unknown as { nome: string; cor: string } | null
                    const dados   = p.dados as Record<string, unknown>
                    const material  = typeof dados?.material === 'string' ? dados.material : '—'
                    const matricula = typeof dados?.matricula === 'string' && dados.matricula ? ` · ${dados.matricula}` : ''
                    return (
                      <tr
                        key={p.id}
                        className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                        onClick={() => { window.location.href = `/${slug}/pedidos/${p.id}` }}
                      >
                        <td className="px-4 py-3 font-mono text-slate-400 dark:text-slate-500">#{p.numero_pedido}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{formatarData(p.criado_em)}</td>
                        <td className="px-4 py-3 text-slate-900 dark:text-slate-100">{material}{matricula}</td>
                        <td className="px-4 py-3">
                          {estado && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: estado.cor + '20', color: estado.cor }}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: estado.cor }} />
                              {estado.nome}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{p.forma_pagamento ?? '—'}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-slate-100">
                          {Number(p.valor_final).toFixed(2)}€
                          {Number(p.sinal) > 0 && (
                            <div className="text-xs text-slate-400 dark:text-slate-500 font-normal">sinal {Number(p.sinal).toFixed(2)}€</div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
