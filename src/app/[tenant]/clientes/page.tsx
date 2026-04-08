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

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Código</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Contacto</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Pedidos</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => (
              <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  {c.codigo
                    ? <span className="font-mono text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">{c.codigo}</span>
                    : <span className="text-gray-300">—</span>
                  }
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">{c.nome}</td>
                <td className="px-4 py-3 font-mono text-gray-600">{c.contacto}</td>
                <td className="px-4 py-3">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {c.tipoNome}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-gray-500">{c.numPedidos}</td>
                <td className="px-4 py-3 text-right">
                  <EditarCliente
                    tenantId={tenant.id}
                    cliente={{ id: c.id, nome: c.nome, contacto: c.contacto, tipoClienteId: c.tipoClienteId, codigo: c.codigo }}
                    tipos={tipos}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {clientes.length === 0 && (
          <div className="text-center py-12 text-gray-500">
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
