export type LanguageCode = 'en' | 'hi';
export type ThemeMode = 'light' | 'dark';
export type CartoonStyle = '3d' | 'pixar' | 'anime' | 'comic';
export type VoiceStyle = 'male' | 'female' | 'child' | 'narrator';
export type GeminiVoiceName = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
export type StoryGenre = 'comedy' | 'family' | 'adventure' | 'education' | 'mystery' | 'moral';
export type StoryDuration = 1 | 3 | 5 | 10;
export type VideoAspectRatio = '16:9' | '9:16';
export type VideoQuality = '720p' | '1080p';
export type StoryAct = 'beginning' | 'middle' | 'climax' | 'ending';
export type SubtitleMode = 'both' | 'hi' | 'en' | 'off';

export type ScreenId =
  | 'splash'
  | 'auth'
  | 'home'
  | 'create-character'
  | 'characters'
  | 'story-generator'
  | 'script-editor'
  | 'voice-selection'
  | 'animation-generator'
  | 'studio'
  | 'video-preview'
  | 'projects'
  | 'videos'
  | 'profile'
  | 'settings'
  | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'creator' | 'admin';
  plan: 'free' | 'pro' | 'studio';
  preferredLanguage: LanguageCode;
  theme: ThemeMode;
  charactersCount?: number;
  projectsCount?: number;
  videosCount?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CartoonCharacter {
  id: string;
  ownerId: string;
  name: string;
  style: CartoonStyle;
  voiceStyle: VoiceStyle;
  voiceName: GeminiVoiceName;
  personality?: string;
  facialTraits?: string;
  sourceImageUrl?: string;
  cartoonImageUrl: string;
  accentColor?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface StoryProject {
  id: string;
  ownerId: string;
  title: string;
  titleHindi?: string;
  moralOrSummary?: string;
  language: LanguageCode;
  genre: StoryGenre;
  durationMinutes: StoryDuration;
  aspectRatio: VideoAspectRatio;
  quality: VideoQuality;
  status: 'draft' | 'scripted' | 'voiced' | 'animated' | 'exported';
  bgmMood?: string;
  bgmAudioUrl?: string;
  musicVolume?: number;
  voiceVolume?: number;
  sceneCount?: number;
  characterIds?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface StoryScene {
  id: string;
  projectId: string;
  ownerId: string;
  orderIndex: number;
  act: StoryAct;
  title: string;
  visualPrompt?: string;
  cameraMovement?: string;
  transition?: string;
  backgroundMood?: string;
  characterName?: string;
  characterId?: string;
  speakerVoiceStyle?: VoiceStyle;
  voiceName?: GeminiVoiceName;
  dialogueHindi: string;
  dialogueEnglish: string;
  durationSec: number;
  frameImageUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
  animationStatus: 'pending' | 'ready' | 'ai_video' | 'error';
  updatedAt?: unknown;
}

export interface ExportedVideo {
  id: string;
  ownerId: string;
  projectId: string;
  title: string;
  language?: LanguageCode;
  aspectRatio: VideoAspectRatio;
  quality: VideoQuality;
  durationSec: number;
  fileSizeBytes?: number;
  format?: string;
  downloadUrl: string;
  thumbnailUrl?: string;
  createdAt?: unknown;
}

export interface UsageLog {
  id: string;
  ownerId: string;
  userEmail?: string;
  feature: 'character' | 'story' | 'tts' | 'animation' | 'music' | 'export';
  model: string;
  status: 'success' | 'error';
  durationMs: number;
  errorMessage?: string;
  createdAt?: unknown;
}

export interface FeaturedTemplate {
  id: string;
  title: string;
  genre: StoryGenre;
  language: LanguageCode;
  prompt: string;
  active: boolean;
  updatedAt?: unknown;
}
