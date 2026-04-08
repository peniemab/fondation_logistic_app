import './globals.css'
import { ReactNode } from 'react'

export const metadata = {
  title: 'Fondation El-Shaddaï/MBA - Gestion',
  description: 'Logiciel de saisie et suivi des souscripteurs',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="text-black antialiased print:bg-white">
        <div className="min-h-screen flex flex-col">
          {children}
        </div>
      </body>
    </html>
  )
}