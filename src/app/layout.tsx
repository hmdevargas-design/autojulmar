import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Gestão de Serviços',
  description: 'Plataforma de gestão de pedidos e serviços',
}

// Script inline executado antes da hidratação para evitar flash de tema errado
const scriptTema = `
(function(){try{
  var t=localStorage.getItem('tema');
  if(t==='escuro'||(t===null&&window.matchMedia('(prefers-color-scheme:dark)').matches)){
    document.documentElement.classList.add('dark');
  }
}catch(e){}})();
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
