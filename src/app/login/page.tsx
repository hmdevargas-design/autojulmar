import LoginForm from '@/components/auth/LoginForm'

export default function PaginaLogin() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-gray-200 p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Entrar na plataforma</h1>
        <LoginForm />
      </div>
    </div>
  )
}
