import './globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <div className="mobile-app-container">
          <div className="mobile-content">
            <div className="trailmix-header">
              <h1>TrailMix</h1>
              <p>AI-powered trail safety</p>
            </div>
            {children}
          </div>
        </div>
      </body>
    </html>
  )
}