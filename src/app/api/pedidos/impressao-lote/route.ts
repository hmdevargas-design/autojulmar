import { NextRequest, NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'

type DadosPedido = Record<string, string | string[] | number | null | undefined>

type PedidoLote = {
  id: string
  numero_pedido: number
  valor_final: number | string
  soma_extras: number | string
  preco_base: number | string
  subtotal: number | string
  desconto_tipo_pct: number | string
  desconto_manual: number | string
  sinal: number | string
  forma_pagamento: string
  criado_em: string
  dados: DadosPedido | null
  clientes: {
    nome: string
    contacto: string
    tipos_cliente: { nome: string; desconto_pct: number } | null
  } | null
  estados_fluxo: { nome: string; cor: string } | null
  tenants: { nome: string } | null
}

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

function textoArray(valor: unknown) {
  return Array.isArray(valor) ? valor.filter(Boolean).join(' + ') : ''
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

function recibo(pedido: PedidoLote, index: number, total: number) {
  const cliente = pedido.clientes
  const estado = pedido.estados_fluxo
  const tenant = pedido.tenants
  const dados = pedido.dados ?? {}
  const valorFinal = Number(pedido.valor_final)
  const sinal = Number(pedido.sinal)
  const descontoPct = Number(pedido.desconto_tipo_pct)
  const descontoValorTipo = Number(pedido.subtotal) * (descontoPct / 100)
  const descontoManual = Number(pedido.desconto_manual)
  const valorEmFalta = Math.max(0, valorFinal - sinal)
  const tipoCliente = cliente?.tipos_cliente?.nome ?? ''
  const tipoTapete = textoArray(dados.tipo_tapete) || textoArray(dados.tipoTapete)
  const extras = textoArray(dados.extras)

  return `
    <section class="recibo">
      <div class="empresa">${esc(tenant?.nome ?? 'Plataforma')}</div>
      <div class="subtitulo">GUIA DE SERVICO</div>

      <div class="sep"></div>
      <div class="topo">
        <div class="pedido">PEDIDO #${esc(pedido.numero_pedido)}</div>
        <div class="data">${esc(new Date(pedido.criado_em).toLocaleDateString('pt-PT'))}</div>
      </div>
      ${total > 1 ? `<div class="lote">TALAO ${index + 1} DE ${total}</div>` : ''}

      <div class="sep"></div>
      <div class="titulo">CLIENTE</div>
      ${linha('Nome', cliente?.nome ?? '-')}
      ${linha('Tel', cliente?.contacto ?? '-')}
      ${linha('Tipo', tipoCliente)}

      <div class="sep"></div>
      <div class="titulo">VIATURA</div>
      ${linha('Matricula', dados.matricula || '-')}
      ${linha('Viatura', dados.viatura)}
      ${linha('Ano', dados.ano)}
      ${linha('Combustivel', dados.combustivel)}

      <div class="sep"></div>
      <div class="titulo">SERVICO</div>
      ${linha('Material', dados.material || '-')}
      ${linha('Tipo', tipoTapete || '-')}
      ${bloco('Extras', extras)}
      ${linha('Quantidade', dados.quantidade)}
      ${bloco('Notas', dados.maisInfo || dados.mais_info)}

      <div class="sep"></div>
      <div class="titulo">VALORES</div>
      ${linha('Base', dinheiro(pedido.preco_base))}
      ${Number(pedido.soma_extras) > 0 ? linha('Extras', `+${dinheiro(pedido.soma_extras)}`) : ''}
      ${descontoValorTipo > 0 ? linha(`Desc. ${tipoCliente} -${descontoPct}%`, `-${dinheiro(descontoValorTipo)}`) : ''}
      ${descontoManual > 0 ? linha('Desc. manual', `-${dinheiro(descontoManual)}`) : ''}

      <div class="total">
        <span>TOTAL</span>
        <span>${esc(dinheiro(valorFinal))}</span>
      </div>

      ${sinal > 0 ? linha('Sinal pago', `-${dinheiro(sinal)}`) : ''}
      ${sinal > 0 ? linha('EM FALTA', dinheiro(valorEmFalta), true) : ''}

      <div class="sep"></div>
      ${linha('Pagamento', String(pedido.forma_pagamento ?? '').replace(/_/g, ' '), true)}
      ${linha('Estado', estado?.nome ?? '-')}

      <div class="sep"></div>
      <div class="rodape">${esc(tenant?.nome ?? 'Plataforma')} - OBRIGADO</div>
    </section>
  `
}

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenantId')
  const ids = (request.nextUrl.searchParams.get('ids') ?? '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean)
    .slice(0, 100)

  if (!tenantId || ids.length === 0) {
    return NextResponse.json({ erro: 'Pedido(s) nao informado(s)' }, { status: 400 })
  }

  const supabase = criarClienteAdmin()
  const { data, error } = await supabase
    .from('pedidos')
    .select(`
      id, numero_pedido, valor_final, soma_extras, preco_base,
      subtotal, desconto_tipo_pct, desconto_manual, sinal,
      forma_pagamento, criado_em, dados,
      clientes ( nome, contacto, tipos_cliente ( nome, desconto_pct ) ),
      estados_fluxo ( nome, cor ),
      tenants ( nome )
    `)
    .eq('tenant_id', tenantId)
    .in('id', ids)

  if (error) {
    return NextResponse.json({ erro: 'Erro ao carregar pedidos' }, { status: 500 })
  }

  const pedidos = ((data ?? []) as unknown as PedidoLote[])
    .sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))

  if (pedidos.length === 0) {
    return NextResponse.json({ erro: 'Nenhum pedido encontrado' }, { status: 404 })
  }

  const html = `<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Impressao de pedidos</title>
  <style>
    @page { size: 72mm auto; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; }
    body {
      width: 72mm;
      min-height: 100%;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      line-height: 1.22;
      text-transform: uppercase;
    }
    .recibo { width: 72mm; padding: 3mm; break-after: page; page-break-after: always; }
    .recibo:last-child { break-after: auto; page-break-after: auto; }
    .empresa { text-align: center; font-size: 14px; font-weight: 800; }
    .subtitulo, .lote { text-align: center; font-size: 10px; margin-top: 1mm; }
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
  ${pedidos.map((pedido, index) => recibo(pedido, index, pedidos.length)).join('')}
</body>
</html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
