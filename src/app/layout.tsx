import './globals.css'
import BottomNav from '@/components/BottomNav'
import Header from '@/components/Header'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <div className="mobile-app-container">
          <div className="mobile-preview-label">
            TrailMix Mobile Preview
          </div>
          <div className="mobile-content">
            <Header />
            {children}
          </div>
          <BottomNav />
        </div>
      </body>
    </html>
  )
}