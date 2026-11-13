import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(__dirname, 'data');
const MEDIA_DIR = path.join(DATA_DIR, 'media');
fs.mkdirSync(MEDIA_DIR, { recursive: true });

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface ClassifiedError {
  status: number;
  code: string;
  message: string;
  requiresPaidKey: boolean;
}

function classifyGeminiError(err: unknown, contextLabel: string): ClassifiedError {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (lower.includes('api_key_invalid') || lower.includes('api key not valid')) {
    return {
      status: 400,
      code: 'API_KEY_INVALID',
      message: `${contextLabel}: The configured GEMINI_API_KEY is invalid. Check Settings > Secrets in AI Studio.`,
      requiresPaidKey: false,
    };
  }
  if (
    lower.includes('permission_denied') ||
    lower.includes('resource_exhausted') ||
    lower.includes('429') ||
    lower.includes('403') ||
    lower.includes('billing') ||
    lower.includes('paid') ||
    lower.includes('quota')
  ) {
    return {
      status: 402,
      code: 'PAID_KEY_REQUIRED',
      message: `${contextLabel} requires a billing-enabled Gemini API key or exceeded the free-tier quota. You can attach a paid key in AI Studio Settings > Secrets, or continue with the built-in Studio renderer.`,
      requiresPaidKey: true,
    };
  }
  if (lower.includes('not_found') || lower.includes('404')) {
    return {
      status: 404,
      code: 'MODEL_UNAVAILABLE',
      message: `${contextLabel}: Model endpoint unavailable for the current API tier (${raw}).`,
      requiresPaidKey: true,
    };
  }
  return {
    status: 500,
    code: 'AI_GENERATION_FAILED',
    message: `${contextLabel} failed: ${raw}`,
    requiresPaidKey: false,
  };
}

