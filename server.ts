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
app.use('/audio', express.static(path.resolve(__dirname, 'public/audio')));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Semantic matcher for user's recorded MP3 clips
function matchRecordedAudioResponse(
  userText: string,
  history: any[]
): { audioUrl: string; replyText: string } | null {
  const norm = (userText || '').toLowerCase();

  // Check if File 2 ("ገንዘብ አስተላልፈው ነበር...") has already been played
  const hasPlayedFile2 = history.some(
    (h) =>
      (h.text && h.text.includes('ወዴትኛው አካውንት ነው ያስተላለፉት')) ||
      (h.audioUrl && h.audioUrl.includes('2_genzeb_astelalfeh_neber'))
  );

  // Check if File 3 ("እሺ የእርሶን የተመዘገቡበትን አካውንት ቁጥር...") has already been played
  const hasPlayedFile3 = history.some(
    (h) =>
      (h.text && h.text.includes('የተመዘገቡበትን አካውንት ቁጥር')) ||
      (h.audioUrl && h.audioUrl.includes('3_eshe_yerson_acc_kuter'))
  );

  // Case 1: Caller mentions money transfer or sending money
  const isTransferTopic =
    norm.includes('ገንዘብ') ||
    norm.includes('ብር') ||
    norm.includes('አስተላልፍ') ||
    norm.includes('አስተላለፍኩ') ||
    norm.includes('ልኬ') ||
    norm.includes('ተላከ') ||
    norm.includes('አልደረሰ') ||
    norm.includes('ባላንስ') ||
    norm.includes('አካውንት');

  if (isTransferTopic && !hasPlayedFile2) {
    return {
      audioUrl: '/audio/2_genzeb_astelalfeh_neber.mp3',
      replyText:
        'ገንዘብ አስተላልፈው ነበር? ገንዘብ አስተላልፈው ነበር ወዴትኛው አካውንት ነው ያስተላለፉት? ማለት ከዚህ አካውንት ነው ያስተላለፉት? አሁን ከሚጠቀሙበት አካውንት?',
    };
  }

  // Case 2: File 2 was played, caller responds confirming origin account
  if (hasPlayedFile2 && !hasPlayedFile3) {
    return {
      audioUrl: '/audio/3_eshe_yerson_acc_kuter.mp3',
      replyText:
        'እሺ የእርሶን የተመዘገቡበትን አካውንት ቁጥር ይንገሩኝ? እና ስም... ስሙን ይንገሩኝ? እና የእናት ስም አንድ ላይ ይንገሩኝ?',
    };
  }

  return null;
}

const CBE_SYSTEM_PROMPT = `You are a professional, polite, warm, and highly knowledgeable customer service representative for the Commercial Bank of Ethiopia (የኢትዮጵያ ንግድ ባንክ - CBE).
You are answering a live telephone call on customer care shortcode 951.

Strict Rules:
1. Speak ONLY in authentic, clear, natural, and polite Amharic (አማርኛ).
2. Keep replies conversational, concise (2 to 4 sentences maximum), and professional as in a real telephone call.
3. Use respectful Ethiopian customer service courtesies:
   - "እሺ ክቡር ደንበኛችን"
   - "በደስታ እረዳዎታለሁ"
   - "አይዞዎት፣ ምንም አይጨነቁ"
   - "አመሰግናለሁ"

Specific Money Transfer Issue Protocol (ገንዘብ ተላልፎ ላልደረሰው ደንበኛ):
- When a customer says they transferred or sent money ("ገንዘብ ልኬ ነበር" or "ብር ልኬ አልደረሰም"):
  1. If they haven't specified the channel or recipient details, ask politely:
     "እሺ ክቡር ደንበኛችን፤ በምን መንገድ ነው የላኩት? እና የተላከለትን ሰው የአካውንት ስም እና የሂሳብ ቁጥር ይንገሩኝ?"
  2. When the customer tells you the recipient's account name or number (e.g. "ሰውየው ጋር አልደረሰም፣ ሜሴጅ አልደረሰውም ወይም ባላንስ አልጨመረም..."):
     Respond reassuringly:
     "እሺ እባክዎትን ጥቂት ሰከንድ መስመር ላይ ይጠብቁ፣ በሲስተማችን እያረጋገጥኩ ነው..."
     Followed immediately by:
     "አዎ ክቡር ደንበኛችን፣ ገንዘቡ ከእርስዎ ሂሳብ በትክክል ተላልፏል። ለተላከለት ሰው ወዲያው ያልደረሰው በጊዜያዊ የኔትዎርክ እና የሲስተም መጨናነቅ ምክንያት ነው። በ24 ሰዓት ውስጥ ወደ አካውንታቸው ይደርሳል፣ የማረጋገጫ የጽሁፍ መልዕክት (SMS) ይደርሳቸዋል፣ እንዲሁም ወደ ባላንሳቸው ይደመራል፤ ምንም አይጨነቁ። ሌላ የምረዳዎት ነገር አለ?"

Other CBE Services:
- CBE Birr (የሲቢኢ ብር ፒን መርሳት፣ የተሳሳተ ገንዘብ ማስተላለፍ፣ ሂሳብ ማገናኘት)
- Mobile Banking (*847# እና CBE Mobile App)
- ATM ካርድ (በማሽን የተዋጠ ካርድ፣ አዲስ ማውጣት፣ ፒን መቀየር)
- የሂሳብ ቀሪ ማወቅ እና የባንክ ሂሳብ መክፈት
- የውጭ ሀገር ገንዘብ ዝውውር እና የምንዛሬ ተመን
Always end with a polite closing like "ሌላ የምረዳዎት ነገር አለ?".`;

