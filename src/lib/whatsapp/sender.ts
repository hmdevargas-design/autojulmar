// Envia mensagens de texto via WhatsApp Cloud API (Meta)

export async function enviarMensagem(para: string, texto: string): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const token        = process.env.WHATSAPP_API_TOKEN

  if (!phoneNumberId || !token) {
    console.warn('[WhatsApp] Credenciais não configuradas — mensagem não enviada')
    return
  }

  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to:   para,
      type: 'text',
      text: { body: texto },
    }),
  })

  if (!res.ok) {
    const erro = await res.text()
    console.error('[WhatsApp] Erro ao enviar mensagem:', erro)
  }
}
