import { NextRequest, NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import DocumentoPedidoPDF from '@/components/pedidos/DocumentoPedidoPDF'
import DocumentoPedidoTermica from '@/components/pedidos/DocumentoPedidoTermica'
import React, { type ReactElement } from 'react'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const formato = request.nextUrl.searchParams.get('formato') ?? 'termica'
  const supabase = criarClienteAdmin()

  const { data: pedido, error } = await supabase
    .from('pedidos')
    .select(`
      id, numero_pedido, valor_final, soma_extras, preco_base,
      subtotal, desconto_tipo_pct, desconto_manual, sinal,
      forma_pagamento, criado_em, dados,
      clientes ( nome, contacto, tipos_cliente ( nome, desconto_pct ) ),
      estados_fluxo ( nome, cor ),
      tenants ( nome )
    `)
    .eq('id', id)
    .single()

  if (error || !pedido) {
    return NextResponse.json({ erro: 'Pedido não encontrado' }, { status: 404 })
  }

  const cliente = pedido.clientes as unknown as {
    nome: string; contacto: string
    tipos_cliente: { nome: string; desconto_pct: number } | null
  } | null
  const estado = pedido.estados_fluxo as unknown as { nome: string; cor: string } | null
  const tenant = pedido.tenants as unknown as { nome: string } | null
  const dados = pedido.dados as Record<string, string | string[]>

  const valorFinal = Number(pedido.valor_final)
  const sinal = Number(pedido.sinal)

  const props = {
    numeroPedido:      pedido.numero_pedido,
    nomeCliente:       cliente?.nome ?? '—',
    contacto:          cliente?.contacto ?? '—',
    tipoCliente:       cliente?.tipos_cliente?.nome ?? '—',
    matricula:         String(dados?.matricula ?? ''),
    viatura:           String(dados?.viatura ?? ''),
    ano:               String(dados?.ano ?? ''),
    combustivel:       String(dados?.combustivel ?? ''),
    material:          String(dados?.material ?? ''),
    tipoTapete:        Array.isArray(dados?.tipoTapete) ? (dados.tipoTapete as string[]) : [],
    extras:            Array.isArray(dados?.extras) ? (dados.extras as string[]) : [],
    estado:            estado?.nome ?? '—',
    corEstado:         estado?.cor ?? '#64748b',
    precoBase:         Number(pedido.preco_base),
    somaExtras:        Number(pedido.soma_extras),
    subtotal:          Number(pedido.subtotal),
    descontoPct:       Number(pedido.desconto_tipo_pct),
    descontoValorTipo: Number(pedido.subtotal) * (Number(pedido.desconto_tipo_pct) / 100),
    descontoManual:    Number(pedido.desconto_manual),
    valorFinal,
    sinal,
    valorEmFalta:      Math.max(0, valorFinal - sinal),
    formaPagamento:    pedido.forma_pagamento,
    data:              new Date(pedido.criado_em).toLocaleDateString('pt-PT'),
    nomeTenant:        tenant?.nome ?? 'Plataforma',
  }

  const Componente = formato === 'a4' ? DocumentoPedidoPDF : DocumentoPedidoTermica
  const elemento = React.createElement(Componente, props) as unknown as ReactElement<DocumentProps>

  const buffer = await renderToBuffer(elemento)

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `inline; filename="pedido-${pedido.numero_pedido}.pdf"`,
    },
  })
}
