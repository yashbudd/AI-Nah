import { GoogleGenAI } from '@google/genai';

// Initialize Gemini AI
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Function to clean up markdown formatting for plain text display
function cleanMarkdownFormatting(text: string): string {
  return text
    // Remove bold formatting **text** -> text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    // Remove italic formatting *text* -> text
    .replace(/\*(.*?)\*/g, '$1')
    // Remove inline code `text` -> text
    .replace(/`(.*?)`/g, '$1')
    // Remove headers ### -> 
    .replace(/^#+\s*/gm, '')
    // Convert bullet points to proper format with newlines
    .replace(/^[-*]\s+/gm, '\n• ')
    // Ensure bullet points start on new lines
    .replace(/([.!?])\s*\n•/g, '$1\n\n•')
    // Clean up extra whitespace but preserve intentional line breaks
    .replace(/\n{3,}/g, '\n\n')
    // Remove leading newlines but keep structure
    .replace(/^\n+/, '')
    .trim();
}

// Trail safety system prompt to guide Gemini's responses
const TRAIL_SAFETY_PROMPT = `You are TrailMix AI, a helpful trail safety assistant. You provide advice about:

- Trail conditions and safety tips
- Weather considerations for hiking
- Equipment recommendations  
- Wildlife safety
- Emergency preparedness
- Hazard identification and avoidance
- General outdoor recreation guidance

Keep responses concise, practical, and focused on safety. If users ask about specific trails, provide general safety advice since you don't have real-time trail data.

When discussing hazards, mention these common trail hazards:
- Debris (fallen trees, rocks, branches)
- Water hazards (flooding, creek crossings, ice)
- Blocked trails (landslides, construction, fallen trees)

Always prioritize safety and encourage users to check current conditions before hiking.`;

export async function sendMessageToGemini(
  message: string, 
  conversationHistory: ChatMessage[] = []
): Promise<string> {
  try {
    // Check if API key is configured
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      return 'To enable AI chat, please add your Gemini API key to .env.local. Get your free API key from https://ai.google.dev/ and update GEMINI_API_KEY in your environment variables.';
    }

    // Build conversation context
    let conversationContext = TRAIL_SAFETY_PROMPT + '\n\n';
    
    // Add recent conversation history (last 5 messages to stay within token limits)
    const recentHistory = conversationHistory.slice(-5);
    if (recentHistory.length > 0) {
      conversationContext += 'Recent conversation:\n';
      recentHistory.forEach(msg => {
        conversationContext += `${msg.role}: ${msg.content}\n`;
      });
      conversationContext += '\n';
    }

    conversationContext += `User: ${message}\nAssistant:`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: conversationContext,
    });

    const rawResponse = response.text || 'I apologize, but I was unable to generate a response. Please try asking your question again.';
    return cleanMarkdownFormatting(rawResponse);
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    
    // Check for API key error
    if (error && typeof error === 'object' && 'status' in error && error.status === 400) {
      return 'Please configure your Gemini API key in .env.local to enable AI chat. Get your free API key from https://ai.google.dev/';
    }
    
    // Fallback responses for common questions
    if (message.toLowerCase().includes('weather')) {
      return 'I recommend checking current weather conditions before heading out. Always be prepared for sudden changes and pack appropriate gear for the conditions.';
    }
    
    if (message.toLowerCase().includes('hazard') || message.toLowerCase().includes('danger')) {
      return 'Common trail hazards include fallen trees, loose rocks, flooding, and wildlife. Stay alert, stick to marked trails, and report any hazards you encounter through the app.';
    }
    
    if (message.toLowerCase().includes('equipment') || message.toLowerCase().includes('gear')) {
      return 'Essential trail gear includes proper footwear, water, navigation tools, emergency whistle, first aid kit, and weather-appropriate clothing. Always tell someone your hiking plans.';
    }

    return 'I\'m having trouble connecting to provide a detailed response right now. For immediate trail safety information, remember to: check weather conditions, bring plenty of water, stay on marked trails, and let someone know your hiking plans.';
  }
}

export async function getTrailSafetyTips(): Promise<string[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: 'Provide 5 essential trail safety tips as a bullet-point list. Keep each tip to one sentence.',
    });
    
    const responseText = cleanMarkdownFormatting(response.text || '');
    
    // Parse the response into individual tips
    const tips = responseText
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => line.replace(/^[-*•]\s*/, '').trim())
      .slice(0, 5);
    
    return tips;
  } catch (error) {
    console.error('Error getting trail safety tips:', error);
    return [
      'Always check weather conditions before heading out',
      'Bring plenty of water and emergency supplies',
      'Stay on marked trails and avoid shortcuts',
      'Let someone know your hiking plans and expected return',
      'Be aware of wildlife and make noise in bear country'
    ];
  }
}