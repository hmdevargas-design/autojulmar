import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { formatarNumeroOrcamento } from '@/lib/orcamentos/config'

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#111827' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: '1 solid #e5e7eb' },
  empresa: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#C8A96A' },
  subEmpresa: { fontSize: 9, color: '#6b7280', marginTop: 2 },
  numero: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#111827' },
  labelTopo: { fontSize: 9, color: '#6b7280', textAlign: 'right' },
  secao: { marginBottom: 16 },
  secaoTitulo: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  grelha2: { flexDirection: 'row', gap: 16 },
  campo: { flex: 1 },
  campoLabel: { fontSize: 8, color: '#9ca3af', marginBottom: 2 },
  campoValor: { fontSize: 10, color: '#111827' },
  separador: { borderBottom: '1 solid #f3f4f6', marginVertical: 12 },
  totalFinal: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, borderTop: '1.5 solid #C8A96A', marginTop: 6 },
  totalFinalLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold' },
  totalFinalValor: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#C8A96A' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, alignSelf: 'flex-start' },
  badgeTexto: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  rodape: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', fontSize: 8, color: '#d1d5db' },
})

interface Props {
  numeroOrcamento: number
  nomeTenant: string
  nomeCliente: string
  contacto: string
  matricula: string
  viatura: string
  ano: string
  categoria: string
  produto: string
  descricao: string
  estado: string
  corEstado: string
  valorEstimado: number
  data: string
  validade: string
}

export default function DocumentoOrcamentoPDF(props: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.empresa}>{props.nomeTenant}</Text>
            <Text style={styles.subEmpresa}>Orçamento</Text>
          </View>
          <View>
            <Text style={styles.labelTopo}>Orçamento</Text>
            <Text style={styles.numero}>{formatarNumeroOrcamento(props.numeroOrcamento)}</Text>
            <Text style={[styles.labelTopo, { marginTop: 2 }]}>{props.data}</Text>
          </View>
        </View>

        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>Cliente</Text>
          <View style={styles.grelha2}>
            <View style={styles.campo}><Text style={styles.campoLabel}>Nome</Text><Text style={styles.campoValor}>{props.nomeCliente}</Text></View>
            <View style={styles.campo}><Text style={styles.campoLabel}>Contacto</Text><Text style={styles.campoValor}>{props.contacto}</Text></View>
          </View>
        </View>

        <View style={styles.separador} />

        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>Viatura</Text>
          <View style={styles.grelha2}>
            <View style={styles.campo}><Text style={styles.campoLabel}>Matrícula</Text><Text style={styles.campoValor}>{props.matricula || '—'}</Text></View>
            <View style={[styles.campo, { flex: 2 }]}><Text style={styles.campoLabel}>Viatura</Text><Text style={styles.campoValor}>{props.viatura || '—'}</Text></View>
            <View style={styles.campo}><Text style={styles.campoLabel}>Ano</Text><Text style={styles.campoValor}>{props.ano || '—'}</Text></View>
          </View>
        </View>

        <View style={styles.separador} />

        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>Serviço</Text>
          <View style={styles.grelha2}>
            <View style={styles.campo}><Text style={styles.campoLabel}>Categoria</Text><Text style={styles.campoValor}>{props.categoria}</Text></View>
            <View style={styles.campo}><Text style={styles.campoLabel}>Produto</Text><Text style={styles.campoValor}>{props.produto}</Text></View>
          </View>
          {props.descricao ? (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.campoLabel}>Descrição</Text>
              <Text style={styles.campoValor}>{props.descricao}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.separador} />

        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>Condições</Text>
          <View style={styles.grelha2}>
            <View style={styles.campo}><Text style={styles.campoLabel}>Estado</Text><View style={[styles.badge, { backgroundColor: props.corEstado + '20' }]}><Text style={[styles.badgeTexto, { color: props.corEstado }]}>{props.estado}</Text></View></View>
            <View style={styles.campo}><Text style={styles.campoLabel}>Validade</Text><Text style={styles.campoValor}>{props.validade}</Text></View>
          </View>
          <View style={styles.totalFinal}>
            <Text style={styles.totalFinalLabel}>Valor estimado</Text>
            <Text style={styles.totalFinalValor}>{props.valorEstimado.toFixed(2)}€</Text>
          </View>
        </View>

        <Text style={styles.rodape}>{props.nomeTenant} · Orçamento válido até {props.validade}</Text>
      </Page>
    </Document>
  )
}