function saveBase64Media(base64Data: string, prefix: string, ext: string): { url: string; filePath: string; bytes: number } {
  const clean = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const buf = Buffer.from(clean, 'base64');
  const filename = `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
  const filePath = path.join(MEDIA_DIR, filename);
  fs.writeFileSync(filePath, buf);
  return {
    url: `/api/media/${filename}`,
    filePath,
    bytes: buf.length,
  };
}

function extensionFromMime(mimeType: string): string {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('mp4')) return 'mp4';
  return 'jpg';
}

function getWavDurationSec(wavBuffer: Buffer): number {
  if (wavBuffer.length <= 44) return 3;
  // Gemini 3.8 TTS unary output: 24kHz, mono, 16-bit PCM (48000 bytes/sec)
  const dataBytes = wavBuffer.length - 44;
  return Math.max(1.5, Math.round((dataBytes / 48000) * 10) / 10);
}

const STYLE_PROMPTS: Record<string, string> = {
  '3d': 'high-end stylized 3D animated film character portrait, soft subsurface skin shading, expressive big cartoon eyes, clean studio lighting, keeping exact facial structure, hairstyle, skin tone, glasses/facial hair, and recognizable likeness of the person in the reference photo',
  'pixar': 'warm Pixar-inspired original 3D animation character portrait, charming rounded geometry, vivid expressive eyes, subtle knit/fabric textures, golden rim lighting, preserving the person’s exact facial features, nose, smile, glasses, and hairstyle',
  'anime': 'theatrical modern anime character portrait, crisp hand-inked linework, vibrant cel-shading, expressive sunlit eyes, faithful stylized likeness preserving the person’s exact facial features, hairstyle, and accessories from the photo',
  'comic': 'bold modern graphic novel comic book character portrait, crisp ink outlines, dynamic shading and subtle halftone texture, expressive face preserving the exact likeness, hairstyle, and features of the person in the reference photo',
};

const VOICE_STYLE_DESCRIPTIONS: Record<string, string> = {
  male: 'Warm, expressive adult male Hindi/English cartoon character voice with clear articulation',
  female: 'Bright, warm adult female Hindi/English cartoon character voice with expressive emotion',
  child: 'Playful, energetic young child cartoon character voice with cheerful curiosity',
  narrator: 'Rich, warm classic Indian storyteller narrator voice with measured cinematic pacing',
};

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '60mb' }));
  app.use('/api/media', express.static(MEDIA_DIR));

  app.get('/api/health', (_req, res) => {
    const ai = getAiClient();
    res.json({
      ok: true,
      geminiConfigured: Boolean(ai),
      models: {
        story: 'gemini-4-hydrogen',
        tts: 'gemini-3.8-flash-tts',
        ttsLite: 'gemini-3.8-flash-lite-tts',
        image: 'gemini-3.1-flash-lite-image',
        video: 'gemini-omni-1.2-flash',
        music: 'lyria-3-clip-preview',
      },
    });
  });

  // Upload client-generated media (e.g., WebM exported video or Canvas2D toon PNG)
  app.post('/api/media/upload', (req, res) => {
    try {
      const { base64Data, mimeType, prefix } = req.body as {
        base64Data?: string;
        mimeType?: string;
        prefix?: string;
      };
      if (!base64Data || typeof base64Data !== 'string') {
        res.status(400).json({ error: 'Missing base64Data payload.' });
        return;
      }
      const safePrefix = (prefix || 'asset').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'asset';
      const ext = extensionFromMime(mimeType || 'application/octet-stream');
      const saved = saveBase64Media(base64Data, safePrefix, ext);
      res.json({ url: saved.url, fileSizeBytes: saved.bytes });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Media upload failed.' });
    }
  });

  // 1. Photo to Cartoon Character (Gemini 4 Hydrogen Vision + Gemini 3.1 Flash Lite Image)
  app.post('/api/ai/character', async (req, res) => {
    const started = Date.now();
    try {
      const { imageBase64, mimeType, name, style, personality } = req.body as {
        imageBase64?: string;
        mimeType?: string;
        name?: string;
        style?: string;
        personality?: string;
      };

      if (!imageBase64 || !mimeType) {
        res.status(400).json({ error: 'Please upload or capture a photo first.' });
        return;
      }

      const sourceExt = extensionFromMime(mimeType);
      const savedSource = saveBase64Media(imageBase64, 'source', sourceExt);
      const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

      const ai = getAiClient();
      if (!ai) {
        res.status(503).json({
          error: 'GEMINI_API_KEY is not configured on the server. Add it in AI Studio Settings > Secrets.',
          code: 'API_KEY_MISSING',
        });
        return;
      }

      // Step 1: Extract detailed facial traits for cross-scene consistency using gemini-4-hydrogen
      let facialTraits = `${name || 'Character'} in ${style || '3d'} cartoon style`;
      let accentColor = '#EA580C';
      let suggestedPersonality = personality || 'Curious, kind-hearted adventurer';

      try {
        const visionResponse = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
              {
                text: `Analyze the person in this photo so an animation studio can preserve their recognizable likeness across every cartoon scene. Return strict JSON with:
                - facialTraits: concise 2-sentence visual character sheet description (age bracket, face shape, skin tone, hair style/color, eyes, glasses/facial hair, outfit colors)
                - accentColor: a vibrant hex color matching their outfit or vibe (e.g. #EA580C)
                - suggestedPersonality: short 1-sentence cartoon personality if not already specified`,
              },
            ],
          },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                facialTraits: { type: Type.STRING },
                accentColor: { type: Type.STRING },
                suggestedPersonality: { type: Type.STRING },
              },
            },
          },
        });
        const parsed = JSON.parse((visionResponse.text || '{}').trim());
        if (parsed.facialTraits) facialTraits = parsed.facialTraits;
        if (parsed.accentColor && /^#[0-9A-Fa-f]{6}$/.test(parsed.accentColor)) {
          accentColor = parsed.accentColor;
        }
        if (!personality && parsed.suggestedPersonality) {
          suggestedPersonality = parsed.suggestedPersonality;
        }
      } catch (visionErr) {
        console.warn('Vision trait extraction warning:', visionErr);
      }

      // Step 2: Generate cartoon character portrait using gemini-3.1-flash-lite-image
      const styleGuide = STYLE_PROMPTS[style || '3d'] || STYLE_PROMPTS['3d'];
      let cartoonImageUrl = '';
      let aiPortraitGenerated = false;
      let warningCode: string | null = null;
      let warningMessage: string | null = null;

      try {
        const imgResp = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-image',
          contents: {
            parts: [
              {
                inlineData: {
                  data: cleanBase64,
                  mimeType,
                },
              },
              {
                text: `Transform the person in this photo into a ${styleGuide}. Character name: ${name || 'Hero'}. Key traits to preserve accurately: ${facialTraits}. Clean centered waist-up studio portrait on a soft neutral backdrop, no text or watermarks.`,
              },
            ],
          },
          config: {
            imageConfig: {
              aspectRatio: '1:1',
            },
          },
        });

        for (const part of imgResp.candidates?.[0]?.content?.parts ?? []) {
          if (part.inlineData?.data) {
            const outExt = extensionFromMime(part.inlineData.mimeType || 'image/png');
            const savedCartoon = saveBase64Media(part.inlineData.data, 'cartoon', outExt);
            cartoonImageUrl = savedCartoon.url;
            aiPortraitGenerated = true;
            break;
          }
        }
        if (!aiPortraitGenerated) {
          warningCode = 'NO_IMAGE_RETURNED';
          warningMessage = 'Image model completed without an image frame. Local stylized portrait rendering is active.';
        }
      } catch (imgErr) {
        const classified = classifyGeminiError(imgErr, 'Gemini Image Generation (gemini-3.1-flash-lite-image)');
        warningCode = classified.code;
        warningMessage = classified.message;
      }

      res.json({
        sourceImageUrl: savedSource.url,
        cartoonImageUrl: cartoonImageUrl || savedSource.url,
        facialTraits,
        accentColor,
        suggestedPersonality,
        aiPortraitGenerated,
        warningCode,
        warningMessage,
        durationMs: Date.now() - started,
        modelUsed: aiPortraitGenerated ? 'gemini-3.1-flash-lite-image' : 'gemini-4-hydrogen',
      });
    } catch (err) {
      const classified = classifyGeminiError(err, 'Character Creation');
      res.status(classified.status).json({ error: classified.message, code: classified.code });
    }
  });

  // 2. AI Story & Bilingual Script Generator (Gemini 4 Hydrogen)
  app.post('/api/ai/story', async (req, res) => {
    const started = Date.now();
    try {
      const ai = getAiClient();
      if (!ai) {
        res.status(503).json({
          error: 'GEMINI_API_KEY is not configured on the server.',
          code: 'API_KEY_MISSING',
        });
        return;
      }

      const { prompt, genre, language, durationMinutes, characters } = req.body as {
        prompt?: string;
        genre?: string;
        language?: 'hi' | 'en';
        durationMinutes?: number;
        characters?: Array<{
          id: string;
          name: string;
          style: string;
          voiceStyle: string;
          voiceName: string;
          personality?: string;
          facialTraits?: string;
        }>;
      };

      const dur = [1, 3, 5, 10].includes(Number(durationMinutes)) ? Number(durationMinutes) : 3;
      const targetSceneCount = dur === 1 ? 4 : dur === 3 ? 6 : dur === 5 ? 8 : 12;
      const castList = Array.isArray(characters) && characters.length > 0
        ? characters
        : [{ id: 'narrator', name: 'Kathakar', style: '3d', voiceStyle: 'narrator', voiceName: 'Charon', personality: 'Warm storyteller', facialTraits: 'Friendly animated narrator' }];

      const castDescription = castList
        .map((c) => `- ${c.name} (id: ${c.id}, style: ${c.style}, voiceStyle: ${c.voiceStyle}, voiceName: ${c.voiceName}, personality: ${c.personality || 'kind'}, appearance: ${c.facialTraits || 'cartoon character'})`)
        .join('\n');

      const systemInstruction = `You are a master Bollywood & family animation screenwriter and storyboard director.
Write engaging, heartwarming, age-appropriate cartoon stories structured cleanly across four acts: beginning, middle, climax, and ending.
Every scene MUST have both:
1. Natural, expressive Devanagari Hindi dialogue (dialogueHindi) suitable for Hindi voice acting.
2. Accurate, vivid English dialogue/subtitle (dialogueEnglish).
Ensure character appearance details stay consistent across visualPrompt descriptions.`;

      const userPrompt = `Create a ${dur}-minute ${genre || 'family'} cartoon story in primary language "${language === 'hi' ? 'Hindi' : 'English'}".
Story Idea / Theme: ${prompt || 'A clever child and family discover kindness and teamwork in a sunlit Indian town.'}

Cast Characters (assign scenes across these characters and Narrator):
${castDescription}

Generate exactly ${targetSceneCount} scenes distributed evenly across 'beginning', 'middle', 'climax', and 'ending'.
Keep each scene's dialogue crisp (1-3 spoken sentences) and assign realistic durationSec (between 7 and 14 seconds per scene).`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: 'Catchy English story title' },
              titleHindi: { type: Type.STRING, description: 'Catchy Devanagari Hindi story title' },
              moralOrSummary: { type: Type.STRING, description: 'One-sentence story summary or moral' },
              bgmMood: { type: Type.STRING, description: 'Recommended soundtrack mood e.g. Playful Folk Flute & Tabla' },
              scenes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    act: { type: Type.STRING, description: 'One of: beginning, middle, climax, ending' },
                    title: { type: Type.STRING },
                    visualPrompt: { type: Type.STRING, description: 'Detailed cartoon scene backdrop, character pose, expression, and lighting' },
                    cameraMovement: { type: Type.STRING, description: 'One of: zoom-in, zoom-out, pan-left, pan-right, static' },
                    transition: { type: Type.STRING, description: 'One of: fade, slide, dissolve, cut' },
                    backgroundMood: { type: Type.STRING, description: 'One of: sunny_village, cozy_home, enchanted_forest, starry_night, vibrant_market, school_courtyard' },
                    characterName: { type: Type.STRING },
                    speakerVoiceStyle: { type: Type.STRING, description: 'One of: male, female, child, narrator' },
                    dialogueHindi: { type: Type.STRING, description: 'Natural Devanagari Hindi dialogue' },
                    dialogueEnglish: { type: Type.STRING, description: 'Natural English dialogue / subtitle' },
                    durationSec: { type: Type.NUMBER },
                  },
                },
              },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text || '{}').trim());
      const validActs = new Set(['beginning', 'middle', 'climax', 'ending']);
      const validVoices = new Set(['male', 'female', 'child', 'narrator']);

      const normalizedScenes = (Array.isArray(parsed.scenes) ? parsed.scenes : []).slice(0, 15).map((s: Record<string, unknown>, idx: number) => {
        const charName = String(s.characterName || castList[0].name);
        const matchedChar = castList.find((c) => c.name.toLowerCase() === charName.toLowerCase()) || castList[idx % castList.length];
        const actRaw = String(s.act || 'middle').toLowerCase();
        const act = validActs.has(actRaw) ? actRaw : idx === 0 ? 'beginning' : idx === targetSceneCount - 1 ? 'ending' : 'middle';
        const vStyleRaw = String(s.speakerVoiceStyle || matchedChar.voiceStyle || 'narrator').toLowerCase();
        const speakerVoiceStyle = validVoices.has(vStyleRaw) ? vStyleRaw : 'narrator';

        return {
          orderIndex: idx,
          act,
          title: String(s.title || `Scene ${idx + 1}`).slice(0, 130),
          visualPrompt: String(s.visualPrompt || 'Colorful animated cartoon scene').slice(0, 950),
          cameraMovement: String(s.cameraMovement || 'zoom-in').slice(0, 50),
          transition: String(s.transition || 'fade').slice(0, 30),
          backgroundMood: String(s.backgroundMood || 'sunny_village').slice(0, 50),
          characterName: matchedChar.name,
          characterId: matchedChar.id,
          speakerVoiceStyle,
          voiceName: matchedChar.voiceName || 'Kore',
          dialogueHindi: String(s.dialogueHindi || 'कहानी आगे बढ़ती है।').slice(0, 950),
          dialogueEnglish: String(s.dialogueEnglish || 'The story unfolds.').slice(0, 950),
          durationSec: Math.min(30, Math.max(5, Number(s.durationSec) || 8)),
          animationStatus: 'pending',
        };
      });

      res.json({
        title: String(parsed.title || 'Untitled Cartoon Story').slice(0, 130),
        titleHindi: String(parsed.titleHindi || 'नई कार्टून कहानी').slice(0, 150),
        moralOrSummary: String(parsed.moralOrSummary || 'A heartwarming animated tale.').slice(0, 550),
        bgmMood: String(parsed.bgmMood || 'Playful Acoustic Folk').slice(0, 100),
        scenes: normalizedScenes,
        durationMs: Date.now() - started,
        modelUsed: 'gemini-4-hydrogen',
      });
    } catch (err) {
      const classified = classifyGeminiError(err, 'Story Generation');
      res.status(classified.status).json({ error: classified.message, code: classified.code });
    }
  });

  // 3. Natural Hindi & English Character Voiceover (Gemini 3.8 TTS)
  app.post('/api/ai/tts', async (req, res) => {
    const started = Date.now();
    try {
      const ai = getAiClient();
      if (!ai) {
        res.status(503).json({
          error: 'GEMINI_API_KEY is not configured on the server.',
          code: 'API_KEY_MISSING',
        });
        return;
      }

      const { text, language, voiceStyle, voiceName, emotion } = req.body as {
        text?: string;
        language?: 'hi' | 'en';
        voiceStyle?: string;
        voiceName?: string;
        emotion?: string;
      };

      if (!text || !text.trim()) {
        res.status(400).json({ error: 'Dialogue text is required for voice synthesis.' });
        return;
      }

      const validVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
      const chosenVoice = validVoices.includes(voiceName || '') ? voiceName! : 'Kore';
      const styleDesc = VOICE_STYLE_DESCRIPTIONS[voiceStyle || 'narrator'] || VOICE_STYLE_DESCRIPTIONS.narrator;
      const langLabel = language === 'hi' ? 'Hindi (natural Indian pronunciation)' : 'English';

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: text.trim(),
                speechMetadata: {
                  style: `${styleDesc}. Speak in ${langLabel}. Tone: ${emotion || 'expressive cartoon storytelling'}.`,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: chosenVoice },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        res.status(502).json({
          error: 'TTS model did not return audio data. Try shortening the line or retrying.',
          code: 'TTS_EMPTY',
        });
        return;
      }

      const wavBuffer = Buffer.from(base64Audio, 'base64');
      const saved = saveBase64Media(base64Audio, 'tts', 'wav');
      const durationSec = getWavDurationSec(wavBuffer);

      res.json({
        audioUrl: saved.url,
        durationSec,
        voiceName: chosenVoice,
        durationMs: Date.now() - started,
        modelUsed: 'gemini-3.8-flash-tts',
      });
    } catch (err) {
      const classified = classifyGeminiError(err, 'Hindi/English TTS');
      res.status(classified.status).json({ error: classified.message, code: classified.code });
    }
  });

  // 4. Scene Backdrop / Keyframe Generation (gemini-3.1-flash-lite-image)
  app.post('/api/ai/scene-frame', async (req, res) => {
    const started = Date.now();
    try {
      const ai = getAiClient();
      if (!ai) {
        res.status(503).json({ error: 'GEMINI_API_KEY missing.', code: 'API_KEY_MISSING' });
        return;
      }

      const { visualPrompt, characterStyle, characterTraits, aspectRatio, characterImageUrl } = req.body as {
        visualPrompt?: string;
        characterStyle?: string;
        characterTraits?: string;
        aspectRatio?: '16:9' | '9:16';
        characterImageUrl?: string;
      };

      const parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> = [];

      // Attach character portrait from local media if available to keep character consistency
      if (characterImageUrl && characterImageUrl.startsWith('/api/media/')) {
        const localName = path.basename(characterImageUrl);
        const localPath = path.join(MEDIA_DIR, localName);
        if (fs.existsSync(localPath)) {
          const buf = fs.readFileSync(localPath);
          parts.push({
            inlineData: {
              data: buf.toString('base64'),
              mimeType: localName.endsWith('.png') ? 'image/png' : 'image/jpeg',
            },
          });
        }
      }

      parts.push({
        text: `Animated cartoon movie still in ${characterStyle || '3d'} style. Scene description: ${visualPrompt || 'Sunny animated courtyard'}. Character traits to keep consistent: ${characterTraits || 'friendly cartoon protagonist'}. Expressive cinematic composition, zero text overlays.`,
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-image',
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio === '9:16' ? '9:16' : '16:9',
          },
        },
      });

      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          const ext = extensionFromMime(part.inlineData.mimeType || 'image/png');
          const saved = saveBase64Media(part.inlineData.data, 'frame', ext);
          res.json({
            frameImageUrl: saved.url,
            frameGenerated: true,
            durationMs: Date.now() - started,
            modelUsed: 'gemini-3.1-flash-lite-image',
          });
          return;
        }
      }

      res.status(422).json({
        error: 'No scene frame was returned by the image model.',
        code: 'NO_IMAGE_RETURNED',
      });
    } catch (err) {
      const classified = classifyGeminiError(err, 'Scene Keyframe Image Generation');
      res.status(classified.status).json({
        error: classified.message,
        code: classified.code,
        requiresPaidKey: classified.requiresPaidKey,
      });
    }
  });

  // 5. AI Video Clip Generation via Gemini Interactions API (gemini-omni-1.2-flash)
  app.post('/api/ai/animate-scene', async (req, res) => {
    const started = Date.now();
    try {
      const ai = getAiClient();
      if (!ai) {
        res.status(503).json({ error: 'GEMINI_API_KEY missing.', code: 'API_KEY_MISSING' });
        return;
      }

      const { visualPrompt, dialogue, aspectRatio, durationSec, frameImageUrl, characterImageUrl } = req.body as {
        visualPrompt?: string;
        dialogue?: string;
        aspectRatio?: '16:9' | '9:16';
        durationSec?: number;
        frameImageUrl?: string;
        characterImageUrl?: string;
      };

      const refUrl = frameImageUrl || characterImageUrl;
      const inputItems: Array<{ type: 'image'; mime_type: string; data: string } | { type: 'text'; text: string }> = [];

      if (refUrl && refUrl.startsWith('/api/media/')) {
        const localName = path.basename(refUrl);
        const localPath = path.join(MEDIA_DIR, localName);
        if (fs.existsSync(localPath)) {
          const buf = fs.readFileSync(localPath);
          inputItems.push({
            type: 'image',
            mime_type: localName.endsWith('.png') ? 'image/png' : 'image/jpeg',
            data: buf.toString('base64'),
          });
        }
      }

      const clampedSec = Math.min(10, Math.max(3, Math.round(durationSec || 6)));
      inputItems.push({
        type: 'text',
        text: `Animate this cartoon scene smoothly with natural character facial expressions, blinking eyes, lip movement matching dialogue ("${(dialogue || '').slice(0, 120)}"), and gentle camera motion. Scene: ${visualPrompt || 'Warm animated cartoon scene'}.`,
      });

      const interaction = await ai.interactions.create(
        {
          model: 'gemini-omni-1.2-flash',
          input: inputItems,
          background: false,
          store: false,
          stream: false,
          response_format: {
            type: 'video',
            aspect_ratio: aspectRatio === '9:16' ? '9:16' : '16:9',
            duration: `${clampedSec}s`,
            resolution: '720p',
          },
        },
        { timeout: 300000 }
      );

      const videoPart = interaction.output_video;
      if (!videoPart?.data) {
        res.status(502).json({
          error: 'Omni Flash video interaction completed without video bytes.',
          code: 'VIDEO_EMPTY',
        });
        return;
      }

      const saved = saveBase64Media(videoPart.data, 'clip', 'mp4');
      res.json({
        videoUrl: saved.url,
        durationMs: Date.now() - started,
        modelUsed: 'gemini-omni-1.2-flash',
      });
    } catch (err) {
      const classified = classifyGeminiError(err, 'AI Video Animation (gemini-omni-1.2-flash)');
      res.status(classified.status).json({
        error: classified.message,
        code: classified.code,
        requiresPaidKey: classified.requiresPaidKey,
      });
    }
  });

  // 6. AI Background Music Generation (lyria-3-clip-preview)
  app.post('/api/ai/music', async (req, res) => {
    const started = Date.now();
    try {
      const ai = getAiClient();
      if (!ai) {
        res.status(503).json({ error: 'GEMINI_API_KEY missing.', code: 'API_KEY_MISSING' });
        return;
      }

      const { mood, genre } = req.body as { mood?: string; genre?: string };
      const response = await ai.models.generateContentStream({
        model: 'lyria-3-clip-preview',
        contents: `Generate a 30-second instrumental cartoon background soundtrack suitable for a ${genre || 'family'} animated story. Mood: ${mood || 'cheerful acoustic flute, warm marimba, gentle tabla percussion'}. No vocals.`,
      });

      const audioChunks: Buffer[] = [];
      let mimeType = 'audio/mpeg';

      for await (const chunk of response) {
        const parts = chunk.candidates?.[0]?.content?.parts;
        if (!parts) continue;
        for (const part of parts) {
          if (part.inlineData?.data) {
            if (audioChunks.length === 0 && part.inlineData.mimeType) {
              mimeType = part.inlineData.mimeType;
            }
            audioChunks.push(Buffer.from(part.inlineData.data, 'base64'));
          }
        }
      }

      if (audioChunks.length === 0) {
        res.status(502).json({
          error: 'Lyria returned no audio chunks.',
          code: 'MUSIC_EMPTY',
        });
        return;
      }

      const combined = Buffer.concat(audioChunks).toString('base64');
      const ext = extensionFromMime(mimeType);
      const saved = saveBase64Media(combined, 'bgm', ext);

      res.json({
        bgmAudioUrl: saved.url,
        durationMs: Date.now() - started,
        modelUsed: 'lyria-3-clip-preview',
      });
    } catch (err) {
      const classified = classifyGeminiError(err, 'Lyria Music Generation (lyria-3-clip-preview)');
      res.status(classified.status).json({
        error: classified.message,
        code: classified.code,
        requiresPaidKey: classified.requiresPaidKey,
      });
    }
  });

  // Vite dev middleware vs static production serving
  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
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
    console.log(`KathaToon Studio server listening on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
