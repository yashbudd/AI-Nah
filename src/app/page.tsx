// src/app/page.tsx
export default function Home() {
    return (
      <main
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#0d1117',
          color: 'white',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>TrailMix</h1>
        <p style={{ fontSize: '1rem', opacity: 0.8 }}>
          AI-powered Trail Mapping App
        </p>
  
        <div style={{ marginTop: '2rem' }}>
          <a
            href="/detect"
            style={{
              background: '#2563eb',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              color: 'white',
              textDecoration: 'none',
              fontWeight: '500',
            }}
          >
            Launch Hazard Detection
          </a>
        </div>
      </main>
    );
  }  