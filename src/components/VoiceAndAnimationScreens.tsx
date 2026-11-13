import { useState } from 'react';
import {
  ArrowRight,
  Clapperboard,
  Film,
  Loader2,
  Mic,
  Play,
  RefreshCw,
  Sparkles,
  Volume2,
} from 'lucide-react';
import type {
  CartoonCharacter,
  GeminiVoiceName,
  LanguageCode,
  ScreenId,
  StoryProject,
  StoryScene,
  VoiceStyle,
} from '../types/studio';
import { t } from '../i18n/translations';
import {
  generateOmniVideoClip,
  generateSceneKeyframe,
  generateSceneTts,
} from '../lib/aiClient';
import { saveSceneDoc, updateProjectDoc } from '../lib/firestoreService';
import { SafeImage } from './SafeImage';

const VOICE_STYLES: VoiceStyle[] = ['male', 'female', 'child', 'narrator'];
const VOICE_NAMES: GeminiVoiceName[] = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];

export function VoiceSelectionScreen({
  uid,
  userEmail,
  language,
  project,
  scenes,
  onNavigate,
}: {
  uid: string;
  userEmail?: string;
  language: LanguageCode;
  project: StoryProject | null;
  scenes: StoryScene[];
  onNavigate: (screen: ScreenId) => void;
}) {
  const [voiceLang, setVoiceLang] = useState<LanguageCode>(project?.language || 'hi');
  const [busySceneId, setBusySceneId] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!project) {
    return (
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-10 text-center">
        <Mic className="w-8 h-8 mx-auto text-stone-400 mb-3" />
        <p className="text-sm text-stone-600 dark:text-stone-400">
          Open a project first to generate Hindi & English character voiceovers.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('projects')}
          className="mt-4 min-h-[44px] px-5 py-2 bg-orange-600 text-white text-xs font-semibold rounded-xl"
        >
          Browse My Projects
        </button>
      </div>
    );
  }

  async function synthesizeOne(scene: StoryScene) {
    setBusySceneId(scene.id);
    setErrorMsg(null);
    try {
      const spokenText = voiceLang === 'hi' ? scene.dialogueHindi : scene.dialogueEnglish;
      const res = await generateSceneTts(uid, userEmail, {
        text: spokenText,
        language: voiceLang,
        voiceStyle: scene.speakerVoiceStyle || 'narrator',
        voiceName: scene.voiceName || 'Kore',
      });
      await saveSceneDoc(project!.id, {
        ...scene,
        audioUrl: res.audioUrl,
        durationSec: Math.max(scene.durationSec, Math.ceil(res.durationSec + 0.8)),
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'TTS generation failed.');
    } finally {
      setBusySceneId(null);
    }
  }

  async function handleGenerateAll() {
    setErrorMsg(null);
    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i];
      setBatchProgress(`Synthesizing voice ${i + 1} of ${scenes.length} (${s.characterName || 'Speaker'})...`);
      await synthesizeOne(s);
    }
    await updateProjectDoc(project!.id, { status: 'voiced' });
    setBatchProgress(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-stone-950 dark:text-white">
            {t(language, 'voiceSelectionTitle')}
          </h1>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            Generate natural Hindi & English voiceovers with distinct Male, Female, Child, and Narrator styles.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex p-1 bg-stone-200/70 dark:bg-stone-900 rounded-xl">
            {(['hi', 'en'] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setVoiceLang(code)}
                className={`min-h-[36px] px-3 text-xs font-semibold rounded-lg ${
                  voiceLang === code
                    ? 'bg-white dark:bg-stone-800 text-stone-950 dark:text-white shadow-sm'
                    : 'text-stone-500'
                }`}
              >
                {code === 'hi' ? 'Hindi Audio' : 'English Audio'}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={Boolean(batchProgress)}
            onClick={handleGenerateAll}
            className="min-h-[42px] px-4 py-2 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-950 rounded-xl text-xs font-semibold flex items-center gap-2 disabled:opacity-60"
          >
            {batchProgress ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
            <span>Generate All Voices</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('animation-generator')}
            className="min-h-[42px] px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
          >
            <span>Next: Animation</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {batchProgress && (
        <div className="p-3.5 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 text-xs font-medium text-orange-800 dark:text-orange-200 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>{batchProgress}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
          {errorMsg}
        </div>
      )}

      <div className="space-y-3">
        {scenes.map((scene, idx) => (
          <div
            key={scene.id}
            className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
          >
            <div className="space-y-1.5 flex-1 min-w-0">
              <p className="text-xs text-stone-500">
                Scene {idx + 1} · {scene.characterName || 'Speaker'} · {scene.act}
              </p>
              <p className="text-sm font-semibold text-stone-950 dark:text-white">
                {voiceLang === 'hi' ? scene.dialogueHindi : scene.dialogueEnglish}
              </p>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {voiceLang === 'hi' ? scene.dialogueEnglish : scene.dialogueHindi}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <select
                value={scene.speakerVoiceStyle || 'narrator'}
                onChange={(e) =>
                  saveSceneDoc(project.id, {
                    ...scene,
                    speakerVoiceStyle: e.target.value as VoiceStyle,
                  })
                }
                className="min-h-[40px] px-2.5 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg text-xs font-medium"
              >
                {VOICE_STYLES.map((vs) => (
                  <option key={vs} value={vs}>
                    {vs}
                  </option>
                ))}
              </select>

              <select
                value={scene.voiceName || 'Kore'}
                onChange={(e) =>
                  saveSceneDoc(project.id, {
                    ...scene,
                    voiceName: e.target.value as GeminiVoiceName,
                  })
                }
                className="min-h-[40px] px-2.5 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg text-xs font-medium"
              >
                {VOICE_NAMES.map((vn) => (
                  <option key={vn} value={vn}>
                    {vn}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={busySceneId === scene.id}
                onClick={() => synthesizeOne(scene)}
                className="min-h-[40px] px-3.5 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
              >
                {busySceneId === scene.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Mic className="w-3.5 h-3.5" />
                )}
                <span>{scene.audioUrl ? 'Regenerate Voice' : 'Generate Voice'}</span>
              </button>

              {scene.audioUrl && (
                <audio controls src={scene.audioUrl} className="h-9 max-w-[210px]" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnimationGeneratorScreen({
  uid,
  userEmail,
  language,
  project,
  scenes,
  characters,
  onNavigate,
}: {
  uid: string;
  userEmail?: string;
  language: LanguageCode;
  project: StoryProject | null;
  scenes: StoryScene[];
  characters: CartoonCharacter[];
  onNavigate: (screen: ScreenId) => void;
}) {
  const [busySceneId, setBusySceneId] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!project) {
    return (
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-10 text-center">
        <Clapperboard className="w-8 h-8 mx-auto text-stone-400 mb-3" />
        <p className="text-sm text-stone-600 dark:text-stone-400">
          Select a project to animate its scenes.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('projects')}
          className="mt-4 min-h-[44px] px-5 py-2 bg-orange-600 text-white text-xs font-semibold rounded-xl"
        >
          My Projects
        </button>
      </div>
    );
  }

  async function handleStudioLipSyncAll() {
    setErrorMsg(null);
    setStatusNote('Configuring Canvas2D lip-sync, eye-blinking, and camera choreography across all scenes...');
    for (const s of scenes) {
      await saveSceneDoc(project!.id, {
        ...s,
        animationStatus: s.videoUrl ? 'ai_video' : 'ready',
      });
    }
    await updateProjectDoc(project!.id, { status: 'animated' });
    setStatusNote('All scenes are animated and synchronized in the Studio Renderer.');
  }

  async function handleGenerateAiFrame(scene: StoryScene) {
    setBusySceneId(scene.id);
    setErrorMsg(null);
    setStatusNote(`Generating AI keyframe backdrop for "${scene.title}"...`);
    try {
      const char = characters.find((c) => c.id === scene.characterId || c.name === scene.characterName);
      const res = await generateSceneKeyframe(uid, userEmail, {
        visualPrompt: scene.visualPrompt || scene.title,
        characterStyle: char?.style || '3d',
        characterTraits: char?.facialTraits,
        aspectRatio: project!.aspectRatio,
        characterImageUrl: char?.cartoonImageUrl,
      });
      await saveSceneDoc(project!.id, {
        ...scene,
        frameImageUrl: res.frameImageUrl,
        animationStatus: 'ready',
      });
      setStatusNote(`AI keyframe saved for "${scene.title}".`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'AI keyframe generation failed.');
    } finally {
      setBusySceneId(null);
    }
  }

  async function handleGenerateOmniVideo(scene: StoryScene) {
    setBusySceneId(scene.id);
    setErrorMsg(null);
    setStatusNote(`Calling Omni Flash AI Video Engine for "${scene.title}" (this may take 1-2 minutes)...`);
    try {
      const char = characters.find((c) => c.id === scene.characterId || c.name === scene.characterName);
      const res = await generateOmniVideoClip(uid, userEmail, {
        visualPrompt: scene.visualPrompt || scene.title,
        dialogue: project!.language === 'hi' ? scene.dialogueHindi : scene.dialogueEnglish,
        aspectRatio: project!.aspectRatio,
        durationSec: scene.durationSec,
        frameImageUrl: scene.frameImageUrl,
        characterImageUrl: char?.cartoonImageUrl,
      });
      await saveSceneDoc(project!.id, {
        ...scene,
        videoUrl: res.videoUrl,
        animationStatus: 'ai_video',
      });
      await updateProjectDoc(project!.id, { status: 'animated' });
      setStatusNote(`Omni Flash AI video clip generated for "${scene.title}".`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'AI video clip generation failed.');
    } finally {
      setBusySceneId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-stone-950 dark:text-white">
            {t(language, 'animationGeneratorTitle')}
          </h1>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            Prepare Studio Lip-Sync Animation across all scenes, or render AI Video Clips with Omni Flash.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleStudioLipSyncAll}
            className="min-h-[42px] px-4 py-2 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-950 rounded-xl text-xs font-semibold flex items-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Prepare Studio Lip-Sync All</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('studio')}
            className="min-h-[42px] px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
          >
            <Film className="w-4 h-4" />
            <span>Open Video Studio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {statusNote && (
        <div className="p-3.5 rounded-xl bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs text-stone-800 dark:text-stone-200">
          {statusNote}
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
          {errorMsg}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {scenes.map((scene, idx) => {
          const char = characters.find((c) => c.id === scene.characterId || c.name === scene.characterName);
          const isBusy = busySceneId === scene.id;
          return (
            <div
              key={scene.id}
              className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-stone-500">
                    Scene {idx + 1} · {scene.cameraMovement || 'zoom-in'} · {scene.transition || 'fade'} · {scene.animationStatus}
                  </p>
                  <h3 className="text-base font-display font-bold text-stone-950 dark:text-white truncate">
                    {scene.title}
                  </h3>
                </div>
                {char && (
                  <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-stone-200 dark:border-stone-800">
                    <SafeImage src={char.cartoonImageUrl} alt={char.name} className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              {scene.videoUrl ? (
                <video controls src={scene.videoUrl} className="w-full rounded-xl bg-black aspect-video" />
              ) : scene.frameImageUrl ? (
                <div className="aspect-video rounded-xl overflow-hidden border border-stone-200 dark:border-stone-800">
                  <SafeImage src={scene.frameImageUrl} alt={scene.title} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 text-xs text-stone-600 dark:text-stone-400">
                  {scene.visualPrompt || 'Procedural cartoon backdrop + animated character lip-sync ready.'}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleGenerateAiFrame(scene)}
                  className="min-h-[40px] px-3 py-1.5 border border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>AI Backdrop</span>
                </button>

                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleGenerateOmniVideo(scene)}
                  className="min-h-[40px] px-3 py-1.5 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-950 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  <span>Omni Flash Video Clip</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