// 1. Text Chat + TTS Generation endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // First check if user matches recorded human MP3 files
    const audioMatch = matchRecordedAudioResponse(message, history);
    if (audioMatch) {
      return res.json({
        replyText: audioMatch.replyText,
        audioUrl: audioMatch.audioUrl,
        audioBase64: null,
      });
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

function cleanAudioMimeType(mime?: string): string {
  if (!mime) return 'audio/webm';
  const clean = mime.split(';')[0].trim().toLowerCase();
  if (clean.includes('webm')) return 'audio/webm';
  if (clean.includes('mp4') || clean.includes('m4a')) return 'audio/mp4';
  if (clean.includes('wav')) return 'audio/wav';
  if (clean.includes('ogg')) return 'audio/ogg';
  if (clean.includes('mp3') || clean.includes('mpeg')) return 'audio/mp3';
  if (clean.includes('aac')) return 'audio/aac';
  return 'audio/webm';
}

// 2. Audio input (Voice speech) -> Transcribe and/or direct response
app.post('/api/transcribe-and-reply', async (req, res) => {
  try {
    const { audioBase64, mimeType = 'audio/webm', history = [] } = req.body;
    if (!audioBase64 || typeof audioBase64 !== 'string' || audioBase64.trim().length < 100) {
      return res.json({
        transcribedText: '',
        replyText: 'የኢትዮጵያ ንግድ ባንክ፤ እባክዎትን ጥያቄዎን በድጋሚ ያሰሙን?',
        audioBase64: null,
      });
    }

    const cleanMime = cleanAudioMimeType(mimeType);
    const cleanBase64 = audioBase64.trim();

    // Step A: Transcribe audio to Amharic text using gemini-3.5-transcribe
    let transcribedText = '';
    try {
      const transcribeResponse = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: cleanMime,
                  data: cleanBase64,
                },
              },
              {
                text: 'Transcribe this audio.',
              },
            ],
          },
        ],
      });
      transcribedText = transcribeResponse.text?.trim() || '';
    } catch (trErr) {
      console.warn('Transcription error, trying fallback:', trErr);
      try {
        // Fallback with gemini-3.8-flash multimodal
        const fallbackResponse = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: cleanMime,
                    data: cleanBase64,
                  },
                },
                {
                  text: 'Listen to this spoken audio and transcribe the Amharic speech into Amharic text.',
                },
              ],
            },
          ],
        });
        transcribedText = fallbackResponse.text?.trim() || '';
      } catch (fbErr) {
        console.warn('Fallback transcribe error:', fbErr);
      }
    }

    if (!transcribedText) {
      transcribedText = 'ድምፅ አልተሰማም';
    }

    // Check if user speech matches recorded human MP3 files
    const audioMatch = matchRecordedAudioResponse(transcribedText, history);
    if (audioMatch) {
      return res.json({
        transcribedText,
        replyText: audioMatch.replyText,
        audioUrl: audioMatch.audioUrl,
        audioBase64: null,
      });
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

  if (process.env.VERCEL !== '1') {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

if (process.env.VERCEL !== '1') {
  startServer();
}

export default app;
export { app };
