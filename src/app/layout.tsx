import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'Ταμείο Λογιστικού Γραφείου',
  description: 'Διαχείριση ταμείου και πελατών',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="el">
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: { fontSize: '13px', borderRadius: '8px' },
          }}
        />
      </body>
    </html>
  )
}
