// Rota de setup — cria utilizador admin para o tenant demo
// Usar apenas uma vez: GET /api/setup
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  // Só disponível em desenvolvimento
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ erro: 'Não disponível em produção' }, { status: 403 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Verifica se já existe
  const { data: existente } = await supabase.auth.admin.listUsers()
  const jaExiste = existente?.users?.some(u => u.email === 'demo@tapetesauto.pt')

  if (jaExiste) {
    return NextResponse.json({ mensagem: 'Utilizador já existe — usa demo@tapetesauto.pt / demo1234' })
  }

  // Cria utilizador
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'demo@tapetesauto.pt',
    password: 'demo1234',
    email_confirm: true,
    user_metadata: {
      tenant_id: '00000000-0000-0000-0000-000000000001',
      nome: 'Admin Demo',
    },
  })

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 })
  }

  // Cria o profile manualmente (caso o trigger não tenha corrido)
  if (data.user) {
    await supabase.from('profiles').upsert({
      id: data.user.id,
      tenant_id: '00000000-0000-0000-0000-000000000001',
      nome: 'Admin Demo',
      role: 'admin',
    })
  }

  return NextResponse.json({
    mensagem: 'Utilizador criado com sucesso',
    email: 'demo@tapetesauto.pt',
    password: 'demo1234',
  })
}
