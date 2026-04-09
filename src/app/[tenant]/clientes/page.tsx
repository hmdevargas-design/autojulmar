import { resolverTenant } from '@/lib/tenant/resolver'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import PesquisaClientes from './PesquisaClientes'
import EditarCliente from './EditarCliente'

interface Props {
  params: Promise<{ tenant: string }>
  searchParams: Promise<{ q?: string }>
}

export default async function PaginaClientes({ params, searchParams }: Props) {
  const { tenant: slug } = await params
  const { q } = await searchParams

  const tenant = await resolverTenant(slug)
  if (!tenant) notFound()

  const supabase = criarClienteAdmin()

  const [clientesRes, tiposRes] = await Promise.all([
    (() => {
      let query = supabase
        .from('clientes')
        .select(`
          id, nome, contacto, tipo_cliente_id, codigo,
          tipos_cliente ( id, nome ),
          pedidos ( id )
        `, { count: 'exact' })
        .eq('tenant_id', tenant.id)
        .order('nome')
        .limit(50)
      if (q?.trim()) {
        query = query.or(`nome.ilike.%${q.trim()}%,contacto.ilike.%${q.trim()}%`)
      }
      return query
    })(),
    supabase
      .from('tipos_cliente')
      .select('id, nome')
      .eq('tenant_id', tenant.id)
      .order('ordem'),
  ])

  const tipos = (tiposRes.data ?? []).map(t => ({ id: t.id, nome: t.nome }))

  const clientes = (clientesRes.data ?? []).map(c => ({
    id:            c.id,
    nome:          c.nome,
    contacto:      c.contacto,
    tipoClienteId: c.tipo_cliente_id as string | null,
    codigo:        (c.codigo as string | null) ?? null,
    tipoNome:      (c.tipos_cliente as unknown as { nome: string } | null)?.nome ?? '—',
    numPedidos:    Array.isArray(c.pedidos) ? c.pedidos.length : 0,
  }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{clientesRes.count ?? 0} registos</p>
        </div>
      </div>

      <PesquisaClientes q={q ?? ''} />

      {/* Cards mobile */}
      <div className="md:hidden space-y-2">
        {clientes.map((c) => (
          <div key={c.id} className="bg-white rounded-2xl border border-slate-200 px-4 py-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-slate-900">{c.nome}</div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">{c.contacto}</div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{c.tipoNome}</span>
                <div className="text-xs text-slate-400 mt-1">{c.numPedidos} pedidos</div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2">
              {c.codigo
                ? <span className="font-mono text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded">{c.codigo}</span>
                : <span />
              }
              <EditarCliente tenantId={tenant.id} cliente={{ id: c.id, nome: c.nome, contacto: c.contacto, tipoClienteId: c.tipoClienteId, codigo: c.codigo }} tipos={tipos} />
            </div>
          </div>
        ))}
        {clientes.length === 0 && (
          <div className="text-center py-8 text-slate-400 text-sm">
            {q ? `Nenhum cliente encontrado para "${q}".` : 'Nenhum cliente registado.'}
          </div>
        )}
      </div>

      {/* Tabela desktop */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 font-medium text-slate-600">Código</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Nome</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Contacto</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Tipo</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Pedidos</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  {c.codigo
                    ? <span className="font-mono text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded">{c.codigo}</span>
                    : <span className="text-slate-300">—</span>
                  }
                </td>
                <td className="px-4 py-3 font-medium text-slate-900">{c.nome}</td>
                <td className="px-4 py-3 font-mono text-slate-600">{c.contacto}</td>
                <td className="px-4 py-3">
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{c.tipoNome}</span>
                </td>
                <td className="px-4 py-3 text-right text-slate-500">{c.numPedidos}</td>
                <td className="px-4 py-3 text-right">
                  <EditarCliente tenantId={tenant.id} cliente={{ id: c.id, nome: c.nome, contacto: c.contacto, tipoClienteId: c.tipoClienteId, codigo: c.codigo }} tipos={tipos} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {clientes.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            {q ? `Nenhum cliente encontrado para "${q}".` : 'Nenhum cliente registado.'}
          </div>
        )}
      </div>

      {(clientesRes.count ?? 0) > 50 && (
        <p className="text-xs text-gray-400 text-center">
          A mostrar 50 de {clientesRes.count} resultados — use a pesquisa para filtrar.
        </p>
      )}
    </div>
  )
}
