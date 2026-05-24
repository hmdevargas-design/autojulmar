import { NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import DocumentoOrcamentoPDF from '@/components/orcamentos/DocumentoOrcamentoPDF'
import React, { type ReactElement } from 'react'
import { corEstadoOrcamento, formatarNumeroOrcamento, labelCategoriaOrcamento, labelEstadoOrcamento, labelProdutoOrcamento } from '@/lib/orcamentos/config'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = criarClienteAdmin()

  const { data: orcamento, error } = await supabase
    .from('orcamentos')
    .select(`
      id, numero_orcamento, estado, categoria, produto, descricao, dados,
      valor_estimado, validade_em, criado_em,
      clientes ( nome, contacto ),
      tenants ( nome )
    `)
    .eq('id', id)
    .single()

  if (error || !orcamento) {
    return NextResponse.json({ erro: 'Orçamento não encontrado' }, { status: 404 })
  }

  const cliente = orcamento.clientes as unknown as { nome: string; contacto: string } | null
  const tenant = orcamento.tenants as unknown as { nome: string } | null
  const dados = (orcamento.dados ?? {}) as Record<string, string>
  const validade = orcamento.validade_em
    ? new Date(orcamento.validade_em).toLocaleDateString('pt-PT')
    : '—'

  const props = {
    numeroOrcamento: orcamento.numero_orcamento,
    nomeTenant: tenant?.nome ?? 'Plataforma',
    nomeCliente: cliente?.nome ?? '—',
    contacto: cliente?.contacto ?? '—',
    matricula: String(dados.matricula ?? ''),
    viatura: String(dados.viatura ?? ''),
    ano: String(dados.ano ?? ''),
    categoria: labelCategoriaOrcamento(orcamento.categoria),
    produto: labelProdutoOrcamento(orcamento.categoria, orcamento.produto),
    descricao: orcamento.descricao ?? '',
    estado: labelEstadoOrcamento(orcamento.estado),
    corEstado: corEstadoOrcamento(orcamento.estado),
    valorEstimado: Number(orcamento.valor_estimado),
    data: new Date(orcamento.criado_em).toLocaleDateString('pt-PT'),
    validade,
  }

  const elemento = React.createElement(DocumentoOrcamentoPDF, props) as unknown as ReactElement<DocumentProps>
  const buffer = await renderToBuffer(elemento)

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${formatarNumeroOrcamento(orcamento.numero_orcamento).toLowerCase()}.pdf"`,
    },
  })
}
