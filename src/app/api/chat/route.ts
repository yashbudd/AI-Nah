import { NextRequest, NextResponse } from 'next/server';
import { sendMessageToGemini, ChatMessage } from '@/lib/azureClient';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, conversationHistory } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Call Gemini AI
    const response = await sendMessageToGemini(message, conversationHistory || []);

    return NextResponse.json({
      message: response,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'TrailMix Chat API is running',
    endpoints: {
      'POST /api/chat': 'Send a message to the AI assistant'
    }
  });
}