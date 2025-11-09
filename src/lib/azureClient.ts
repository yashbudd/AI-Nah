import OpenAI from "openai";

const DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini";

// Initialize Azure OpenAI client
const client = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY!,
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments`,
  defaultQuery: { "api-version": process.env.AZURE_OPENAI_API_VERSION || "2024-10-21" },
  defaultHeaders: { "api-key": process.env.AZURE_OPENAI_API_KEY! },
});



export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

// Function to clean up markdown formatting for plain text display
function cleanMarkdownFormatting(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1") // **bold**
    .replace(/\*(.*?)\*/g, "$1") // *italic*
    .replace(/`(.*?)`/g, "$1") // inline code
    .replace(/^#+\s*/gm, "") // headers
    .replace(/^[-*]\s+/gm, "\n• ") // bullets
    .replace(/([.!?])\s*\n•/g, "$1\n\n•") // newline before bullets
    .replace(/\n{3,}/g, "\n\n") // reduce whitespace
    .replace(/^\n+/, "") // leading newlines
    .trim();
}

// Trail safety system prompt to guide AI responses
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

// Core chat function (replaces Gemini)
export async function sendMessageToGemini(
  message: string,
  conversationHistory: ChatMessage[] = []
): Promise<string> {
  try {
    // Check for API key
    if (!process.env.AZURE_OPENAI_API_KEY) {
      return "To enable AI chat, please add your Azure OpenAI API key to .env.local.";
    }

    // Build chat context
    const history = conversationHistory.slice(-5).map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const completion = await client.chat.completions.create({
      model: DEPLOYMENT,
      temperature: 0.3,
      messages: [
        { role: "system", content: TRAIL_SAFETY_PROMPT },
        ...history,
        { role: "user", content: message },
      ],
    });

    const text =
      completion.choices?.[0]?.message?.content ||
      "I apologize, but I was unable to generate a response. Please try asking your question again.";

    return cleanMarkdownFormatting(text);
  } catch (error: any) {
    console.error("Error calling Azure OpenAI:", error);

    // Fallbacks for common queries
    const msg = message.toLowerCase();
    if (msg.includes("weather")) {
      return "I recommend checking current weather conditions before heading out. Always be prepared for sudden changes and pack appropriate gear.";
    }
    if (msg.includes("hazard") || msg.includes("danger")) {
      return "Common trail hazards include fallen trees, loose rocks, flooding, and wildlife. Stay alert and stick to marked trails.";
    }
    if (msg.includes("equipment") || msg.includes("gear")) {
      return "Essential trail gear includes good footwear, water, navigation tools, a whistle, first aid kit, and weather-appropriate clothing.";
    }

    return "I'm having trouble connecting right now. Please check your setup or try again later.";
  }
}

// Fetch safety tips (replaces Gemini model call)
export async function getTrailSafetyTips(): Promise<string[]> {
  try {
    const completion = await client.chat.completions.create({
      model: DEPLOYMENT,
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            "Provide 5 essential trail safety tips as a bullet-point list. Each tip should be one concise sentence.",
        },
      ],
    });

    const responseText = cleanMarkdownFormatting(
      completion.choices?.[0]?.message?.content || ""
    );

    const tips = responseText
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => line.replace(/^[-*•]\s*/, "").trim())
      .slice(0, 5);

    return tips;
  } catch (error) {
    console.error("Error getting trail safety tips:", error);
    return [
      "Always check weather conditions before heading out.",
      "Bring plenty of water and emergency supplies.",
      "Stay on marked trails and avoid shortcuts.",
      "Tell someone your hiking plans and return time.",
      "Be aware of wildlife and make noise in bear country.",
    ];
  }
}