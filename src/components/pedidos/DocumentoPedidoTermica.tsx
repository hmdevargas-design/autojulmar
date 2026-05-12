import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

// SRP-350Plus III: área imprimível exacta = 72mm = 204pt
// Margens 8pt → conteúdo útil = 188pt ≈ 66mm
const L = 204
const M = 8

const s = StyleSheet.create({
  page: {
    width: L,
    paddingHorizontal: M,
    paddingVertical: 8,
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    color: '#000',
    textTransform: 'uppercase',
  },
  empresa:     { fontFamily: 'Helvetica-Bold', fontSize: 13, textAlign: 'center' },
  subTitulo:   { fontSize: 10, textAlign: 'center', marginTop: 1 },
  separador:   { borderBottom: '0.5 solid #000', marginVertical: 3 },
  tracejado:   { textAlign: 'center', fontSize: 9, marginVertical: 2 },
  secaoTitulo: { fontFamily: 'Helvetica-Bold', fontSize: 11, marginBottom: 2, marginTop: 5 },

  // Linha label + valor em duas colunas
  linhaRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  linhaLabel: { fontSize: 11, flexShrink: 0, maxWidth: 90 },
  linhaValor: { fontSize: 11, textAlign: 'right', flex: 1 },
  linhaNegritoLabel: { fontFamily: 'Helvetica-Bold', fontSize: 11, flexShrink: 0, maxWidth: 90 },
  linhaNegritoValor: { fontFamily: 'Helvetica-Bold', fontSize: 11, textAlign: 'right', flex: 1 },

  // Extras em bloco separado (texto pode ser longo)
  extrasBloco: { marginBottom: 2 },
  extrasLabel: { fontFamily: 'Helvetica-Bold', fontSize: 11 },
  extrasValor: { fontSize: 11 },

  // Pedido # + data
  pedidoRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 3, marginBottom: 4 },
  numeroPedido: { fontFamily: 'Helvetica-Bold', fontSize: 16 },
  dataTexto:    { fontSize: 9 },

  // Total
  totalFinalLinha: {
    flexDirection: 'row', justifyContent: 'space-between',
    borderTop: '1 solid #000', borderBottom: '1 solid #000',
    paddingVertical: 3, marginVertical: 3,
  },
  totalFinalLabel: { fontFamily: 'Helvetica-Bold', fontSize: 18 },
  totalFinalValor: { fontFamily: 'Helvetica-Bold', fontSize: 18 },

  emFaltaLabel: { fontFamily: 'Helvetica-Bold', fontSize: 12 },
  emFaltaValor: { fontFamily: 'Helvetica-Bold', fontSize: 12 },

  rodape: { textAlign: 'center', fontSize: 11, marginTop: 8 },
})

const SEP = '- - - - - - - - - - - - - - - -'

interface Props {
  numeroPedido: number
  nomeCliente: string
  contacto: string
  tipoCliente: string
  matricula: string
  viatura: string
  ano: string
  combustivel: string
  material: string
  tipoTapete: string[]
  extras: string[]
  quantidade?: number
  maisInfo?: string
  estado: string
  precoBase: number
  somaExtras: number
  descontoPct: number
  descontoValorTipo: number
  descontoManual: number
  valorFinal: number
  sinal: number
  valorEmFalta: number
  formaPagamento: string
  data: string
  nomeTenant: string
}

function Linha({ l, v, negrito }: { l: string; v: string; negrito?: boolean }) {
  return (
    <View style={s.linhaRow}>
      <Text style={negrito ? s.linhaNegritoLabel : s.linhaLabel}>{l}</Text>
      <Text style={negrito ? s.linhaNegritoValor : s.linhaValor}>{v}</Text>
    </View>
  )
}

