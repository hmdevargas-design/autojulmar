import { NextRequest, NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { enviarMensagem } from '@/lib/whatsapp/sender'
import { z } from 'zod'

const schema = z.object({
  estadoId: z.string().min(1),
  tenantId: z.string().min(1),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body  = await request.json()
    const input = schema.parse(body)
    const supabase = criarClienteAdmin()

    const { error } = await supabase
      .from('pedidos')
      .update({ estado_id: input.estadoId })
      .eq('id', id)
      .eq('tenant_id', input.tenantId)

    if (error) return NextResponse.json({ erro: error.message }, { status: 500 })

    // Verifica se o novo estado é "Pronto" para enviar notificação WhatsApp ao cliente
    const { data: estado } = await supabase
      .from('estados_fluxo')
      .select('nome')
      .eq('id', input.estadoId)
      .single()

    if (estado?.nome?.toUpperCase() === 'PRONTO') {
      // Busca número do pedido e contacto do cliente
      const { data: pedido } = await supabase
        .from('pedidos')
        .select('numero_pedido, clientes ( contacto )')
        .eq('id', id)
        .single()

      const contacto = (pedido?.clientes as unknown as { contacto?: string } | null)?.contacto
      if (contacto) {
        const telefone = contacto.replace(/\D/g, '')
        const msg = `✅ O seu pedido *#${pedido?.numero_pedido}* está pronto para levantamento!\n\n🏪 *Autojulmar* — obrigado pela preferência.`
        // Notificação fire-and-forget — não bloqueia a resposta
        enviarMensagem(telefone, msg).catch(err =>
          console.error('[WhatsApp] Erro ao notificar cliente:', String(err))
        )
      }
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}
