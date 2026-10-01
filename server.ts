import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '30mb' }));

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

Guidelines:
1. Speak ONLY in authentic, clear, and natural Amharic (አማርኛ).
2. Since this is an interactive phone call, keep your replies conversational, polite, and concise (usually 2 to 4 sentences). Never give long academic essays or bullet point dumps.
3. Use respectful Ethiopian customer service courtesies such as:
   - "እሺ ክቡር ደንበኛችን"
   - "በደስታ እረዳዎታለሁ"
   - "አይዞዎት፣ መፍትሄ እናገኝለታለን"
   - "አመሰግናለሁ"
4. Help with common CBE bank questions:
   - CBE Birr (የሲቢኢ ብር ፒን መርሳት፣ የተሳሳተ ገንዘብ ማስተላለፍ፣ ሂሳብ ማገናኘት)
   - Mobile Banking (*847# እና CBE Mobile App)
   - ATM ካርድ (በማሽን የተዋጠ ካርድ፣ አዲስ ማውጣት፣ ፒን መቀየር)
   - የሂሳብ ቀሪ ማወቅ እና የባንክ ሂሳብ መክፈት
   - የውጭ ሀገር ገንዘብ ዝውውር (Western Union, Swift, MoneyGram, Ria)
   - የውጭ ምንዛሬ (የዶላር እና የዩሮ ተመን)
   - ብድር እና የቁጠባ አይነቶች
5. If the caller's query is vague, politely ask them to clarify in Amharic.`;

// 1. Text Chat + TTS Generation endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Build chat contents
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

    // Generate response using gemini-3.8-flash
    const chatResponse = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction: CBE_SYSTEM_PROMPT,
        temperature: 0.7,
      },
    });

    const replyText = chatResponse.text?.trim() || 'የኢትዮጵያ ንግድ ባንክ፤ እባክዎትን በድጋሚ ይንገሩኝ?';

    // Generate Audio using gemini-3.8-flash-lite-tts
    let audioBase64: string | null = null;
    try {
      const ttsResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: replyText,
                speechMetadata: {
                  style: 'Warm, respectful, professional Ethiopian bank customer service agent',
                },
              },
            ],
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

      const audioData = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (audioData) {
        audioBase64 = audioData;
      }
    } catch (ttsErr) {
      console.warn('TTS generation warning:', ttsErr);
      // Even if TTS has a glitch, replyText is safely returned
    }

    return res.json({
      replyText,
      audioBase64,
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to process chat',
      replyText: 'ይቅርታ ደንበኛችን፣ የመስመር መቆራረጥ አጋጥሟል። እባክዎትን በድጋሚ ይሞክሩ።',
    });
  }
});

// 2. Audio input (Voice speech) -> Transcribe and/or direct response
app.post('/api/transcribe-and-reply', async (req, res) => {
  try {
    const { audioBase64, mimeType = 'audio/webm', history = [] } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: 'audioBase64 is required' });
    }

    // Step A: Transcribe audio to Amharic text using gemini-3.5-transcribe
    let transcribedText = '';
    try {
      const transcribeResponse = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
            {
              text: 'Transcribe the spoken Amharic (አማርኛ) audio into Amharic text exactly as spoken. Return only the transcribed Amharic text with no English explanations.',
            },
          ],
        },
      });
      transcribedText = transcribeResponse.text?.trim() || '';
    } catch (trErr) {
      console.warn('Transcription error, trying fallback:', trErr);
      // Fallback with gemini-3.8-flash multimodal
      const fallbackResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
            {
              text: 'Listen to this spoken Amharic audio. Transcribe the Amharic speech into Amharic text.',
            },
          ],
        },
      });
      transcribedText = fallbackResponse.text?.trim() || '';
    }

    if (!transcribedText) {
      transcribedText = 'ድምፅ አልተሰማም';
    }

    // Step B: Generate CBE AI bank reply
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
      parts: [{ text: transcribedText }],
    });

    const chatResponse = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction: CBE_SYSTEM_PROMPT,
        temperature: 0.7,
      },
    });

    const replyText = chatResponse.text?.trim() || 'የኢትዮጵያ ንግድ ባንክ፤ እባክዎትን ጥያቄዎን በድጋሚ ያሰሙን?';

    // Step C: Synthesize TTS
    let replyAudioBase64: string | null = null;
    try {
      const ttsResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: replyText,
                speechMetadata: {
                  style: 'Warm, respectful, professional Ethiopian bank customer service agent',
                },
              },
            ],
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
      replyAudioBase64 = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    } catch (ttsErr) {
      console.warn('TTS error in transcribe-and-reply:', ttsErr);
    }

    return res.json({
      transcribedText,
      replyText,
      audioBase64: replyAudioBase64,
    });
  } catch (error: any) {
    console.error('Transcribe & reply error:', error);
    return res.status(500).json({
      error: error?.message || 'Processing failed',
      replyText: 'ይቅርታ ደንበኛችን፣ ድምፅዎን በደንብ አልሰማሁትም። እባክዎትን ደግመው ይንገሩኝ።',
    });
  }
});

// 3. Standalone TTS endpoint
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voice = 'Kore' } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const ttsResponse = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [{ text }],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice || 'Kore' },
          },
        },
      },
    });

    const audioBase64 = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioBase64) {
      return res.status(500).json({ error: 'No audio generated' });
    }

    return res.json({ audioBase64 });
  } catch (error: any) {
    console.error('TTS endpoint error:', error);
    return res.status(500).json({ error: error?.message || 'TTS generation failed' });
  }
});

// Setup Vite middleware in dev or static files in prod
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
