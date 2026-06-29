import { NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import {
  formatarNumeroOrcamento,
  labelCategoriaOrcamento,
  labelEstadoOrcamento,
  labelProdutoOrcamento,
} from '@/lib/orcamentos/config'

type DadosOrcamento = Record<string, string | number | null | undefined>

function esc(valor: unknown) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function dinheiro(valor: unknown) {
  return `${Number(valor || 0).toFixed(2)} EUR`
}

function linha(label: string, valor: unknown, destaque = false) {
  const texto = String(valor ?? '').trim()
  if (!texto) return ''

  return `
    <div class="linha ${destaque ? 'destaque' : ''}">
      <span>${esc(label)}</span>
      <strong>${esc(texto)}</strong>
    </div>
  `
}

function bloco(label: string, valor: unknown) {
  const texto = String(valor ?? '').trim()
  if (!texto) return ''

  return `
    <div class="bloco">
      <strong>${esc(label)}</strong>
      <p>${esc(texto)}</p>
    </div>
  `
}

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
    return NextResponse.json({ erro: 'Orcamento nao encontrado' }, { status: 404 })
  }

  const cliente = orcamento.clientes as unknown as { nome: string; contacto: string } | null
  const tenant = orcamento.tenants as unknown as { nome: string } | null
  const dados = (orcamento.dados ?? {}) as DadosOrcamento
  const numero = formatarNumeroOrcamento(orcamento.numero_orcamento)
  const criadoEm = new Date(orcamento.criado_em).toLocaleDateString('pt-PT')
  const validade = orcamento.validade_em
    ? new Date(orcamento.validade_em).toLocaleDateString('pt-PT')
    : ''

  const categoria = labelCategoriaOrcamento(orcamento.categoria)
  const produto = labelProdutoOrcamento(orcamento.categoria, orcamento.produto)
  const estado = labelEstadoOrcamento(orcamento.estado)

  const html = `<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(numero)}</title>
  <style>
    @page { size: 72mm auto; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; }
    body {
      width: 72mm;
      min-height: 100%;
      padding: 3mm;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      line-height: 1.22;
      text-transform: uppercase;
    }
    .empresa { text-align: center; font-size: 14px; font-weight: 800; }
    .subtitulo { text-align: center; font-size: 10px; margin-top: 1mm; }
    .topo { display: flex; justify-content: space-between; align-items: flex-end; gap: 2mm; margin: 2mm 0; }
    .pedido { font-size: 17px; font-weight: 800; }
    .data { font-size: 9px; white-space: nowrap; }
    .sep { border-top: 1px dashed #000; margin: 2mm 0; }
    .titulo { font-weight: 800; margin-bottom: 1mm; }
    .linha { display: flex; justify-content: space-between; gap: 3mm; margin-bottom: 1mm; }
    .linha span { flex: 0 0 auto; }
    .linha strong { flex: 1 1 auto; text-align: right; overflow-wrap: anywhere; }
    .destaque span, .destaque strong { font-weight: 800; }
    .bloco { margin-bottom: 1mm; }
    .bloco strong { display: block; font-weight: 800; }
    .bloco p { margin: 0.5mm 0 0; overflow-wrap: anywhere; }
    .total {
      display: flex;
      justify-content: space-between;
      gap: 3mm;
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
      padding: 1.5mm 0;
      margin: 2mm 0;
      font-size: 18px;
      font-weight: 800;
    }
    .rodape { text-align: center; margin-top: 3mm; font-size: 11px; }
    @media screen {
      html { background: #e5e7eb; }
      body { margin: 12px auto; box-shadow: 0 0 0 1px #d1d5db; }
    }
  </style>
</head>
<body>
  <div class="empresa">${esc(tenant?.nome ?? 'Plataforma')}</div>
  <div class="subtitulo">ORCAMENTO</div>

  <div class="sep"></div>
  <div class="topo">
    <div class="pedido">${esc(numero)}</div>
    <div class="data">${esc(criadoEm)}</div>
  </div>

  <div class="sep"></div>
  <div class="titulo">CLIENTE</div>
  ${linha('Nome', cliente?.nome ?? '-')}
  ${linha('Tel', cliente?.contacto ?? '-')}

  <div class="sep"></div>
  <div class="titulo">VIATURA</div>
  ${linha('Matricula', dados.matricula || '-')}
  ${linha('Viatura', dados.viatura)}
  ${linha('Ano', dados.ano)}

  <div class="sep"></div>
  <div class="titulo">SERVICO</div>
  ${linha('Categoria', categoria || '-')}
  ${linha('Produto', produto || '-')}
  ${bloco('Descricao', orcamento.descricao)}

  <div class="sep"></div>
  <div class="titulo">ACOMPANHAMENTO</div>
  ${linha('Estado', estado || '-')}
  ${linha('Validade', validade)}

  <div class="total">
    <span>VALOR</span>
    <span>${esc(dinheiro(orcamento.valor_estimado))}</span>
  </div>

  <div class="sep"></div>
  <div class="rodape">${esc(tenant?.nome ?? 'Plataforma')} - ORCAMENTO VALIDO MEDIANTE CONFIRMACAO</div>
</body>
</html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
