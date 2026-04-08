import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#111827',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: '1 solid #e5e7eb',
  },
  empresa: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1d4ed8' },
  subEmpresa: { fontSize: 9, color: '#6b7280', marginTop: 2 },
  numeroPedido: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#111827' },
  labelPedido: { fontSize: 9, color: '#6b7280', textAlign: 'right' },
  secao: { marginBottom: 16 },
  secaoTitulo: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  grelha2: { flexDirection: 'row', gap: 16 },
  campo: { flex: 1 },
  campoLabel: { fontSize: 8, color: '#9ca3af', marginBottom: 2 },
  campoValor: { fontSize: 10, color: '#111827' },
  separador: { borderBottom: '1 solid #f3f4f6', marginVertical: 12 },
  linhaTotais: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  totalLabel: { color: '#6b7280' },
  totalValor: { fontFamily: 'Helvetica-Bold' },
  totalFinal: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, borderTop: '1.5 solid #1d4ed8', marginTop: 6 },
  totalFinalLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold' },
  totalFinalValor: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#1d4ed8' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, alignSelf: 'flex-start' },
  badgeTexto: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  rodape: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', fontSize: 8, color: '#d1d5db' },
})

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
  corEstado: string
  precoBase: number
  somaExtras: number
  subtotal: number
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

export default function DocumentoPedidoPDF(props: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Cabeçalho */}
        <View style={styles.header}>
          <View>
            <Text style={styles.empresa}>{props.nomeTenant}</Text>
            <Text style={styles.subEmpresa}>Guia de Serviço</Text>
          </View>
          <View>
            <Text style={styles.labelPedido}>Pedido</Text>
            <Text style={styles.numeroPedido}>#{props.numeroPedido}</Text>
            <Text style={[styles.labelPedido, { marginTop: 2 }]}>{props.data}</Text>
          </View>
        </View>

        {/* Cliente */}
        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>Cliente</Text>
          <View style={styles.grelha2}>
            <View style={styles.campo}>
              <Text style={styles.campoLabel}>Nome</Text>
              <Text style={styles.campoValor}>{props.nomeCliente}</Text>
            </View>
            <View style={styles.campo}>
              <Text style={styles.campoLabel}>Contacto</Text>
              <Text style={styles.campoValor}>{props.contacto}</Text>
            </View>
            <View style={styles.campo}>
              <Text style={styles.campoLabel}>Tipo</Text>
              <Text style={styles.campoValor}>{props.tipoCliente}</Text>
            </View>
          </View>
        </View>

        <View style={styles.separador} />

        {/* Viatura */}
        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>Viatura</Text>
          <View style={styles.grelha2}>
            <View style={styles.campo}>
              <Text style={styles.campoLabel}>Matrícula</Text>
              <Text style={styles.campoValor}>{props.matricula || '—'}</Text>
            </View>
            <View style={[styles.campo, { flex: 2 }]}>
              <Text style={styles.campoLabel}>Viatura</Text>
              <Text style={styles.campoValor}>{props.viatura || '—'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.separador} />

        {/* Serviço */}
        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>Serviço</Text>
          <View style={styles.grelha2}>
            <View style={styles.campo}>
              <Text style={styles.campoLabel}>Material</Text>
              <Text style={styles.campoValor}>{props.material || '—'}</Text>
            </View>
            <View style={[styles.campo, { flex: 2 }]}>
              <Text style={styles.campoLabel}>Tipo Tapete</Text>
              <Text style={styles.campoValor}>{props.tipoTapete.join(', ') || '—'}</Text>
            </View>
          </View>
          {props.extras.length > 0 && (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.campoLabel}>Extras</Text>
              <Text style={styles.campoValor}>{props.extras.join(', ')}</Text>
            </View>
          )}
        </View>

        <View style={styles.separador} />

        {/* Valores */}
        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>Valores</Text>
          <View style={styles.linhaTotais}>
            <Text style={styles.totalLabel}>Preço base</Text>
            <Text>{props.precoBase.toFixed(2)}€</Text>
          </View>
          {props.somaExtras > 0 && (
            <View style={styles.linhaTotais}>
              <Text style={styles.totalLabel}>Extras</Text>
              <Text>+{props.somaExtras.toFixed(2)}€</Text>
            </View>
          )}
          {props.descontoValorTipo > 0 && (
            <View style={styles.linhaTotais}>
              <Text style={styles.totalLabel}>Desconto {props.tipoCliente} (−{props.descontoPct}%)</Text>
              <Text style={{ color: '#dc2626' }}>−{props.descontoValorTipo.toFixed(2)}€</Text>
            </View>
          )}
          {props.descontoManual > 0 && (
            <View style={styles.linhaTotais}>
              <Text style={styles.totalLabel}>Desconto manual</Text>
              <Text style={{ color: '#dc2626' }}>−{props.descontoManual.toFixed(2)}€</Text>
            </View>
          )}
          <View style={styles.totalFinal}>
            <Text style={styles.totalFinalLabel}>Total</Text>
            <Text style={styles.totalFinalValor}>{props.valorFinal.toFixed(2)}€</Text>
          </View>
          {props.sinal > 0 && (
            <View style={[styles.linhaTotais, { marginTop: 6 }]}>
              <Text style={styles.totalLabel}>Sinal pago</Text>
              <Text style={{ color: '#16a34a' }}>−{props.sinal.toFixed(2)}€</Text>
            </View>
          )}
          {props.sinal > 0 && (
            <View style={styles.linhaTotais}>
              <Text style={[styles.totalLabel, { fontFamily: 'Helvetica-Bold' }]}>Em falta</Text>
              <Text style={{ fontFamily: 'Helvetica-Bold', color: '#1d4ed8' }}>{props.valorEmFalta.toFixed(2)}€</Text>
            </View>
          )}
        </View>

        <View style={styles.separador} />

        {/* Estado e pagamento */}
        <View style={[styles.grelha2, { marginTop: 4 }]}>
          <View style={styles.campo}>
            <Text style={styles.campoLabel}>Estado</Text>
            <View style={[styles.badge, { backgroundColor: props.corEstado + '20' }]}>
              <Text style={[styles.badgeTexto, { color: props.corEstado }]}>{props.estado}</Text>
            </View>
          </View>
          <View style={styles.campo}>
            <Text style={styles.campoLabel}>Forma de pagamento</Text>
            <Text style={styles.campoValor}>{props.formaPagamento.replace(/_/g, ' ')}</Text>
          </View>
        </View>

        {/* Rodapé */}
        <Text style={styles.rodape}>
          {props.nomeTenant} · Documento gerado automaticamente
        </Text>
      </Page>
    </Document>
  )
}
