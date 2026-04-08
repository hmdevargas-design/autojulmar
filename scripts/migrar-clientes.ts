#!/usr/bin/env npx tsx
/**
 * Script de migração de clientes recorrentes
 * Uso: npx tsx scripts/migrar-clientes.ts <ficheiro.csv>
 *
 * Lê o CSV exportado do Google Sheets com cabeçalhos:
 *   ..., CLIENTE (col E), CONTACTO (col F), ..., TIPO CLIENTE (col J), ...
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Carrega .env.local manualmente (tsx não lê automaticamente)
const envPath = resolve(process.cwd(), '.env.local')
try {
  const envContent = readFileSync(envPath, 'utf-8')
  for (const linha of envContent.split('\n')) {
    const match = linha.match(/^([^#=]+)=(.*)$/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
} catch {
  // .env.local não encontrado — usa variáveis de ambiente existentes
}

const TENANT_ID = '00000000-0000-0000-0000-000000000001'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Normaliza ORÇAMENTO → ORCAMENTO, etc.
function normalizarTipo(raw: string): string {
  return raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim()
}

function normalizarContacto(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('351') && digits.length === 12) return digits.slice(3)
  return digits.slice(-9)
}

// Divide uma linha CSV respeitando campos entre aspas
function parseLinha(linha: string): string[] {
  const resultado: string[] = []
  let campo = ''
  let dentroAspas = false
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i]
    if (c === '"') {
      dentroAspas = !dentroAspas
    } else if (c === ',' && !dentroAspas) {
      resultado.push(campo.trim())
      campo = ''
    } else {
      campo += c
    }
  }
  resultado.push(campo.trim())
  return resultado
}

async function migrar(csvPath: string) {
  const conteudo = readFileSync(resolve(csvPath), 'utf-8')
  const todasLinhas = conteudo.trim().split('\n')

  // Descobre índices das colunas pelo cabeçalho
  const cabecalho = parseLinha(todasLinhas[0]).map(c => c.toUpperCase().trim())
  const iCliente  = cabecalho.indexOf('CLIENTE')
  const iContacto = cabecalho.indexOf('CONTACTO')
  const iTipo     = cabecalho.indexOf('TIPO CLIENTE')

  if (iCliente === -1 || iContacto === -1) {
    console.error('❌ Colunas CLIENTE e/ou CONTACTO não encontradas no cabeçalho.')
    console.error('   Cabeçalho detectado:', cabecalho.join(', '))
    process.exit(1)
  }

  console.log(`📋 Colunas: CLIENTE[${iCliente}] CONTACTO[${iContacto}] TIPO CLIENTE[${iTipo}]`)

  // Carrega tipos de cliente disponíveis no Supabase
  const { data: tipos } = await supabase
    .from('tipos_cliente')
    .select('id, nome')
    .eq('tenant_id', TENANT_ID)

  const mapasTipos = Object.fromEntries(
    (tipos ?? []).map(t => [normalizarTipo(t.nome), t.id])
  )
  console.log(`📦 Tipos carregados: ${Object.keys(mapasTipos).join(', ')}\n`)

  let inseridos = 0
  let ignorados = 0
  let erros = 0

  for (const linha of todasLinhas.slice(1)) {
    if (!linha.trim()) continue
    const partes = parseLinha(linha)

    const nome       = partes[iCliente]  ?? ''
    const contactoRaw = partes[iContacto] ?? ''
    const tipoRaw    = iTipo !== -1 ? (partes[iTipo] ?? '') : ''

    // Ignora linhas de cabeçalho repetidas ou placeholders
    if (!nome || nome.toUpperCase() === 'CLIENTE') { ignorados++; continue }
    if (!contactoRaw || contactoRaw.toUpperCase() === 'CONTACTO') { ignorados++; continue }

    const contacto = normalizarContacto(contactoRaw)
    if (contacto.length < 9) {
      console.warn(`⚠  Contacto inválido: "${contactoRaw}" (${nome})`)
      ignorados++
      continue
    }

    const tipoNormalizado = normalizarTipo(tipoRaw)
    const tipoId = mapasTipos[tipoNormalizado] ?? mapasTipos['NORMAL'] ?? null

    const { error } = await supabase
      .from('clientes')
      .upsert({
        tenant_id:       TENANT_ID,
        nome,
        contacto,
        tipo_cliente_id: tipoId,
      }, { onConflict: 'tenant_id,contacto' })

    if (error) {
      console.error(`✗ ${nome} | ${contacto} → ${error.message}`)
      erros++
    } else {
      console.log(`✓ ${nome} | ${contacto} | ${tipoRaw || 'NORMAL'}`)
      inseridos++
    }
  }

  console.log(`\n📊 Migração concluída:`)
  console.log(`   ✓ Inseridos/actualizados: ${inseridos}`)
  console.log(`   ⚠ Ignorados: ${ignorados}`)
  console.log(`   ✗ Erros: ${erros}`)
}

const csvArg = process.argv[2]
if (!csvArg) {
  console.error('Uso: npx tsx scripts/migrar-clientes.ts <ficheiro.csv>')
  process.exit(1)
}

migrar(csvArg).catch(console.error)
