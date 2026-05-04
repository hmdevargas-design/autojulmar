import { resolverTenant } from '@/lib/tenant/resolver'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import PesquisaGlobal from './PesquisaGlobal'

interface Props {
  params:       Promise<{ tenant: string }>
  searchParams: Promise<{ q?: string }>
}

export default async function PaginaPesquisa({ params, searchParams }: Props) {
  const { tenant: slug } = await params
  const { q }            = await searchParams
  const termo            = q?.trim() ?? ''

  const tenant = await resolverTenant(slug)
  if (!tenant) notFound()

  const supabase = criarClienteAdmin()

  const pedidos  = termo.length >= 2 ? await (async () => {
    const isNumero = /^\d+$/.test(termo)
    let query = supabase
      .from('pedidos')
      .select('id, numero_pedido, valor_final, criado_em, dados, clientes ( id, nome, contacto ), estados_fluxo ( nome, cor )')
      .eq('tenant_id', tenant.id)
      .order('criado_em', { ascending: false })
      .limit(20)

    if (isNumero) {
      query = query.eq('numero_pedido', Number(termo))
    } else {
      query = query.or(`dados->>'matricula'.ilike.%${termo}%,dados->>'viatura'.ilike.%${termo}%`)
    }
    const { data } = await query
    return data ?? []
  })() : []

  const clientes = termo.length >= 2 ? await (async () => {
    const { data } = await supabase
      .from('clientes')
      .select('id, nome, contacto, codigo, tipos_cliente ( nome )')
      .eq('tenant_id', tenant.id)
      .or(`nome.ilike.%${termo}%,contacto.ilike.%${termo}%`)
      .order('nome')
      .limit(20)
    return data ?? []
  })() : []

  // Para pesquisa por nome de cliente em pedidos
  const pedidosPorCliente = termo.length >= 2 && !/^\d+$/.test(termo) ? await (async () => {
    const { data: clientesMatch } = await supabase
      .from('clientes')
      .select('id')
      .eq('tenant_id', tenant.id)
      .ilike('nome', `%${termo}%`)
      .limit(10)

    if (!clientesMatch?.length) return []

    const ids = clientesMatch.map(c => c.id)
    const { data } = await supabase
      .from('pedidos')
      .select('id, numero_pedido, valor_final, criado_em, dados, clientes ( id, nome, contacto ), estados_fluxo ( nome, cor )')
      .eq('tenant_id', tenant.id)
      .in('cliente_id', ids)
      .order('criado_em', { ascending: false })
      .limit(20)
    return data ?? []
  })() : []

  // Junta e deduplica pedidos
  const todosPedidos = [...pedidos, ...pedidosPorCliente].filter(
    (p, i, arr) => arr.findIndex(x => x.id === p.id) === i
  )

  function formatarData(iso: string) {
    return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Pesquisa</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Pesquise por nome, contacto, matrícula ou número de pedido
        </p>
      </div>

      <PesquisaGlobal q={termo} />

      {termo.length >= 2 && (
        <div className="space-y-6">

          {/* Clientes */}
          {clientes.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
                Clientes ({clientes.length})
              </h2>
              <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-sm">
                {clientes.map((c, i) => {
                  const tipoNome = (c.tipos_cliente as unknown as { nome: string } | null)?.nome
                  return (
                    <Link
                      key={c.id}
                      href={`/${slug}/clientes/${c.id}`}
                      className={`flex items-center justify-between px-4 py-3 hover:bg-slate-800/60 transition-colors ${i < clientes.length - 1 ? 'border-b border-slate-800' : ''}`}
                    >
                      <div>
                        <div className="text-sm font-medium text-slate-100">{c.nome}</div>
                        <div className="text-xs font-mono text-slate-500 mt-0.5">{c.contacto}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {c.codigo && (
                          <span className="font-mono text-xs bg-gold/10 text-gold border border-gold/30 px-2 py-0.5 rounded">
                            {c.codigo}
                          </span>
                        )}
                        {tipoNome && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                            {tipoNome}
                          </span>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* Pedidos */}
          {todosPedidos.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
                Pedidos ({todosPedidos.length})
              </h2>

              {/* Cards mobile */}
              <div className="md:hidden space-y-2">
                {todosPedidos.map(p => {
                  const estado  = p.estados_fluxo as unknown as { nome: string; cor: string } | null
                  const cliente = p.clientes as unknown as { id: string; nome: string; contacto: string } | null
                  const dados   = p.dados as Record<string, unknown>
                  const matricula = typeof dados?.matricula === 'string' && dados.matricula ? dados.matricula : null
                  return (
                    <Link
                      key={p.id}
                      href={`/${slug}/pedidos/${p.id}`}
                      className="block bg-slate-900 rounded-2xl border border-slate-800 px-4 py-3 shadow-sm hover:bg-slate-800/60 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-mono text-xs text-slate-500">#{p.numero_pedido}</span>
                          <div className="text-sm font-medium text-slate-100 mt-0.5">{cliente?.nome ?? '—'}</div>
                          {matricula && <div className="text-xs font-mono text-slate-500">{matricula}</div>}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-bold text-slate-100">{Number(p.valor_final).toFixed(2)}€</div>
                          {estado && <span className="text-xs font-medium" style={{ color: estado.cor }}>{estado.nome}</span>}
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">{formatarData(p.criado_em)}</div>
                    </Link>
                  )
                })}
              </div>

              {/* Tabela desktop */}
              <div className="hidden md:block bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-800/50 border-b border-slate-700">
                      <th className="text-left px-4 py-3 font-medium text-slate-400">#</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-400">Cliente</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-400">Matrícula</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-400">Estado</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-400">Data</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-400">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todosPedidos.map(p => {
                      const estado  = p.estados_fluxo as unknown as { nome: string; cor: string } | null
                      const cliente = p.clientes as unknown as { id: string; nome: string } | null
                      const dados   = p.dados as Record<string, unknown>
                      const matricula = typeof dados?.matricula === 'string' && dados.matricula ? dados.matricula : '—'
                      return (
                        <tr
                          key={p.id}
                          className="border-b border-slate-800 last:border-0 hover:bg-slate-800/60 transition-colors cursor-pointer"
                          onClick={() => { window.location.href = `/${slug}/pedidos/${p.id}` }}
                        >
                          <td className="px-4 py-3 font-mono text-slate-500">#{p.numero_pedido}</td>
                          <td className="px-4 py-3 font-medium text-slate-100">{cliente?.nome ?? '—'}</td>
                          <td className="px-4 py-3 font-mono text-slate-400">{matricula}</td>
                          <td className="px-4 py-3">
                            {estado && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: estado.cor + '20', color: estado.cor }}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: estado.cor }} />
                                {estado.nome}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-400">{formatarData(p.criado_em)}</td>
                          <td className="px-4 py-3 text-right font-medium text-slate-100">{Number(p.valor_final).toFixed(2)}€</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sem resultados */}
          {clientes.length === 0 && todosPedidos.length === 0 && (
            <div className="bg-slate-900 rounded-2xl border border-slate-800 py-14 text-center">
              <p className="text-slate-500 text-sm">Nenhum resultado para <span className="font-medium text-slate-300">"{termo}"</span></p>
            </div>
          )}
        </div>
      )}

      {termo.length > 0 && termo.length < 2 && (
        <p className="text-sm text-slate-400">Escreve pelo menos 2 caracteres para pesquisar.</p>
      )}
    </div>
  )
}
