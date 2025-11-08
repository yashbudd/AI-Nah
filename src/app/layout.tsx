// src/app/layout.tsx
import './globals.css';

export const metadata = {
  title: 'TrailMix',
  description: 'AI-powered Trail Mapping',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}