import { NextRequest, NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { calcularPreco } from '@/core/pricing/engine'
import { carregarConfigPreco } from '@/lib/tenant/config'
import { z } from 'zod'

const schemaCriarPedido = z.object({
  tenantId:        z.string().min(1),
  clienteNome:     z.string().min(1),
  clienteContacto: z.string().min(9),
  tipoClienteId:   z.string(),
  estadoId:        z.string(),
  dados:           z.record(z.string(), z.unknown()),
  material:        z.string(),
  tipoTapete:      z.array(z.string()),
  extras:              z.array(z.string()).default([]),
  extrasQuantidades:   z.record(z.string(), z.number()).optional(),
  quantidade:      z.coerce.number().min(1).default(1),
  descontoManual:  z.coerce.number().min(0).default(0),
  sinal:           z.coerce.number().min(0).default(0),
  formaPagamento:  z.string(),
  origem:          z.enum(['web', 'whatsapp', 'api']).default('web'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const input = schemaCriarPedido.parse(body)

    const supabaseAdmin = criarClienteAdmin()

    // 1. Obtém ou cria o cliente
    let clienteId: string

    const { data: clienteExistente } = await supabaseAdmin
      .from('clientes')
      .select('id, tipo_cliente_id')
      .eq('tenant_id', input.tenantId)
      .eq('contacto', input.clienteContacto)
      .single()

    if (clienteExistente) {
      clienteId = clienteExistente.id
    } else {
      // Obtém o UUID do tipo cliente a partir do nome
      const { data: tipoCliente } = await supabaseAdmin
        .from('tipos_cliente')
        .select('id')
        .eq('tenant_id', input.tenantId)
        .eq('id', input.tipoClienteId)
        .single()

      const { data: novoCliente, error: erroCliente } = await supabaseAdmin
        .from('clientes')
        .insert({
          tenant_id:       input.tenantId,
          nome:            input.clienteNome,
          contacto:        input.clienteContacto,
          tipo_cliente_id: tipoCliente?.id ?? null,
        })
        .select('id')
        .single()

      if (erroCliente || !novoCliente) {
        return NextResponse.json({ erro: 'Erro ao criar cliente' }, { status: 500 })
      }

      clienteId = novoCliente.id
    }

    // 2. Obtém estado inicial (primeiro estado do fluxo)
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

    // Descobre o UUID do tipo cliente e o desconto associado
    const { data: tipoClienteInfo } = await supabaseAdmin
      .from('tipos_cliente')
      .select('id, desconto_pct')
      .eq('tenant_id', input.tenantId)
      .eq('id', input.tipoClienteId)
      .single()

    const descontoPct = tipoClienteInfo ? Number(tipoClienteInfo.desconto_pct) : 0

    let precoBase = 0, somaExtras = 0, subtotal = 0, descontoValor = 0, valorFinal = 0

    if (configPreco) {
      const resultado = calcularPreco(
        {
          campo1Valor:    input.material,
          campo2Valor:    input.tipoTapete[0] ?? '',
          extras:             input.extras,
          extrasQuantidades:  input.extrasQuantidades,
          tipoClienteId:      tipoClienteInfo?.id ?? input.tipoClienteId,
          quantidade:     input.quantidade,
          descontoManual: input.descontoManual,
          sinal:          input.sinal,
        },
        configPreco
      )
      precoBase     = resultado.precoBase
      somaExtras    = resultado.somaExtras
      subtotal      = resultado.subtotal
      descontoValor = resultado.descontoValorTipo
      valorFinal    = resultado.valorFinal
    }

    // 4. Obtém próximo número de pedido
    const { data: numeroData, error: numeroError } = await supabaseAdmin
      .rpc('proximo_numero_pedido', { p_tenant_id: input.tenantId })

    if (numeroError) {
      return NextResponse.json({ erro: 'Erro ao gerar número de pedido' }, { status: 500 })
    }

    // 5. Cria o pedido
    const { data: pedido, error: erroPedido } = await supabaseAdmin
      .from('pedidos')
      .insert({
        tenant_id:         input.tenantId,
        cliente_id:        clienteId,
        numero_pedido:     numeroData,
        estado_id:         estadoId,
        dados:             input.dados,
        preco_base:        precoBase,
        soma_extras:       somaExtras,
        subtotal:          subtotal,
        desconto_tipo_pct: descontoPct,
        desconto_manual:   input.descontoManual,
        valor_final:       valorFinal,
        sinal:             input.sinal,
        forma_pagamento:   input.formaPagamento,
        origem:            input.origem,
        criado_por:        '00000000-0000-0000-0000-000000000001', // TODO: usar userId autenticado
      })
      .select('id, numero_pedido, valor_final')
      .single()

    if (erroPedido || !pedido) {
      console.error('Erro ao criar pedido:', erroPedido)
      return NextResponse.json({ erro: 'Erro ao criar pedido' }, { status: 500 })
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
