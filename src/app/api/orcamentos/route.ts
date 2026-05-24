import { NextRequest, NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

async function obterProximoNumeroOrcamento(supabase: ReturnType<typeof criarClienteAdmin>, tenantId: string) {
  const { data: numeroData, error: numeroError } = await supabase
    .rpc('proximo_numero_orcamento', { p_tenant_id: tenantId })

  if (!numeroError && typeof numeroData === 'number') return numeroData

  console.warn('[Orcamentos] Falha ao usar RPC de numeracao, aplicando fallback:', numeroError?.message)

  const { data: ultimoOrcamento, error: ultimoError } = await supabase
    .from('orcamentos')
    .select('numero_orcamento')
    .eq('tenant_id', tenantId)
    .order('numero_orcamento', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (ultimoError) throw new Error('Erro ao gerar numero de orcamento')

  return Number(ultimoOrcamento?.numero_orcamento ?? 0) + 1
}

const schemaCriarOrcamento = z.object({
  tenantId:        z.string().min(1),
  clienteNome:     z.string().min(1),
  clienteContacto: z.string().min(9),
  categoria:       z.enum(['reparacao', 'capas', 'outros']),
  produto:         z.string().min(1),
  descricao:       z.string().optional().default(''),
  matricula:       z.string().optional().default(''),
  viatura:         z.string().optional().default(''),
  ano:             z.string().optional().default(''),
  valorEstimado:   z.coerce.number().min(0).default(0),
  validadeEm:      z.string().optional().nullable(),
  origem:          z.enum(['web', 'whatsapp', 'api']).default('web'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const input = schemaCriarOrcamento.parse(body)
    const supabase = criarClienteAdmin()
    const validadePadrao = new Date()
    validadePadrao.setDate(validadePadrao.getDate() + 30)
    const validadeEm = input.validadeEm || validadePadrao.toISOString().slice(0, 10)

    let clienteId: string
    const contacto = input.clienteContacto.replace(/\s/g, '')

    const { data: clienteExistente } = await supabase
      .from('clientes')
      .select('id')
      .eq('tenant_id', input.tenantId)
      .eq('contacto', contacto)
      .single()

    if (clienteExistente) {
      clienteId = clienteExistente.id
    } else {
      const { data: novoCliente, error: erroCliente } = await supabase
        .from('clientes')
        .insert({
          tenant_id: input.tenantId,
          nome: input.clienteNome,
          contacto,
        })
        .select('id')
        .single()

      if (erroCliente || !novoCliente) {
        return NextResponse.json({ erro: 'Erro ao criar cliente' }, { status: 500 })
      }

      clienteId = novoCliente.id
    }

    let numeroData: number
    try {
      numeroData = await obterProximoNumeroOrcamento(supabase, input.tenantId)
    } catch (error) {
      console.error('[Orcamentos] Erro ao gerar numero:', error)
      return NextResponse.json({ erro: 'Erro ao gerar numero de orcamento' }, { status: 500 })
    }

    const { data: orcamento, error: erroOrcamento } = await supabase
      .from('orcamentos')
      .insert({
        tenant_id: input.tenantId,
        cliente_id: clienteId,
        numero_orcamento: numeroData,
        estado: 'rascunho',
        categoria: input.categoria,
        produto: input.produto,
        descricao: input.descricao.trim() || null,
        valor_estimado: input.valorEstimado,
        validade_em: validadeEm,
        origem: input.origem,
        dados: {
          matricula: input.matricula.trim(),
          viatura: input.viatura.trim(),
          ano: input.ano.trim(),
        },
        criado_por: '00000000-0000-0000-0000-000000000001',
      })
      .select('id, numero_orcamento, valor_estimado')
      .single()

    if (erroOrcamento || !orcamento) {
      console.error('Erro ao criar orçamento:', erroOrcamento)
      return NextResponse.json({ erro: 'Erro ao criar orçamento' }, { status: 500 })
    }

    return NextResponse.json({
      id: orcamento.id,
      numeroOrcamento: orcamento.numero_orcamento,
      valorEstimado: orcamento.valor_estimado,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ erro: 'Dados inválidos', detalhes: error.issues }, { status: 400 })
    }
    console.error('Erro inesperado:', error)
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}
