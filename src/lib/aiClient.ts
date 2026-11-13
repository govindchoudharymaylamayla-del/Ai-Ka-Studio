import { logUsage } from './firestoreService';
import type {
  CartoonStyle,
  LanguageCode,
  StoryDuration,
  StoryGenre,
  VideoAspectRatio,
  VoiceStyle,
  GeminiVoiceName,
} from '../types/studio';

export class AiServiceError extends Error {
  code: string;
  requiresPaidKey: boolean;

  constructor(message: string, code = 'AI_ERROR', requiresPaidKey = false) {
    super(message);
    this.code = code;
    this.requiresPaidKey = requiresPaidKey;
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new AiServiceError(
      data.error || `Request failed with status ${res.status}`,
      data.code || 'HTTP_ERROR',
      Boolean(data.requiresPaidKey)
    );
  }
  return data as T;
}

export async function uploadMediaBlob(blob: Blob, prefix: string): Promise<{ url: string; fileSizeBytes: number }> {
  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read media blob.'));
    reader.readAsDataURL(blob);
  });

  return postJson('/api/media/upload', {
    base64Data,
    mimeType: blob.type || 'application/octet-stream',
    prefix,
  });
}

export async function uploadBase64DataUrl(dataUrl: string, mimeType: string, prefix: string): Promise<{ url: string; fileSizeBytes: number }> {
  return postJson('/api/media/upload', {
    base64Data: dataUrl,
    mimeType,
    prefix,
  });
}

export async function generateCharacterFromPhoto(
  uid: string,
  userEmail: string | undefined,
  payload: {
    imageBase64: string;
    mimeType: string;
    name: string;
    style: CartoonStyle;
    personality?: string;
  }
) {
  const started = Date.now();
  try {
    const data = await postJson<{
      sourceImageUrl: string;
      cartoonImageUrl: string;
      facialTraits: string;
      accentColor: string;
      suggestedPersonality: string;
      aiPortraitGenerated: boolean;
      warningCode: string | null;
      warningMessage: string | null;
      durationMs: number;
      modelUsed: string;
    }>('/api/ai/character', payload);

    await logUsage(uid, userEmail, {
      feature: 'character',
      model: data.modelUsed,
      status: 'success',
      durationMs: data.durationMs || Date.now() - started,
    });
    return data;
  } catch (err) {
    await logUsage(uid, userEmail, {
      feature: 'character',
      model: 'gemini-3.1-flash-lite-image',
      status: 'error',
      durationMs: Date.now() - started,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export async function generateAiStory(
  uid: string,
  userEmail: string | undefined,
  payload: {
    prompt: string;
    genre: StoryGenre;
    language: LanguageCode;
    durationMinutes: StoryDuration;
    characters: Array<{
      id: string;
      name: string;
      style: CartoonStyle;
      voiceStyle: VoiceStyle;
      voiceName: GeminiVoiceName;
      personality?: string;
      facialTraits?: string;
    }>;
  }
) {
  const started = Date.now();
  try {
    const data = await postJson<{
      title: string;
      titleHindi: string;
      moralOrSummary: string;
      bgmMood: string;
      scenes: Array<{
        orderIndex: number;
        act: 'beginning' | 'middle' | 'climax' | 'ending';
        title: string;
        visualPrompt: string;
        cameraMovement: string;
        transition: string;
        backgroundMood: string;
        characterName: string;
        characterId: string;
        speakerVoiceStyle: VoiceStyle;
        voiceName: GeminiVoiceName;
        dialogueHindi: string;
        dialogueEnglish: string;
        durationSec: number;
        animationStatus: 'pending';
      }>;
      durationMs: number;
      modelUsed: string;
    }>('/api/ai/story', payload);

    await logUsage(uid, userEmail, {
      feature: 'story',
      model: data.modelUsed,
      status: 'success',
      durationMs: data.durationMs || Date.now() - started,
    });
    return data;
  } catch (err) {
    await logUsage(uid, userEmail, {
      feature: 'story',
      model: 'gemini-4-hydrogen',
      status: 'error',
      durationMs: Date.now() - started,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export async function generateSceneTts(
  uid: string,
  userEmail: string | undefined,
  payload: {
    text: string;
    language: LanguageCode;
    voiceStyle: VoiceStyle;
    voiceName: GeminiVoiceName;
    emotion?: string;
  }
) {
  const started = Date.now();
  try {
    const data = await postJson<{
      audioUrl: string;
      durationSec: number;
      voiceName: GeminiVoiceName;
      durationMs: number;
      modelUsed: string;
    }>('/api/ai/tts', payload);

    await logUsage(uid, userEmail, {
      feature: 'tts',
      model: data.modelUsed,
      status: 'success',
      durationMs: data.durationMs || Date.now() - started,
    });
    return data;
  } catch (err) {
    await logUsage(uid, userEmail, {
      feature: 'tts',
      model: 'gemini-3.8-flash-tts',
      status: 'error',
      durationMs: Date.now() - started,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export async function generateSceneKeyframe(
  uid: string,
  userEmail: string | undefined,
  payload: {
    visualPrompt: string;
    characterStyle: CartoonStyle;
    characterTraits?: string;
    aspectRatio: VideoAspectRatio;
    characterImageUrl?: string;
  }
) {
  const started = Date.now();
  try {
    const data = await postJson<{
      frameImageUrl: string;
      frameGenerated: boolean;
      durationMs: number;
      modelUsed: string;
    }>('/api/ai/scene-frame', payload);

    await logUsage(uid, userEmail, {
      feature: 'animation',
      model: data.modelUsed,
      status: 'success',
      durationMs: data.durationMs || Date.now() - started,
    });
    return data;
  } catch (err) {
    await logUsage(uid, userEmail, {
      feature: 'animation',
      model: 'gemini-3.1-flash-lite-image',
      status: 'error',
      durationMs: Date.now() - started,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export async function generateOmniVideoClip(
  uid: string,
  userEmail: string | undefined,
  payload: {
    visualPrompt: string;
    dialogue: string;
    aspectRatio: VideoAspectRatio;
    durationSec: number;
    frameImageUrl?: string;
    characterImageUrl?: string;
  }
) {
  const started = Date.now();
  try {
    const data = await postJson<{
      videoUrl: string;
      durationMs: number;
      modelUsed: string;
    }>('/api/ai/animate-scene', payload);

    await logUsage(uid, userEmail, {
      feature: 'animation',
      model: data.modelUsed,
      status: 'success',
      durationMs: data.durationMs || Date.now() - started,
    });
    return data;
  } catch (err) {
    await logUsage(uid, userEmail, {
      feature: 'animation',
      model: 'gemini-omni-1.2-flash',
      status: 'error',
      durationMs: Date.now() - started,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export async function generateLyriaMusic(
  uid: string,
  userEmail: string | undefined,
  payload: { mood: string; genre: StoryGenre }
) {
  const started = Date.now();
  try {
    const data = await postJson<{
      bgmAudioUrl: string;
      durationMs: number;
      modelUsed: string;
    }>('/api/ai/music', payload);

    await logUsage(uid, userEmail, {
      feature: 'music',
      model: data.modelUsed,
      status: 'success',
      durationMs: data.durationMs || Date.now() - started,
    });
    return data;
  } catch (err) {
    await logUsage(uid, userEmail, {
      feature: 'music',
      model: 'lyria-3-clip-preview',
      status: 'error',
      durationMs: Date.now() - started,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
