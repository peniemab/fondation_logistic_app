import './globals.css'
import { ReactNode } from 'react'

export const metadata = {
  title: 'Fondation El-Shaddaï/MBA - Gestion',
  description: 'Logiciel de saisie et suivi des souscripteurs',
}

// On définit le type de children ici : ReactNode
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-slate-50 text-slate-900 antialiased print:bg-white">
        <div className="min-h-screen flex flex-col">
          {children}
        </div>
      </body>
    </html>
  )
}