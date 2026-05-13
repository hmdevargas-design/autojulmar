import { resolverTenant } from '@/lib/tenant/resolver'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { carregarConfigTenant, carregarConfigPreco } from '@/lib/tenant/config'
import { notFound } from 'next/navigation'
import FormularioEditarPedido from '@/components/forms/FormularioEditarPedido'

interface Props {
  params: Promise<{ tenant: string; id: string }>
}

export default async function PaginaEditarPedido({ params }: Props) {
  const { tenant: slug, id } = await params

  const tenant = await resolverTenant(slug)
  if (!tenant) notFound()

  const supabase = criarClienteAdmin()

  const [pedidoRes, config, configPreco] = await Promise.all([
    supabase
      .from('pedidos')
      .select(`
        id, numero_pedido, dados,
        desconto_manual, valor_final, sinal, forma_pagamento,
        clientes ( nome, contacto, tipo_cliente_id )
      `)
      .eq('id', id)
      .eq('tenant_id', tenant.id)
      .single(),
    carregarConfigTenant(tenant.id),
    carregarConfigPreco(tenant.id),
  ])

  if (!pedidoRes.data || !config || !configPreco) notFound()

  const p      = pedidoRes.data
  const dados  = (p.dados ?? {}) as Record<string, unknown>
  const cliente = p.clientes as unknown as {
    nome: string
    contacto: string
    tipo_cliente_id: string | null
  } | null

  const defaultValues = {
    matricula:      typeof dados.matricula   === 'string' ? dados.matricula   : '',
    viatura:        typeof dados.viatura     === 'string' ? dados.viatura     : '',
    ano:            typeof dados.ano         === 'string' ? dados.ano         : '',
    combustivel:    typeof dados.combustivel === 'string' ? dados.combustivel : '',
    maisInfo:       typeof dados.maisInfo    === 'string' ? dados.maisInfo    : '',
    material:       typeof dados.material    === 'string' ? dados.material    : '',
    tipoTapete:     Array.isArray(dados.tipo_tapete) ? (dados.tipo_tapete as string[]) : [],
    extras:         Array.isArray(dados.extras)      ? (dados.extras      as string[]) : [],
    extrasQuantidades:
      typeof dados.extras_quantidades === 'object' && dados.extras_quantidades !== null
        ? (dados.extras_quantidades as Record<string, number>)
        : {},
    quantidade:     typeof dados.quantidade === 'number' ? (dados.quantidade as number) : 1,
    tipoClienteId:  cliente?.tipo_cliente_id ?? '',
    descontoManual: Number(p.desconto_manual) || 0,
    valor:          Number(p.valor_final)     || 0,
    sinal:          Number(p.sinal)           || 0,
    formaPagamento: p.forma_pagamento         ?? '',
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">
        Editar Pedido #{p.numero_pedido}
      </h1>
      <FormularioEditarPedido
        pedidoId={id}
        tenantId={tenant.id}
        tenantSlug={slug}
        clienteNome={cliente?.nome ?? '—'}
        config={config}
        configPreco={configPreco}
        defaultValues={defaultValues}
      />
    </div>
  )
}
