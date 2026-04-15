import './globals.css'
export const metadata = { title: 'FOMO Dashboard', description: 'Panel financiero FOMO' }
export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0c0c0e" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@400;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body style={{margin:0,background:'#0c0c0e'}}>{children}</body>
    </html>
  )
}
