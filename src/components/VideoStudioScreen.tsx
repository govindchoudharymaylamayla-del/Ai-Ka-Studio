import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  Film,
  Loader2,
  Mic,
  Music,
  Pause,
  Play,
  RefreshCw,
  Share2,
  Sparkles,
  Square,
  Volume2,
} from 'lucide-react';
import type {
  CartoonCharacter,
  ExportedVideo,
  LanguageCode,
  ScreenId,
  StoryProject,
  StoryScene,
  SubtitleMode,
  VideoAspectRatio,
  VideoQuality,
} from '../types/studio';
import { t } from '../i18n/translations';
import {
  generateLyriaMusic,
  generateSceneTts,
  uploadMediaBlob,
} from '../lib/aiClient';
import {
  createVideoDoc,
  logUsage,
  saveSceneDoc,
  updateProjectDoc,
} from '../lib/firestoreService';
import {
  drawAnimatedSceneFrame,
  exportProjectVideoWebM,
  loadHtmlImage,
  StudioAudioEngine,
} from '../lib/toonRenderer';

export function VideoStudioScreen({
  uid,
  userEmail,
  language,
  project,
  scenes,
  characters,
  onNavigate,
  onVideoExported,
}: {
  uid: string;
  userEmail?: string;
  language: LanguageCode;
  project: StoryProject | null;
  scenes: StoryScene[];
  characters: CartoonCharacter[];
  onNavigate: (screen: ScreenId) => void;
  onVideoExported: (video: ExportedVideo) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [subtitleMode, setSubtitleMode] = useState<SubtitleMode>('both');
  const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>(project?.aspectRatio || '16:9');
  const [quality, setQuality] = useState<VideoQuality>(project?.quality || '720p');
  const [bgmMood, setBgmMood] = useState<string>(project?.bgmMood || 'family');
  const [musicVolume, setMusicVolume] = useState<number>(project?.musicVolume ?? 0.25);
  const [voiceVolume, setVoiceVolume] = useState<number>(project?.voiceVolume ?? 1.0);

  const [editHi, setEditHi] = useState('');
  const [editEn, setEditEn] = useState('');
  const [editDur, setEditDur] = useState(8);

  const [busyMsg, setBusyMsg] = useState<string | null>(null);
  const [exportPct, setExportPct] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioEngineRef = useRef<StudioAudioEngine | null>(null);
  const playbackAbortRef = useRef(false);

  const activeScene = scenes[activeIndex] || scenes[0] || null;

  useEffect(() => {
    if (project) {
      setAspectRatio(project.aspectRatio);
      setQuality(project.quality);
      setMusicVolume(project.musicVolume ?? 0.25);
      setVoiceVolume(project.voiceVolume ?? 1.0);
    }
  }, [project?.id]);

  useEffect(() => {
    if (activeScene) {
      setEditHi(activeScene.dialogueHindi);
      setEditEn(activeScene.dialogueEnglish);
      setEditDur(activeScene.durationSec);
    }
  }, [activeScene?.id]);

  // Render static or idle preview frame when paused
  useEffect(() => {
    if (isPlaying || !activeScene || !canvasRef.current) return;
    let cancelled = false;
    (async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const char = characters.find(
        (c) => c.id === activeScene.characterId || c.name === activeScene.characterName
      );
      const [charImg, frameImg] = await Promise.all([
        char ? loadHtmlImage(char.cartoonImageUrl) : Promise.resolve(null),
        activeScene.frameImageUrl ? loadHtmlImage(activeScene.frameImageUrl) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      drawAnimatedSceneFrame({
        ctx,
        width: canvas.width,
        height: canvas.height,
        scene: activeScene,
        character: char,
        charImg,
        frameImg,
        elapsedInScene: 1.2,
        audioAmplitude: 0,
        subtitleMode,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [isPlaying, activeScene, characters, subtitleMode, aspectRatio]);

  useEffect(() => {
    return () => {
      playbackAbortRef.current = true;
      audioEngineRef.current?.stopProceduralBgm();
    };
  }, []);

  if (!project || scenes.length === 0) {
    return (
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-10 text-center">
        <Film className="w-8 h-8 mx-auto text-stone-400 mb-3" />
        <p className="text-sm text-stone-600 dark:text-stone-400">
          Open a project with scenes to launch the Video Editing Studio.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('story-generator')}
          className="mt-4 min-h-[44px] px-5 py-2 bg-orange-600 text-white text-xs font-semibold rounded-xl"
        >
          Generate a Story
        </button>
      </div>
    );
  }

  function stopPlayback() {
    playbackAbortRef.current = true;
    setIsPlaying(false);
    audioEngineRef.current?.stopProceduralBgm();
  }

  async function playStoryPreview(startIdx = activeIndex) {
    if (isPlaying) {
      stopPlayback();
      return;
    }

    setIsPlaying(true);
    playbackAbortRef.current = false;
    setErrorMsg(null);

    if (!audioEngineRef.current) {
      audioEngineRef.current = new StudioAudioEngine();
    }

    let bgmAudioEl: HTMLAudioElement | null = null;
    if (project?.bgmAudioUrl) {
      bgmAudioEl = new Audio(project.bgmAudioUrl);
      bgmAudioEl.loop = true;
      bgmAudioEl.volume = musicVolume;
      void bgmAudioEl.play().catch(() => {});
    } else if (musicVolume > 0.02) {
      audioEngineRef.current.startProceduralBgm(bgmMood, musicVolume * 0.6);
    }

    for (let i = startIdx; i < scenes.length; i++) {
      if (playbackAbortRef.current) break;
      setActiveIndex(i);
      const s = scenes[i];
      const char = characters.find((c) => c.id === s.characterId || c.name === s.characterName);
      const [charImg, frameImg] = await Promise.all([
        char ? loadHtmlImage(char.cartoonImageUrl) : Promise.resolve(null),
        s.frameImageUrl ? loadHtmlImage(s.frameImageUrl) : Promise.resolve(null),
      ]);

      let sceneAudio: HTMLAudioElement | null = null;
      if (s.audioUrl) {
        sceneAudio = new Audio(s.audioUrl);
        sceneAudio.volume = voiceVolume;
        void sceneAudio.play().catch(() => {});
      }

      const dur = Math.max(2, s.durationSec);
      const started = performance.now();

      await new Promise<void>((resolve) => {
        const step = () => {
          if (playbackAbortRef.current) {
            sceneAudio?.pause();
            resolve();
            return;
          }
          const elapsed = (performance.now() - started) / 1000;
          if (elapsed >= dur) {
            sceneAudio?.pause();
            resolve();
            return;
          }
          if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
              const amp = sceneAudio && !sceneAudio.paused ? Math.abs(Math.sin(elapsed * 12)) * 0.65 + 0.15 : 0.15;
              drawAnimatedSceneFrame({
                ctx,
                width: canvasRef.current.width,
                height: canvasRef.current.height,
                scene: s,
                character: char,
                charImg,
                frameImg,
                elapsedInScene: elapsed,
                audioAmplitude: amp,
                subtitleMode,
              });
            }
          }
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }

    bgmAudioEl?.pause();
    audioEngineRef.current?.stopProceduralBgm();
    setIsPlaying(false);
  }

  async function handleSaveInlineDialogue(regenVoice: boolean) {
    if (!activeScene || !project) return;
    setBusyMsg(regenVoice ? 'Saving & regenerating voiceover...' : 'Saving scene edits...');
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      let nextAudioUrl = activeScene.audioUrl;
      let nextDuration = editDur;
      if (regenVoice) {
        const txt = project.language === 'hi' ? editHi : editEn;
        const tts = await generateSceneTts(uid, userEmail, {
          text: txt,
          language: project.language,
          voiceStyle: activeScene.speakerVoiceStyle || 'narrator',
          voiceName: activeScene.voiceName || 'Kore',
        });
        nextAudioUrl = tts.audioUrl;
        nextDuration = Math.max(editDur, Math.ceil(tts.durationSec + 0.8));
      }
      await saveSceneDoc(project.id, {
        ...activeScene,
        dialogueHindi: editHi,
        dialogueEnglish: editEn,
        durationSec: nextDuration,
        ...(nextAudioUrl ? { audioUrl: nextAudioUrl } : {}),
      });
      setInfoMsg(regenVoice ? 'Dialogue & Hindi/English voiceover updated.' : 'Scene dialogue updated.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update scene.');
    } finally {
      setBusyMsg(null);
    }
  }

  async function handleSwapScene(dir: -1 | 1) {
    if (!project) return;
    const targetIdx = activeIndex + dir;
    if (targetIdx < 0 || targetIdx >= scenes.length) return;
    const a = scenes[activeIndex];
    const b = scenes[targetIdx];
    await Promise.all([
      saveSceneDoc(project.id, { ...a, orderIndex: targetIdx }),
      saveSceneDoc(project.id, { ...b, orderIndex: activeIndex }),
    ]);
    setActiveIndex(targetIdx);
  }

  async function handleGenerateAiMusic() {
    if (!project) return;
    setBusyMsg('Composing background music with Lyria...');
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      const res = await generateLyriaMusic(uid, userEmail, {
        mood: bgmMood,
        genre: project.genre,
      });
      await updateProjectDoc(project.id, { bgmAudioUrl: res.bgmAudioUrl, bgmMood });
      setInfoMsg('AI soundtrack generated with Lyria and attached to project.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Music generation failed.');
    } finally {
      setBusyMsg(null);
    }
  }

  async function handleExportRealVideo() {
    if (!project) return;
    stopPlayback();
    setErrorMsg(null);
    setInfoMsg(null);
    setExportPct(1);
    setBusyMsg('Starting real WebM video render...');

    const started = Date.now();
    try {
      const rendered = await exportProjectVideoWebM({
        project,
        scenes,
        characters,
        quality,
        aspectRatio,
        subtitleMode,
        musicVolume,
        voiceVolume,
        onProgress: (pct, label) => {
          setExportPct(pct);
          setBusyMsg(label);
        },
      });

      setBusyMsg('Uploading rendered video to studio storage...');
      const uploaded = await uploadMediaBlob(rendered.blob, 'story_export');

      const thumbChar = characters.find((c) => project.characterIds?.includes(c.id)) || characters[0];
      const videoDoc = await createVideoDoc(uid, {
        projectId: project.id,
        title: project.title,
        language: project.language,
        aspectRatio,
        quality,
        durationSec: rendered.durationSec,
        fileSizeBytes: uploaded.fileSizeBytes,
        format: 'webm',
        downloadUrl: uploaded.url,
        thumbnailUrl: scenes[0]?.frameImageUrl || thumbChar?.cartoonImageUrl,
      });

      await updateProjectDoc(project.id, {
        aspectRatio,
        quality,
        musicVolume,
        voiceVolume,
        status: 'exported',
      });

      await logUsage(uid, userEmail, {
        feature: 'export',
        model: `studio-webm-${quality}`,
        status: 'success',
        durationMs: Date.now() - started,
      });

      setExportPct(null);
      setBusyMsg(null);
      onVideoExported(videoDoc);
      onNavigate('video-preview');
    } catch (err) {
      setExportPct(null);
      setBusyMsg(null);
      setErrorMsg(err instanceof Error ? err.message : 'Video export failed.');
    }
  }

  function triggerSfx(type: 'chime' | 'whoosh' | 'sparkle' | 'chuckle') {
    if (!audioEngineRef.current) audioEngineRef.current = new StudioAudioEngine();
    audioEngineRef.current.playSfx(type);
  }

  const canvasW = aspectRatio === '16:9' ? 960 : 540;
  const canvasH = aspectRatio === '16:9' ? 540 : 960;

  return (
    <div className="space-y-6">
      {/* Studio Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs text-stone-500">
            {project.title} · {scenes.length} scenes
          </p>
          <h1 className="text-2xl font-display font-bold text-stone-950 dark:text-white">
            {t(language, 'videoStudioTitle')}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value as VideoAspectRatio)}
            className="min-h-[40px] px-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl text-xs font-semibold"
          >
            <option value="16:9">16:9 Horizontal</option>
            <option value="9:16">9:16 Vertical</option>
          </select>

          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value as VideoQuality)}
            className="min-h-[40px] px-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl text-xs font-semibold"
          >
            <option value="720p">720p HD</option>
            <option value="1080p">1080p Full HD</option>
          </select>

          <button
            type="button"
            disabled={exportPct !== null}
            onClick={handleExportRealVideo}
            className="min-h-[42px] px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white rounded-xl text-xs font-semibold flex items-center gap-2"
          >
            {exportPct !== null ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>{t(language, 'exportVideo')}</span>
          </button>
        </div>
      </div>

      {exportPct !== null && (
        <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-orange-800 dark:text-orange-200">
            <span>{busyMsg || 'Exporting video...'}</span>
            <span className="font-mono-tabular">{exportPct}%</span>
          </div>
          <div className="h-2 bg-orange-200 dark:bg-orange-950 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-600 transition-all duration-200"
              style={{ width: `${exportPct}%` }}
            />
          </div>
        </div>
      )}

      {busyMsg && exportPct === null && (
        <div className="p-3 rounded-xl bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
          <span>{busyMsg}</span>
        </div>
      )}
      {infoMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300">
          {infoMsg}
        </div>
      )}
      {errorMsg && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
          {errorMsg}
        </div>
      )}

      {/* Main Studio Stage + Inspector */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Canvas Stage */}
        <div className="lg:col-span-7 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-center bg-stone-950 rounded-xl overflow-hidden">
            <canvas
              ref={canvasRef}
              width={canvasW}
              height={canvasH}
              className={`max-h-[440px] w-auto object-contain ${aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-video w-full'}`}
            />
          </div>

          {/* Playback & Subtitle Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => playStoryPreview(activeIndex)}
                className="min-h-[42px] px-4 py-2 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-950 rounded-xl text-xs font-semibold flex items-center gap-2"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isPlaying ? 'Pause' : 'Play from Scene'}</span>
              </button>
              {isPlaying && (
                <button
                  type="button"
                  onClick={stopPlayback}
                  className="min-h-[42px] px-3 py-2 border border-stone-200 dark:border-stone-800 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>Stop</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-stone-950 rounded-lg">
              {(['both', 'hi', 'en', 'off'] as const).map((sm) => (
                <button
                  key={sm}
                  type="button"
                  onClick={() => setSubtitleMode(sm)}
                  className={`min-h-[34px] px-2.5 text-xs font-semibold rounded-md ${
                    subtitleMode === sm
                      ? 'bg-white dark:bg-stone-800 text-stone-950 dark:text-white shadow-sm'
                      : 'text-stone-500'
                  }`}
                >
                  {sm === 'both' ? 'HI + EN' : sm.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Scene Timeline Strip */}
          <div className="pt-3 border-t border-stone-100 dark:border-stone-800">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                Scene Timeline (Click to Preview · Reorder)
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={activeIndex === 0}
                  onClick={() => handleSwapScene(-1)}
                  className="min-h-[32px] px-2 border border-stone-200 dark:border-stone-800 rounded-lg text-xs disabled:opacity-30 flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Left</span>
                </button>
                <button
                  type="button"
                  disabled={activeIndex >= scenes.length - 1}
                  onClick={() => handleSwapScene(1)}
                  className="min-h-[32px] px-2 border border-stone-200 dark:border-stone-800 rounded-lg text-xs disabled:opacity-30 flex items-center gap-1"
                >
                  <span>Right</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {scenes.map((s, idx) => {
                const selected = idx === activeIndex;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      stopPlayback();
                      setActiveIndex(idx);
                    }}
                    className={`min-w-[130px] p-2.5 rounded-xl border text-left shrink-0 transition-colors ${
                      selected
                        ? 'border-orange-600 bg-orange-50/70 dark:bg-orange-950/30'
                        : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-950'
                    }`}
                  >
                    <p className="text-[11px] font-mono-tabular text-stone-500">
                      S{idx + 1} · {s.durationSec}s
                    </p>
                    <p className="text-xs font-semibold truncate text-stone-900 dark:text-white">
                      {s.title}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Inspector: Dialogue Editor + Audio Mixer + SFX */}
        <div className="lg:col-span-5 space-y-5">
          {activeScene && (
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-display font-bold text-stone-950 dark:text-white">
                  Scene {activeIndex + 1}: {activeScene.title}
                </h2>
                <button
                  type="button"
                  onClick={() => onNavigate('animation-generator')}
                  className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Regenerate Scene</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                  Hindi Dialogue (हिन्दी)
                </label>
                <textarea
                  rows={2}
                  value={editHi}
                  onChange={(e) => setEditHi(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                  English Subtitle
                </label>
                <textarea
                  rows={2}
                  value={editEn}
                  onChange={(e) => setEditEn(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl text-sm"
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="w-28">
                  <label className="block text-[11px] text-stone-500 mb-1">Duration (sec)</label>
                  <input
                    type="number"
                    min={2}
                    max={60}
                    value={editDur}
                    onChange={(e) => setEditDur(Number(e.target.value) || 8)}
                    className="w-full min-h-[38px] px-2.5 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg text-xs font-mono-tabular"
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => handleSaveInlineDialogue(false)}
                    className="min-h-[38px] px-3 py-1.5 border border-stone-200 dark:border-stone-700 rounded-lg text-xs font-semibold flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveInlineDialogue(true)}
                    className="min-h-[38px] px-3 py-1.5 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-950 rounded-lg text-xs font-semibold flex items-center gap-1"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>Save + Re-Voice</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Music & Sound Effects Mixer */}
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-display font-bold text-stone-950 dark:text-white flex items-center gap-2">
                <Music className="w-4 h-4 text-orange-600" />
                <span>Background Music & Sound Effects</span>
              </h2>
            </div>

            <div className="flex gap-2">
              <select
                value={bgmMood}
                onChange={(e) => setBgmMood(e.target.value)}
                className="flex-1 min-h-[40px] px-3 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl text-xs font-medium"
              >
                <option value="family">Warm Family Acoustic</option>
                <option value="comedy">Playful Comedy Marimba</option>
                <option value="adventure">Epic Adventure Percussive</option>
                <option value="mystery">Suspense Mystery Strings</option>
              </select>
              <button
                type="button"
                onClick={handleGenerateAiMusic}
                className="min-h-[40px] px-3 py-1.5 border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl text-xs font-semibold flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Lyria AI BGM</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-xs text-stone-600 dark:text-stone-400 mb-1">
                  <span>Voice Volume</span>
                  <span className="font-mono-tabular">{Math.round(voiceVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={voiceVolume}
                  onChange={(e) => setVoiceVolume(Number(e.target.value))}
                  className="w-full accent-orange-600"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-stone-600 dark:text-stone-400 mb-1">
                  <span>Music Volume</span>
                  <span className="font-mono-tabular">{Math.round(musicVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={musicVolume}
                  onChange={(e) => setMusicVolume(Number(e.target.value))}
                  className="w-full accent-orange-600"
                />
              </div>
            </div>

            <div>
              <p className="text-xs text-stone-500 mb-2">Cartoon SFX Palette</p>
              <div className="grid grid-cols-4 gap-2">
                {(['chime', 'sparkle', 'chuckle', 'whoosh'] as const).map((sfx) => (
                  <button
                    key={sfx}
                    type="button"
                    onClick={() => triggerSfx(sfx)}
                    className="min-h-[38px] px-2 py-1.5 border border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg text-xs font-medium capitalize flex items-center justify-center gap-1"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>{sfx}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VideoPreviewScreen({
  language,
  video,
  onNavigate,
}: {
  language: LanguageCode;
  video: ExportedVideo | null;
  onNavigate: (screen: ScreenId) => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!video) {
    return (
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-10 text-center">
        <Film className="w-8 h-8 mx-auto text-stone-400 mb-3" />
        <p className="text-sm text-stone-600 dark:text-stone-400">
          No video selected. Export a story from Video Editing Studio or pick one from Downloaded Videos.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('videos')}
          className="mt-4 min-h-[44px] px-5 py-2 bg-orange-600 text-white text-xs font-semibold rounded-xl"
        >
          Open Downloaded Videos
        </button>
      </div>
    );
  }

  async function handleCopyLink() {
    const fullUrl = `${window.location.origin}${video!.downloadUrl}`;
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  const sizeMb = video.fileSizeBytes ? (video.fileSizeBytes / (1024 * 1024)).toFixed(2) : null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs text-stone-500">
            {video.aspectRatio} · {video.quality} · {video.durationSec}s{sizeMb ? ` · ${sizeMb} MB` : ''}
          </p>
          <h1 className="text-2xl font-display font-bold text-stone-950 dark:text-white">
            {video.title}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            className="min-h-[42px] px-4 py-2 border border-stone-200 dark:border-stone-800 rounded-xl text-xs font-semibold flex items-center gap-1.5"
          >
            <Share2 className="w-4 h-4" />
            <span>{copied ? 'Link Copied' : 'Copy Link'}</span>
          </button>

          <a
            href={video.downloadUrl}
            download={`${video.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.webm`}
            className="min-h-[42px] px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            <span>{t(language, 'download')}</span>
          </a>
        </div>
      </div>

      <div className="bg-black rounded-2xl overflow-hidden border border-stone-800 flex justify-center">
        <video
          controls
          autoPlay
          playsInline
          src={video.downloadUrl}
          className={`max-h-[70vh] ${video.aspectRatio === '9:16' ? 'aspect-[9/16]' : 'w-full aspect-video'}`}
        />
      </div>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => onNavigate('studio')}
          className="min-h-[42px] px-4 py-2 border border-stone-200 dark:border-stone-800 rounded-xl text-xs font-semibold"
        >
          Back to Video Studio
        </button>
        <button
          type="button"
          onClick={() => onNavigate('videos')}
          className="min-h-[42px] px-4 py-2 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-950 rounded-xl text-xs font-semibold"
        >
          All Downloaded Videos
        </button>
      </div>
    </div>
  );
}
