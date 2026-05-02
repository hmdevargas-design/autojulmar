import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Gestão de Serviços',
  description: 'Plataforma de gestão de pedidos e serviços',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

// Tema escuro por defeito (Design System Autojulmar — fundo sempre escuro)
// Só remove o dark se o utilizador escolheu explicitamente 'claro'
const scriptTema = `
(function(){try{
  var t=localStorage.getItem('tema');
  if(t!=='claro'){
    document.documentElement.classList.add('dark');
  }
}catch(e){document.documentElement.classList.add('dark');}})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body className={`${inter.variable} font-sans`}>{children}</body>
    </html>
  )
}
