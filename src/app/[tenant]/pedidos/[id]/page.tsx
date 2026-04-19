import { resolverTenant } from '@/lib/tenant/resolver'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import SeletorEstado from '@/components/pedidos/SeletorEstado'

interface Props {
  params: Promise<{ tenant: string; id: string }>
}

export default async function PaginaDetalhe({ params }: Props) {
  const { tenant: slug, id } = await params

  const tenant = await resolverTenant(slug)
  if (!tenant) notFound()

  const supabase = criarClienteAdmin()

  const [pedidoRes, estadosRes] = await Promise.all([
    supabase
      .from('pedidos')
      .select(`
        id, numero_pedido, criado_em, origem, forma_pagamento,
        preco_base, soma_extras, subtotal, desconto_tipo_pct, desconto_manual, valor_final, sinal,
        dados,
        clientes ( id, nome, contacto, email, nif, tipos_cliente ( nome ) ),
        estados_fluxo ( id, nome, cor )
      `)
      .eq('id', id)
      .eq('tenant_id', tenant.id)
      .single(),
    supabase
      .from('estados_fluxo')
      .select('id, nome, cor')
      .eq('tenant_id', tenant.id)
      .order('ordem'),
  ])

  if (!pedidoRes.data) notFound()

  const p      = pedidoRes.data
  const dados  = (p.dados ?? {}) as Record<string, unknown>
  const cliente = p.clientes as unknown as { id: string; nome: string; contacto: string; email?: string; nif?: string; tipos_cliente?: { nome: string } | null } | null
  const estado  = p.estados_fluxo as unknown as { id: string; nome: string; cor: string } | null
  const estados = (estadosRes.data ?? []).map(e => ({ id: e.id, nome: e.nome, cor: e.cor }))

  const matriculaFmt = dados.matricula
    ? String(dados.matricula).replace(/([A-Z0-9]{2})([A-Z0-9]{2})([A-Z0-9]+)/, '$1-$2-$3')
    : null

  const tipoTapetes = Array.isArray(dados.tipoTapete) ? (dados.tipoTapete as string[]).join(' + ') : String(dados.tipoTapete ?? '')
  const extras      = Array.isArray(dados.extras) && (dados.extras as string[]).length > 0
    ? (dados.extras as string[]).join(', ')
    : null

  const origemLabel: Record<string, string> = { web: 'Web', whatsapp: 'WhatsApp', api: 'API' }

  return (
    <div className="max-w-2xl">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/${slug}/pedidos`} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
          ← Pedidos
        </Link>
        <span className="text-slate-300 dark:text-slate-700">/</span>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Pedido #{p.numero_pedido}
        </h1>
        {estado && (
          <div className="ml-auto">
            <SeletorEstado pedidoId={p.id} tenantId={tenant.id} estadoAtual={estado} estados={estados} />
          </div>
        )}
      </div>

      <div className="space-y-4">
        {/* Cliente */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <h2 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3">Cliente</h2>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Nome" valor={cliente?.nome} />
            <Campo label="Contacto" valor={cliente?.contacto} />
            <Campo label="Tipo" valor={cliente?.tipos_cliente?.nome} />
            {cliente?.email && <Campo label="Email" valor={cliente.email} />}
            {cliente?.nif   && <Campo label="NIF"   valor={cliente.nif} />}
          </div>
        </section>

        {/* Viatura */}
        {(matriculaFmt || dados.viatura) && (
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
            <h2 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3">Viatura</h2>
            <div className="grid grid-cols-2 gap-3">
              {matriculaFmt && <Campo label="Matrícula" valor={matriculaFmt} mono />}
              {dados.viatura && <Campo label="Viatura"  valor={String(dados.viatura)} />}
              {dados.ano     && <Campo label="Ano"      valor={String(dados.ano)} />}
            </div>
          </section>
        )}

        {/* Tapete */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <h2 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3">Produto</h2>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Material"    valor={String(dados.material ?? '—')} />
            <Campo label="Tipo tapete" valor={tipoTapetes || '—'} />
            {extras   && <Campo label="Extras"    valor={extras} />}
            {(dados.quantidade && Number(dados.quantidade) > 1) && (
              <Campo label="Quantidade" valor={String(dados.quantidade)} />
            )}
            {dados.maisInfo && <Campo label="Notas" valor={String(dados.maisInfo)} className="col-span-2" />}
          </div>
        </section>

        {/* Preços */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <h2 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3">Valores</h2>
          <div className="space-y-2 text-sm">
            <LinhaPoco label="Preço base"   valor={`${Number(p.preco_base).toFixed(2)}€`} />
            {Number(p.soma_extras) > 0 && (
              <LinhaPoco label="Extras"     valor={`+${Number(p.soma_extras).toFixed(2)}€`} />
            )}
            {Number(p.desconto_tipo_pct) > 0 && (
              <LinhaPoco label={`Desc. tipo (${p.desconto_tipo_pct}%)`} valor={`-${(Number(p.subtotal) * Number(p.desconto_tipo_pct) / 100).toFixed(2)}€`} />
            )}
            {Number(p.desconto_manual) > 0 && (
              <LinhaPoco label="Desc. manual" valor={`-${Number(p.desconto_manual).toFixed(2)}€`} />
            )}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-2 mt-2 flex justify-between font-bold text-slate-900 dark:text-slate-100">
              <span>Total</span>
              <span>{Number(p.valor_final).toFixed(2)}€</span>
            </div>
            {Number(p.sinal) > 0 && (
              <LinhaPoco label="Sinal pago" valor={`-${Number(p.sinal).toFixed(2)}€`} />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Campo label="Forma pagamento" valor={p.forma_pagamento ?? '—'} />
            <Campo label="Origem"          valor={origemLabel[p.origem ?? ''] ?? p.origem ?? '—'} />
          </div>
        </section>

        {/* Acções */}
        <div className="flex gap-3">
          <a
            href={`/api/pedidos/${p.id}/pdf`}
            target="_blank"
            className="flex-1 text-center py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
          >
            Abrir PDF
          </a>
          <div className="text-xs text-slate-400 dark:text-slate-500 self-center ml-2">
            {new Date(p.criado_em).toLocaleString('pt-PT')}
          </div>
        </div>
      </div>
    </div>
  )
}

function Campo({ label, valor, mono, className }: { label: string; valor?: string | null; mono?: boolean; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">{label}</div>
      <div className={`text-sm font-medium text-slate-900 dark:text-slate-100 ${mono ? 'font-mono' : ''}`}>
        {valor || '—'}
      </div>
    </div>
  )
}

function LinhaPoco({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex justify-between text-slate-600 dark:text-slate-400">
      <span>{label}</span>
      <span>{valor}</span>
    </div>
  )
}
