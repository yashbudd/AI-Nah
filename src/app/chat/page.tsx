'use client'

import ChatInterface from '@/components/ChatInterface';

export default function ChatPage() {
  return (
    <div className="chat-page">
      <div className="chat-header">
        <h2>🤖 TrailMix AI Assistant</h2>
        <p>Get trail safety advice and hiking tips</p>
      </div>
      <ChatInterface />
    </div>
  );
}