export default function DocumentoPedidoTermica(props: Props) {
  const temDesconto      = props.descontoValorTipo > 0
  const temDescontoManual = props.descontoManual > 0
  const temSinal         = props.sinal > 0
  const temExtras        = props.extras.length > 0

  return (
    <Document>
      <Page size={[L, 1000]} style={s.page}>

        {/* Cabeçalho */}
        <Text style={s.empresa}>{props.nomeTenant}</Text>
        <Text style={s.subTitulo}>Guia de Serviço</Text>
        <View style={s.separador} />

        <View style={s.pedidoRow}>
          <Text style={s.numeroPedido}>PEDIDO #{props.numeroPedido}</Text>
          <Text style={s.dataTexto}>{props.data}</Text>
        </View>

        {/* Cliente */}
        <Text style={s.tracejado}>{SEP}</Text>
        <Text style={s.secaoTitulo}>CLIENTE</Text>
        <Linha l="Nome"    v={props.nomeCliente} />
        <Linha l="Tel"     v={props.contacto} />
        {props.tipoCliente ? <Linha l="Tipo" v={props.tipoCliente} /> : null}

        {/* Viatura */}
        <Text style={s.tracejado}>{SEP}</Text>
        <Text style={s.secaoTitulo}>VIATURA</Text>
        <Linha l="Matrícula" v={props.matricula || '—'} />
        {props.viatura     ? <Linha l="Viatura"     v={props.viatura}     /> : null}
        {props.ano         ? <Linha l="Ano"         v={props.ano}         /> : null}
        {props.combustivel ? <Linha l="Combustível" v={props.combustivel} /> : null}

        {/* Serviço */}
        <Text style={s.tracejado}>{SEP}</Text>
        <Text style={s.secaoTitulo}>SERVIÇO</Text>
        <Linha l="Material" v={props.material || '—'} />
        <Linha l="Tipo"     v={props.tipoTapete.join(' + ') || '—'} />
        {temExtras && (
          <View style={s.extrasBloco}>
            <Text style={s.extrasLabel}>Extras</Text>
            <Text style={s.extrasValor}>{props.extras.join(' · ')}</Text>
          </View>
        )}
        {props.quantidade && props.quantidade > 1 && (
          <Linha l="Quantidade" v={String(props.quantidade)} negrito />
        )}
        {props.maisInfo ? (
          <View style={s.extrasBloco}>
            <Text style={s.extrasLabel}>Notas</Text>
            <Text style={s.extrasValor}>{props.maisInfo}</Text>
          </View>
        ) : null}

        {/* Valores */}
        <Text style={s.tracejado}>{SEP}</Text>
        <Text style={s.secaoTitulo}>VALORES</Text>
        <Linha l="Base" v={`${props.precoBase.toFixed(2)} EUR`} />
        {props.somaExtras > 0 && (
          <Linha l="Extras" v={`+${props.somaExtras.toFixed(2)} EUR`} />
        )}
        {temDesconto && (
          <Linha
            l={`Desc. ${props.tipoCliente} -${props.descontoPct}%`}
            v={`-${props.descontoValorTipo.toFixed(2)} EUR`}
          />
        )}
        {temDescontoManual && (
          <Linha l="Desc. manual" v={`-${props.descontoManual.toFixed(2)} EUR`} />
        )}

        {/* Total */}
        <View style={s.totalFinalLinha}>
          <Text style={s.totalFinalLabel}>TOTAL</Text>
          <Text style={s.totalFinalValor}>{props.valorFinal.toFixed(2)} EUR</Text>
        </View>

        {temSinal && (
          <>
            <Linha l="Sinal pago" v={`-${props.sinal.toFixed(2)} EUR`} />
            <View style={s.linhaRow}>
              <Text style={s.emFaltaLabel}>EM FALTA</Text>
              <Text style={s.emFaltaValor}>{props.valorEmFalta.toFixed(2)} EUR</Text>
            </View>
          </>
        )}

        {/* Pagamento */}
        <Text style={s.tracejado}>{SEP}</Text>
        <Linha l="Pagamento" v={props.formaPagamento.replace(/_/g, ' ')} negrito />
        <Linha l="Estado"    v={props.estado} />

        <Text style={s.tracejado}>{SEP}</Text>
        <Text style={s.rodape}>{props.nomeTenant} · obrigado</Text>

      </Page>
    </Document>
  )
}
