import { resolverTenant } from '@/lib/tenant/resolver'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import SeletorEstadoOrcamento from '@/components/orcamentos/SeletorEstadoOrcamento'
import { labelCategoriaOrcamento, labelProdutoOrcamento } from '@/lib/orcamentos/config'

interface Props {
  params: Promise<{ tenant: string; id: string }>
}

interface ClienteRow {
  nome: string
  contacto: string
  email: string | null
  nif: string | null
}

export default async function PaginaDetalheOrcamento({ params }: Props) {
  const { tenant: slug, id } = await params
  const tenant = await resolverTenant(slug)
  if (!tenant) notFound()

  const supabase = criarClienteAdmin()
  const { data: orcamento } = await supabase
    .from('orcamentos')
    .select(`
      id, numero_orcamento, estado, categoria, produto, descricao, valor_estimado, validade_em, origem, criado_em,
      clientes ( nome, contacto, email, nif )
    `)
    .eq('id', id)
    .eq('tenant_id', tenant.id)
    .single()

  if (!orcamento) notFound()

  const cliente = orcamento.clientes as unknown as ClienteRow | null
  const criadoEm = new Date(orcamento.criado_em).toLocaleString('pt-PT')
  const validade = orcamento.validade_em ? new Date(orcamento.validade_em).toLocaleDateString('pt-PT') : null
  const origemLabel: Record<string, string> = { web: 'Web', whatsapp: 'WhatsApp', api: 'API' }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/${slug}/orcamentos`} className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
          &larr; Orçamentos
        </Link>
        <span className="text-slate-400 dark:text-slate-600">/</span>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Orçamento #{orcamento.numero_orcamento}</h1>
        <div className="ml-auto">
          <SeletorEstadoOrcamento orcamentoId={orcamento.id} tenantId={tenant.id} estadoAtual={orcamento.estado} />
        </div>
      </div>

      <div className="space-y-4">
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Cliente</h2>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Nome" valor={cliente?.nome ?? null} />
            <Campo label="Contacto" valor={cliente?.contacto ?? null} />
            {cliente?.email ? <Campo label="Email" valor={cliente.email} /> : null}
            {cliente?.nif ? <Campo label="NIF" valor={cliente.nif} /> : null}
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Produto</h2>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Categoria" valor={labelCategoriaOrcamento(orcamento.categoria)} />
            <Campo label="Produto" valor={labelProdutoOrcamento(orcamento.categoria, orcamento.produto)} />
            {orcamento.descricao ? <Campo label="Descrição" valor={orcamento.descricao} className="col-span-2" /> : null}
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Acompanhamento</h2>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Valor estimado" valor={`${Number(orcamento.valor_estimado).toFixed(2)}€`} />
            <Campo label="Validade" valor={validade ?? '—'} />
            <Campo label="Origem" valor={origemLabel[orcamento.origem ?? ''] ?? orcamento.origem ?? '—'} />
            <Campo label="Criado em" valor={criadoEm} />
          </div>
        </section>
      </div>
    </div>
  )
}

function Campo({ label, valor, className }: { label: string; valor?: string | null; className?: string }) {
  return (
    <div className={className ?? ''}>
      <div className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">{label}</div>
      <div className="text-sm font-medium text-slate-900 dark:text-slate-100 whitespace-pre-wrap">{valor ?? '—'}</div>
    </div>
  )
}
