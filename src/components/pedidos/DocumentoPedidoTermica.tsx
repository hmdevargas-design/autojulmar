import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

// 80mm = 226.77pt | margens de 8pt cada lado → área útil ≈ 210pt
const L = 226.77
const M = 8  // margem

const s = StyleSheet.create({
  page: {
    width: L,
    paddingHorizontal: M,
    paddingVertical: 10,
    fontFamily: 'Helvetica',
    fontSize: 12,
    color: '#000',
  },
  centro: { textAlign: 'center' },
  negrito: { fontFamily: 'Helvetica-Bold' },
  empresa: { fontFamily: 'Helvetica-Bold', fontSize: 12, textAlign: 'center' },
  subTitulo: { fontSize: 12, textAlign: 'center', marginTop: 1 },
  separador: { borderBottom: '0.5 solid #000', marginVertical: 4 },
  tracejado: { textAlign: 'center', fontSize: 12, marginVertical: 3 },
  secaoTitulo: { fontFamily: 'Helvetica-Bold', fontSize: 12, marginBottom: 3, marginTop: 6 },
  linha: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  label: { color: '#000', fontSize: 12 },
  valor: { fontSize: 12 },
  totalLinha: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  totalFinalLinha: {
    flexDirection: 'row', justifyContent: 'space-between',
    borderTop: '0.5 solid #000', borderBottom: '0.5 solid #000',
    paddingVertical: 4, marginVertical: 4,
  },
  totalFinalLabel: { fontFamily: 'Helvetica-Bold', fontSize: 18 },
  totalFinalValor: { fontFamily: 'Helvetica-Bold', fontSize: 18 },
  emFaltaLabel: { fontFamily: 'Helvetica-Bold', fontSize: 12 },
  emFaltaValor: { fontFamily: 'Helvetica-Bold', fontSize: 12 },
  numeroPedido: { fontFamily: 'Helvetica-Bold', fontSize: 18 },
  rodape: { textAlign: 'center', fontSize: 12, marginTop: 10, color: '#000' },
})

const SEP = '- - - - - - - - - - - - - - - - - - -'

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
    <View style={s.totalLinha}>
      <Text style={negrito ? [s.label, s.negrito] : s.label}>{l}</Text>
      <Text style={negrito ? [s.valor, s.negrito] : s.valor}>{v}</Text>
    </View>
  )
}

export default function DocumentoPedidoTermica(props: Props) {
  const temDesconto = props.descontoValorTipo > 0
  const temDescontoManual = props.descontoManual > 0
  const temSinal = props.sinal > 0
  const temExtras = props.extras.length > 0

  return (
    <Document>
      <Page size={[L, 600]} style={s.page}>

        {/* Cabeçalho */}
        <Text style={s.empresa}>{props.nomeTenant}</Text>
        <Text style={s.subTitulo}>Guia de Serviço</Text>

        <View style={s.separador} />

        <View style={[s.linha, { marginTop: 2 }]}>
          <Text style={s.numeroPedido}>PEDIDO #{props.numeroPedido}</Text>
          <Text style={s.valor}>{props.data}</Text>
        </View>

        {/* Cliente */}
        <Text style={s.tracejado}>{SEP}</Text>
        <Text style={s.secaoTitulo}>CLIENTE</Text>
        <Linha l="Nome" v={props.nomeCliente} />
        <Linha l="Tel" v={props.contacto} />
        <Linha l="Tipo" v={props.tipoCliente} />

        {/* Viatura */}
        <Text style={s.tracejado}>{SEP}</Text>
        <Text style={s.secaoTitulo}>VIATURA</Text>
        <Linha l="Matrícula" v={props.matricula || '—'} />
        {props.viatura      ? <Linha l="Viatura"     v={props.viatura}      /> : null}
        {props.ano          ? <Linha l="Ano"         v={props.ano}          /> : null}
        {props.combustivel  ? <Linha l="Combustível" v={props.combustivel}  /> : null}

        {/* Serviço */}
        <Text style={s.tracejado}>{SEP}</Text>
        <Text style={s.secaoTitulo}>SERVIÇO</Text>
        <Linha l="Material" v={props.material || '—'} />
        <Linha l="Tipo" v={props.tipoTapete.join(' + ') || '—'} />
        {temExtras && <Linha l="Extras" v={props.extras.join(', ')} />}

        {/* Valores */}
        <Text style={s.tracejado}>{SEP}</Text>
        <Text style={s.secaoTitulo}>VALORES</Text>
        <Linha l="Base" v={`${props.precoBase.toFixed(2)} EUR`} />
        {props.somaExtras > 0 && (
          <Linha l="Extras" v={`+${props.somaExtras.toFixed(2)} EUR`} />
        )}
        {temDesconto && (
          <Linha l={`Desc. ${props.tipoCliente} -${props.descontoPct}%`} v={`-${props.descontoValorTipo.toFixed(2)} EUR`} />
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
            <View style={s.totalLinha}>
              <Text style={s.emFaltaLabel}>EM FALTA</Text>
              <Text style={s.emFaltaValor}>{props.valorEmFalta.toFixed(2)} EUR</Text>
            </View>
          </>
        )}

        {/* Pagamento e estado */}
        <Text style={s.tracejado}>{SEP}</Text>
        <Linha l="Pagamento" v={props.formaPagamento.replace(/_/g, ' ')} negrito />
        <Linha l="Estado" v={props.estado} />

        <Text style={s.tracejado}>{SEP}</Text>
        <Text style={s.rodape}>{props.nomeTenant} · obrigado</Text>

      </Page>
    </Document>
  )
}
