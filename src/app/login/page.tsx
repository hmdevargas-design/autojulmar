import LoginForm from '@/components/auth/LoginForm'

export default function PaginaLogin() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 w-full max-w-sm shadow-sm">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-6">Entrar na plataforma</h1>
        <LoginForm />
      </div>
    </div>
  )
}
