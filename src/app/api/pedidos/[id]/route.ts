import { NextRequest, NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { calcularPreco } from '@/core/pricing/engine'
import { carregarConfigPreco } from '@/lib/tenant/config'
import { z } from 'zod'

const schemaEditar = z.object({
  tenantId:          z.string().min(1),
  matricula:         z.string().optional(),
  viatura:           z.string().optional(),
  ano:               z.string().optional(),
  combustivel:       z.string().optional(),
  material:          z.string(),
  tipoTapete:        z.array(z.string()),
  extras:            z.array(z.string()).default([]),
  extrasQuantidades: z.record(z.string(), z.number()).optional(),
  quantidade:        z.coerce.number().min(1).default(1),
  maisInfo:          z.string().optional(),
  tipoClienteId:     z.string(),
  descontoManual:    z.coerce.number().min(0).default(0),
  valor:             z.coerce.number().min(0),
  sinal:             z.coerce.number().min(0).default(0),
  formaPagamento:    z.string(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body  = await request.json()
    const input = schemaEditar.parse(body)
    const supabase = criarClienteAdmin()

    // Confirma que o pedido existe e pertence ao tenant
    const { data: pedidoActual } = await supabase
      .from('pedidos')
      .select('id, tenant_id, dados')
      .eq('id', id)
      .eq('tenant_id', input.tenantId)
      .single()

    if (!pedidoActual) {
      return NextResponse.json({ erro: 'Pedido não encontrado' }, { status: 404 })
    }

    // Tipo cliente para desconto
    const { data: tipoClienteInfo } = await supabase
      .from('tipos_cliente')
      .select('id, desconto_pct')
      .eq('tenant_id', input.tenantId)
      .eq('id', input.tipoClienteId)
      .single()

    // Recalcula preço
    let precoBase = 0, somaExtras = 0, subtotal = 0, descontoPct = 0
    const configPreco = await carregarConfigPreco(input.tenantId)
    if (configPreco) {
      const resultado = calcularPreco(
        {
          campo1Valor:       input.material,
          campo2Valor:       input.tipoTapete[0] ?? '',
          extras:            input.extras,
          extrasQuantidades: input.extrasQuantidades,
          tipoClienteId:     tipoClienteInfo?.id ?? input.tipoClienteId,
          quantidade:        input.quantidade,
          descontoManual:    input.descontoManual,
          sinal:             input.sinal,
        },
        configPreco
      )
      precoBase   = resultado.precoBase
      somaExtras  = resultado.somaExtras
      subtotal    = resultado.subtotal
      descontoPct = tipoClienteInfo ? Number(tipoClienteInfo.desconto_pct) : 0
    }

    // Preserva campos desconhecidos no JSONB (ex: dados de WhatsApp)
    const dadosExistentes = (pedidoActual.dados ?? {}) as Record<string, unknown>
    const dados = {
      ...dadosExistentes,
      matricula:          input.matricula,
      viatura:            input.viatura,
      ano:                input.ano,
      combustivel:        input.combustivel,
      maisInfo:           input.maisInfo,
      material:           input.material,
      tipo_tapete:        input.tipoTapete,
      extras:             input.extras,
      extras_quantidades: input.extrasQuantidades,
      quantidade:         input.quantidade,
    }

    const { error } = await supabase
      .from('pedidos')
      .update({
        dados,
        preco_base:        precoBase,
        soma_extras:       somaExtras,
        subtotal,
        desconto_tipo_pct: descontoPct,
        desconto_manual:   input.descontoManual,
        valor_final:       input.valor,
        sinal:             input.sinal,
        forma_pagamento:   input.formaPagamento,
      })
      .eq('id', id)
      .eq('tenant_id', input.tenantId)

    if (error) {
      return NextResponse.json({ erro: 'Erro ao actualizar pedido' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ erro: 'Dados inválidos', detalhes: err.issues }, { status: 400 })
    }
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}
