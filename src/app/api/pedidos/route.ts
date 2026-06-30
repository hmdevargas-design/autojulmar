import { NextRequest, NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { calcularPreco } from '@/core/pricing/engine'
import { carregarConfigPreco } from '@/lib/tenant/config'
import { enviarMensagem }              from '@/lib/whatsapp/sender'
import { marcarPedidoNoAtendimento }  from '@/lib/whatsapp/log-atendimento'
import { z } from 'zod'

const schemaCriarPedido = z.object({
  tenantId:          z.string().min(1),
  clienteNome:       z.string().min(1),
  clienteContacto:   z.string().min(9),
  tipoClienteId:     z.string().optional().default(''),
  estadoId:          z.string(),
  dados:             z.record(z.string(), z.unknown()),
  tabelaPreco:       z.string().optional().default('balcao'),
  material:          z.string(),
  tipoTapete:        z.array(z.string()),
  extras:            z.array(z.string()).default([]),
  extrasQuantidades: z.record(z.string(), z.number()).optional(),
  quantidade:        z.coerce.number().min(1).default(1),
  descontoManual:    z.coerce.number().min(0).default(0),
  valorOverride:     z.coerce.number().min(0).optional(),
  sinal:             z.coerce.number().min(0).default(0),
  formaPagamento:    z.string(),
  origem:            z.enum(['web', 'whatsapp', 'api']).default('web'),
})

function formatarNotificacaoGrupo(params: {
  numeroPedido: number
  origem:       string
  clienteNome:  string
  tipoNome:     string
  matricula:    string
  viatura:      string
  material:     string
  tipoTapete:   string[]
  extras:       string[]
  valorFinal:   number
  formaPagamento: string
}): string {
  const { numeroPedido, origem, clienteNome, tipoNome, matricula, viatura,
          material, tipoTapete, extras, valorFinal, formaPagamento } = params

  const origemLabel = origem === 'whatsapp' ? 'WhatsApp' : origem === 'web' ? 'Web' : 'API'
  const produto = [material, tipoTapete.join(' + ')].filter(Boolean).join(' · ')
  const extrasStr = extras.length > 0 ? `\n➕ ${extras.join(', ')}` : ''
  const viaturaStr = [matricula, viatura].filter(Boolean).join(' · ')
  const pagamento = formaPagamento.replace('_', ' ').replace('COBRANCA', 'COBRANÇA')

  return [
    `🆕 *Pedido #${numeroPedido}* — ${origemLabel}`,
    `👤 ${clienteNome}${tipoNome ? ` · ${tipoNome}` : ''}`,
    viaturaStr ? `🚗 ${viaturaStr}` : null,
    `📦 ${produto}${extrasStr}`,
    `💶 *${valorFinal.toFixed(2)}€* · ${pagamento}`,
  ].filter(Boolean).join('\n')
}

export async function POST(request: NextRequest) {
  try {
    const body  = await request.json()
    const input = schemaCriarPedido.parse(body)

    const supabaseAdmin = criarClienteAdmin()

    // 1. Obtém ou cria o cliente
    let clienteId: string
    let tipoNomeCliente = ''

    const { data: clienteExistente } = await supabaseAdmin
      .from('clientes')
      .select('id, tipo_cliente_id, tipos_cliente ( nome )')
      .eq('tenant_id', input.tenantId)
      .eq('contacto', input.clienteContacto)
      .single()

    if (clienteExistente) {
      clienteId = clienteExistente.id
      tipoNomeCliente = (clienteExistente.tipos_cliente as unknown as { nome: string } | null)?.nome ?? ''
    } else {
      const { data: novoCliente, error: erroCliente } = await supabaseAdmin
        .from('clientes')
        .insert({
          tenant_id:       input.tenantId,
          nome:            input.clienteNome,
          contacto:        input.clienteContacto,
          tipo_cliente_id: null,
        })
        .select('id')
        .single()

      if (erroCliente || !novoCliente) {
        return NextResponse.json({ erro: 'Erro ao criar cliente' }, { status: 500 })
      }

      clienteId = novoCliente.id
    }

    // 2. Obtém estado inicial
    let estadoId = input.estadoId
    if (!estadoId) {
      const { data: estadoInicial } = await supabaseAdmin
        .from('estados_fluxo')
        .select('id')
        .eq('tenant_id', input.tenantId)
        .order('ordem')
        .limit(1)
        .single()
      estadoId = estadoInicial?.id ?? ''
    }

    // 3. Calcula preço
    const configPreco = await carregarConfigPreco(input.tenantId)

    const { data: tipoClienteInfo } = input.tipoClienteId
      ? await supabaseAdmin
          .from('tipos_cliente')
          .select('id, nome, desconto_pct')
          .eq('tenant_id', input.tenantId)
          .eq('id', input.tipoClienteId)
          .single()
      : { data: null }

    const descontoPct = tipoClienteInfo ? Number(tipoClienteInfo.desconto_pct) : 0
    tipoNomeCliente = tipoClienteInfo?.nome ?? tipoNomeCliente

    let precoBase = 0, somaExtras = 0, subtotal = 0, valorFinal = 0

    if (configPreco) {
      const resultado = calcularPreco(
        {
          tabelaPreco:       input.tabelaPreco,
          campo1Valor:       input.material,
          campo2Valor:       input.tipoTapete[0] ?? '',
          campo2Valores:     input.tipoTapete,
          extras:            input.extras,
          extrasQuantidades: input.extrasQuantidades,
          tipoClienteId:     tipoClienteInfo?.id ?? '',
          quantidade:        input.quantidade,
          descontoManual:    input.descontoManual,
          sinal:             input.sinal,
        },
        configPreco
      )
      precoBase  = resultado.precoBase
      somaExtras = resultado.somaExtras
      subtotal   = resultado.subtotal
      // valorOverride permite ao operador definir o preço manualmente
      // (usado quando não há entrada na tabela base, ex: malas sem preço fixo)
      valorFinal = (input.valorOverride != null && input.valorOverride > 0 && resultado.valorFinal === 0)
        ? input.valorOverride
        : resultado.valorFinal
    }

    // 4. Próximo número de pedido
    const { data: numeroData, error: numeroError } = await supabaseAdmin
      .rpc('proximo_numero_pedido', { p_tenant_id: input.tenantId })

    if (numeroError) {
      return NextResponse.json({ erro: 'Erro ao gerar número de pedido' }, { status: 500 })
    }

    // 5. Guardar dados completos no JSONB (inclui material/tipo_tapete para o dashboard)
    const dadosCompletos = {
      ...input.dados,
      tabela_preco:       input.tabelaPreco,
      tipo_cliente_pedido_id: tipoClienteInfo?.id ?? null,
      tipo_cliente_pedido_nome: tipoClienteInfo?.nome ?? null,
      material:          input.material,
      tipo_tapete:       input.tipoTapete,
      extras:            input.extras,
      extras_quantidades: input.extrasQuantidades,
      quantidade:        input.quantidade,
    }

    // 6. Cria o pedido
    const { data: pedido, error: erroPedido } = await supabaseAdmin
      .from('pedidos')
      .insert({
        tenant_id:         input.tenantId,
        cliente_id:        clienteId,
        numero_pedido:     numeroData,
        estado_id:         estadoId,
        dados:             dadosCompletos,
        preco_base:        precoBase,
        soma_extras:       somaExtras,
        subtotal,
        desconto_tipo_pct: descontoPct,
        desconto_manual:   input.descontoManual,
        valor_final:       valorFinal,
        sinal:             input.sinal,
        forma_pagamento:   input.formaPagamento,
        origem:            input.origem,
        criado_por:        '00000000-0000-0000-0000-000000000001',
      })
      .select('id, numero_pedido, valor_final')
      .single()

    if (erroPedido || !pedido) {
      console.error('Erro ao criar pedido:', erroPedido)
      return NextResponse.json({ erro: 'Erro ao criar pedido' }, { status: 500 })
    }

    // 7. Marcar log de atendimento se o pedido veio do WhatsApp
    if (input.origem === 'whatsapp') {
      const tel = input.clienteContacto.replace(/\D/g, '')
      marcarPedidoNoAtendimento(input.tenantId, tel, pedido.numero_pedido).catch(e =>
        console.warn('[Pedidos] Falha ao marcar pedido no log de atendimento:', String(e))
      )
    }

    // 8. Notificação para grupo WhatsApp
    const grupoId = process.env.WHATSAPP_GRUPO_PEDIDOS
    console.log('[Grupo] grupoId:', grupoId ?? '(não configurado)')
    if (grupoId) {
      const mensagem = formatarNotificacaoGrupo({
        numeroPedido:   pedido.numero_pedido,
        origem:         input.origem,
        clienteNome:    input.clienteNome,
        tipoNome:       tipoNomeCliente,
        matricula:      String(input.dados.matricula ?? ''),
        viatura:        String(input.dados.viatura   ?? ''),
        material:       input.material,
        tipoTapete:     input.tipoTapete,
        extras:         input.extras,
        valorFinal:     Number(pedido.valor_final),
        formaPagamento: input.formaPagamento,
      })
      try {
        await enviarMensagem(grupoId, mensagem)
        console.log('[Grupo] Notificação enviada — pedido #' + pedido.numero_pedido)
      } catch (err) {
        console.error('[Grupo] Falha ao notificar:', err)
      }
    }

    return NextResponse.json({
      id:           pedido.id,
      numeroPedido: pedido.numero_pedido,
      valorFinal:   pedido.valor_final,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ erro: 'Dados inválidos', detalhes: error.issues }, { status: 400 })
    }
    console.error('Erro inesperado:', error)
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}
