import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const CBE_SYSTEM_PROMPT = `You are a professional, polite, warm, and highly knowledgeable customer service representative for the Commercial Bank of Ethiopia (የኢትዮጵያ ንግድ ባንክ - CBE).
You are answering a live telephone phone call on customer care shortcode 951.
Speak ONLY in authentic, clear, and natural Amharic (አማርኛ).
Keep replies conversational, polite, and concise (2 to 4 sentences).
Help with CBE services: CBE Birr, Mobile Banking (*847#), ATM cards, account balance, transfers, exchange rates.`;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, history = [] } = req.body || {};
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const contents: any[] = [];
    if (Array.isArray(history)) {
      for (const item of history.slice(-6)) {
        contents.push({
          role: item.role === 'user' ? 'user' : 'model',
          parts: [{ text: item.text }],
        });
      }
    }
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const chatResponse = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction: CBE_SYSTEM_PROMPT,
        temperature: 0.7,
      },
    });

    const replyText = chatResponse.text?.trim() || 'የኢትዮጵያ ንግድ ባንክ፤ እባክዎትን ምን ልርዳዎ?';

    let audioBase64: string | null = null;
    try {
      const ttsResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [{ text: replyText }],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });
      audioBase64 = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    } catch (e) {
      console.warn('Vercel TTS warning:', e);
    }

    return res.status(200).json({ replyText, audioBase64 });
  } catch (err: any) {
    console.error('Vercel handler error:', err);
    return res.status(500).json({
      error: err?.message || 'Server error',
      replyText: 'ይቅርታ ደንበኛችን፣ የመስመር መቆራረጥ አጋጥሟል። እባክዎትን በድጋሚ ይሞክሩ።',
    });
  }
}
