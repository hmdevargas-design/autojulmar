import { NextRequest, NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { enviarMensagem } from '@/lib/whatsapp/sender'
import { z } from 'zod'

const ORDEM_ESTADOS = ['corte', 'acabamento', 'separacao', 'avisar', 'avisado', 'entregue'] as const

const schema = z.object({
  estadoProducao: z.enum(ORDEM_ESTADOS),
  tenantId:       z.string().min(1),
  enviarWhatsapp: z.boolean().optional().default(false),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body  = await request.json()
    const input = schema.parse(body)
    const supabase = criarClienteAdmin()

    // Busca estado actual para validar transição e actualizar histórico
    const { data: actual } = await supabase
      .from('pedidos')
      .select('estado_producao, historico_producao, numero_pedido, dados, clientes(nome, contacto)')
      .eq('id', id)
      .eq('tenant_id', input.tenantId)
      .single()

    if (!actual) {
      return NextResponse.json({ erro: 'Pedido não encontrado' }, { status: 404 })
    }

    const idxActual = ORDEM_ESTADOS.indexOf(actual.estado_producao as typeof ORDEM_ESTADOS[number])
    const idxNovo   = ORDEM_ESTADOS.indexOf(input.estadoProducao)

    if (Math.abs(idxNovo - idxActual) !== 1) {
      return NextResponse.json(
        { erro: 'Transição inválida — apenas um estado de cada vez' },
        { status: 400 }
      )
    }

    const historico = Array.isArray(actual.historico_producao) ? [...actual.historico_producao] : []
    historico.push({ estado: input.estadoProducao, timestamp: new Date().toISOString() })

    const { error } = await supabase
      .from('pedidos')
      .update({ estado_producao: input.estadoProducao, historico_producao: historico })
      .eq('id', id)
      .eq('tenant_id', input.tenantId)

    if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

    // Envia WhatsApp ao cliente quando avança para AVISADO
    if (input.estadoProducao === 'avisado' && input.enviarWhatsapp) {
      const cliente  = actual.clientes as unknown as { nome?: string; contacto?: string } | null
      const dados    = actual.dados as Record<string, unknown>
      const contacto = cliente?.contacto
      if (contacto) {
        const telefone     = contacto.replace(/\D/g, '')
        const primeiroNome = (cliente?.nome ?? '').split(' ')[0]
        const tipoTapete   = Array.isArray(dados?.tipoTapete) ? (dados.tipoTapete as string[])[0] : ''
        const lojaNome     = process.env.WHATSAPP_LOJA_NOME ?? 'Autojulmar'
        const msg = `Olá ${primeiroNome}! O seu pedido *#${actual.numero_pedido}*${tipoTapete ? ` (${tipoTapete})` : ''} está pronto para levantamento. Obrigado — ${lojaNome} 🎉`
        enviarMensagem(telefone, msg).catch(err =>
          console.error('[Producao] Erro ao notificar cliente:', String(err))
        )
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Producao] Erro ao actualizar estado:', error)
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}
