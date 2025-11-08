'use client'

export default function ChatPage() {
  return (
    <div style={{ padding: '20px' }}>
      <h2>AI Trail Assistant Chat</h2>
      <div style={{ 
        background: '#f5f5f5', 
        borderRadius: '8px', 
        padding: '16px', 
        margin: '16px 0',
        minHeight: '300px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center'
      }}>
        <div>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤖</div>
          <p>AI Chat interface coming soon!</p>
          <p style={{ fontSize: '14px', color: '#666', marginTop: '8px' }}>
            This will integrate with Gemini API for trail advice and hazard information.
          </p>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '8px' }}>
        <input 
          type="text" 
          placeholder="Ask about trail conditions..."
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid #ddd',
            fontSize: '16px'
          }}
          disabled
        />
        <button className="btn-primary" disabled>
          Send
        </button>
      </div>
      
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <button onClick={() => window.location.href = '/'} className="btn-secondary">
          ← Back to Home
        </button>
      </div>
    </div>
  );
}