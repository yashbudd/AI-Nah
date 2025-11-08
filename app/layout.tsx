import './globals.css'
import BottomNav from '@/components/BottomNav'

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
            </div>
            {children}
          </div>
          <BottomNav />
        </div>
      </body>
    </html>
  )
}