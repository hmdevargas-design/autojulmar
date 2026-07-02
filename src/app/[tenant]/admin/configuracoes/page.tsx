import Link from 'next/link'
import { resolverTenant } from '@/lib/tenant/resolver'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import MensagensEditor from '@/components/admin/MensagensEditor'
import { carregarMensagemPedidoPronto } from '@/lib/tenant/mensagens'

interface Props {
  params: Promise<{ tenant: string }>
}

interface CampoOpcao {
  valor: string
  label: string
  ordem: number
  activo: boolean
}

function estado(valor: boolean): string {
  return valor ? 'Ativo' : 'Inativo'
}

function Badge({ activo }: { activo: boolean }) {
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
      activo
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
    }`}>
      {estado(activo)}
    </span>
  )
}

function Acao({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
    >
      {children}
    </Link>
  )
}

export default async function PaginaConfiguracoes({ params }: Props) {
  const { tenant: slug } = await params
  const tenant = await resolverTenant(slug)
  if (!tenant) notFound()

  const supabase = criarClienteAdmin()
  const [camposRes, precosRes, extrasRes, tiposRes, mensagemPedidoPronto] = await Promise.all([
    supabase
      .from('campos_definicao')
      .select('nome, label, opcoes, papel_preco')
      .eq('tenant_id', tenant.id)
      .eq('activo', true)
      .order('ordem'),
    supabase
      .from('tabela_preco_base')
      .select('campo1_valor, campo2_valor')
      .eq('tenant_id', tenant.id),
    supabase
      .from('tabela_preco_extra')
      .select('id')
      .eq('tenant_id', tenant.id),
    supabase
      .from('tipos_cliente')
      .select('id')
      .eq('tenant_id', tenant.id),
    carregarMensagemPedidoPronto(tenant.id),
  ])

  const campos = camposRes.data ?? []
  const campoMaterial = campos.find(c => c.papel_preco === 'base_campo1')
  const campoProduto = campos.find(c => c.papel_preco === 'base_campo2')
  const materiais = ((campoMaterial?.opcoes ?? []) as CampoOpcao[]).filter(o => o.activo !== false)
  const produtos = ((campoProduto?.opcoes ?? []) as CampoOpcao[]).filter(o => o.activo !== false)

  const outbox = process.env.WHATSAPP_OUTBOX_ENABLED !== 'false'
  const worker = process.env.WHATSAPP_OUTBOX_WORKER_ENABLED === 'true'
  const dryRun = process.env.WHATSAPP_OUTBOX_DRY_RUN !== 'false'
  const envioReal = process.env.WHATSAPP_SEND_ENABLED === 'true'
  const observador = process.env.WHATSAPP_OBSERVER_MODE === 'true'
  const agente = process.env.WHATSAPP_AGENT_ENABLED === 'true'

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Modelo base
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
          Configurações
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Central para preparar produtos, mensagens e integrações deste tenant.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section id="produtos" className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Produtos e preços</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Materiais, partes do produto, extras e tabelas por perfil.
              </p>
            </div>
            <Badge activo={(precosRes.data?.length ?? 0) > 0} />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Materiais</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">{materiais.length}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Produtos</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">{produtos.length}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Preços</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">{precosRes.data?.length ?? 0}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Extras</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">{extrasRes.data?.length ?? 0}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Perfis cliente</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">{tiposRes.data?.length ?? 0}</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Acao href={`/${slug}/admin/precos`}>Editar preços</Acao>
            <Acao href={`/${slug}/admin/campos`}>Editar campos</Acao>
          </div>
        </section>

        <section id="mensagens" className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Mensagens</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Textos operacionais usados antes de enviar ao cliente.
              </p>
            </div>
            <Badge activo />
          </div>
          <MensagensEditor tenantId={tenant.id} corpoInicial={mensagemPedidoPronto.corpo} />
          <div className="mt-4">
            <Acao href={`/${slug}/producao`}>Abrir produção</Acao>
          </div>
        </section>

        <section id="integracoes" className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Integrações</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Estado operacional do WhatsApp e envio assíncrono.
              </p>
            </div>
            <Badge activo={outbox && worker && envioReal && !dryRun} />
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500 dark:text-slate-400">Outbox</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">{estado(outbox)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500 dark:text-slate-400">Worker</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">{estado(worker)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500 dark:text-slate-400">Envio real</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">{estado(envioReal && !dryRun)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500 dark:text-slate-400">Agente observador</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">{observador && !agente ? 'Ativo' : 'Rever'}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Checklist para replicar</h2>
        <div className="mt-3 grid gap-2 text-sm text-slate-600 dark:text-slate-300 md:grid-cols-2">
          {[
            'Criar tenant e identidade visual',
            'Definir materiais e produtos',
            'Importar tabelas de preço',
            'Configurar fluxo de produção',
            'Validar PDF, talão e impressão',
            'Ligar WhatsApp em modo seguro',
          ].map(item => (
            <div key={item} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-gold" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
