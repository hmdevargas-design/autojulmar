// Fachada interna para preparar a extracao do agente para um servico dedicado.
// Mantem a implementacao actual em agente.ts enquanto o SaaS ainda aloja o fluxo.

export {
  AGENTE_JULMAR_NOME,
  pausarBot as pausarAgenteJulmar,
  processarComAgente as processarComAgenteJulmar,
} from './agente'
