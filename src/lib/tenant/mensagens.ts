import { criarClienteAdmin } from '@/lib/supabase/admin'
import {
  CHAVE_MENSAGEM_PEDIDO_PRONTO,
  TEMPLATE_PEDIDO_PRONTO_PADRAO,
} from '@/core/messages/templates'

interface CampoOpcaoMensagem {
  valor?: string
  label?: string
  activo?: boolean
}

export interface MensagemTenant {
  chave: string
  titulo: string
  corpo: string
}

function extrairCorpo(opcoes: unknown): string | null {
  if (!Array.isArray(opcoes)) return null
  const lista = opcoes as CampoOpcaoMensagem[]
  const opcao = lista.find(o => o.valor === 'corpo') ?? lista[0]
  return typeof opcao?.label === 'string' ? opcao.label : null
}

export function mensagemPedidoProntoPadrao(): MensagemTenant {
  return {
    chave: CHAVE_MENSAGEM_PEDIDO_PRONTO,
    titulo: 'Pedido pronto',
    corpo: TEMPLATE_PEDIDO_PRONTO_PADRAO,
  }
}

export async function carregarMensagemPedidoPronto(tenantId: string): Promise<MensagemTenant> {
  const supabase = criarClienteAdmin()
  const { data } = await supabase
    .from('campos_definicao')
    .select('label, opcoes')
    .eq('tenant_id', tenantId)
    .eq('nome', CHAVE_MENSAGEM_PEDIDO_PRONTO)
    .maybeSingle()

  const padrao = mensagemPedidoProntoPadrao()
  const corpo = extrairCorpo(data?.opcoes)

  return {
    chave: CHAVE_MENSAGEM_PEDIDO_PRONTO,
    titulo: data?.label?.replace(/^Mensagem:\s*/i, '') || padrao.titulo,
    corpo: corpo?.trim() || padrao.corpo,
  }
}

export async function guardarMensagemPedidoPronto(tenantId: string, corpo: string): Promise<MensagemTenant> {
  const mensagem = mensagemPedidoProntoPadrao()
  const corpoNormalizado = corpo.trim() || mensagem.corpo
  const supabase = criarClienteAdmin()

  const { error } = await supabase
    .from('campos_definicao')
    .upsert({
      tenant_id: tenantId,
      nome: CHAVE_MENSAGEM_PEDIDO_PRONTO,
      label: 'Mensagem: Pedido pronto',
      tipo: 'textarea',
      opcoes: [
        {
          valor: 'corpo',
          label: corpoNormalizado,
          ordem: 1,
          activo: true,
        },
      ],
      obrigatorio: false,
      ordem: 900,
      activo: true,
      e_variavel_preco: false,
      papel_preco: null,
    }, { onConflict: 'tenant_id,nome' })

  if (error) throw error

  return {
    ...mensagem,
    corpo: corpoNormalizado,
  }
}
