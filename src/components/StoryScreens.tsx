import { useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  Loader2,
  Mic,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type {
  CartoonCharacter,
  LanguageCode,
  ScreenId,
  StoryAct,
  StoryDuration,
  StoryGenre,
  StoryProject,
  StoryScene,
  VideoAspectRatio,
  VideoQuality,
} from '../types/studio';
import { t } from '../i18n/translations';
import { generateAiStory } from '../lib/aiClient';
import {
  createProjectWithScenes,
  deleteSceneDoc,
  makeSafeId,
  saveSceneDoc,
  updateProjectDoc,
} from '../lib/firestoreService';
import { SafeImage } from './SafeImage';

const GENRES: Array<{ id: StoryGenre; label: string }> = [
  { id: 'comedy', label: 'Comedy' },
  { id: 'family', label: 'Family' },
  { id: 'adventure', label: 'Adventure' },
  { id: 'education', label: 'Education' },
  { id: 'mystery', label: 'Mystery' },
  { id: 'moral', label: 'Moral Story' },
];

const DURATIONS: StoryDuration[] = [1, 3, 5, 10];

export function StoryGeneratorScreen({
  uid,
  userEmail,
  language,
  characters,
  initialPrompt,
  initialGenre,
  initialCharIds,
  defaultAspectRatio,
  defaultQuality,
  onProjectCreated,
  onNavigate,
}: {
  uid: string;
  userEmail?: string;
  language: LanguageCode;
  characters: CartoonCharacter[];
  initialPrompt?: string;
  initialGenre?: StoryGenre;
  initialCharIds?: string[];
  defaultAspectRatio: VideoAspectRatio;
  defaultQuality: VideoQuality;
  onProjectCreated: (project: StoryProject) => void;
  onNavigate: (screen: ScreenId) => void;
}) {
  const [prompt, setPrompt] = useState(
    initialPrompt ||
      'A cheerful boy and his grandfather discover a glowing kite that teaches the whole neighborhood about sharing and kindness.'
  );
  const [genre, setGenre] = useState<StoryGenre>(initialGenre || 'family');
  const [storyLang, setStoryLang] = useState<LanguageCode>('hi');
  const [durationMinutes, setDurationMinutes] = useState<StoryDuration>(3);
  const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>(defaultAspectRatio);
  const [quality, setQuality] = useState<VideoQuality>(defaultQuality);
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>(
    initialCharIds && initialCharIds.length > 0
      ? initialCharIds
      : characters.slice(0, 2).map((c) => c.id)
  );

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function toggleChar(id: string) {
    setSelectedCharIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id].slice(0, 8)
    );
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) {
      setErrorMsg('Please enter a story idea or theme.');
      return;
    }

    setBusy(true);
    setErrorMsg(null);
    try {
      const cast = characters.filter((c) => selectedCharIds.includes(c.id));
      const generated = await generateAiStory(uid, userEmail, {
        prompt: prompt.trim(),
        genre,
        language: storyLang,
        durationMinutes,
        characters: cast.map((c) => ({
          id: c.id,
          name: c.name,
          style: c.style,
          voiceStyle: c.voiceStyle,
          voiceName: c.voiceName,
          personality: c.personality,
          facialTraits: c.facialTraits,
        })),
      });

      const { project } = await createProjectWithScenes(
        uid,
        {
          title: generated.title,
          titleHindi: generated.titleHindi,
          moralOrSummary: generated.moralOrSummary,
          language: storyLang,
          genre,
          durationMinutes,
          aspectRatio,
          quality,
          status: 'scripted',
          bgmMood: generated.bgmMood,
          musicVolume: 0.25,
          voiceVolume: 1,
          characterIds: cast.map((c) => c.id),
        },
        generated.scenes
      );

      onProjectCreated(project);
      onNavigate('script-editor');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Story generation failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-stone-950 dark:text-white">
            {t(language, 'storyGeneratorTitle')}
          </h1>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            Generate complete 4-act stories with character-wise Hindi & English dialogues using Gemini AI.
          </p>
        </div>
      </div>

      <form onSubmit={handleGenerate} className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-2">
              Story Idea / Premise
            </label>
            <textarea
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your cartoon story idea..."
              className="w-full p-3.5 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl text-sm focus:outline-2 focus:outline-orange-600"
            />
          </div>

          <div>
            <p className="text-xs font-semibold text-stone-700 dark:text-stone-300 mb-2">Genre</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {GENRES.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGenre(g.id)}
                  className={`min-h-[40px] px-2.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                    genre === g.id
                      ? 'bg-orange-600 border-orange-600 text-white'
                      : 'border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs font-semibold text-stone-700 dark:text-stone-300 mb-2">
                Primary Story Language
              </p>
              <div className="flex gap-1 p-1 bg-stone-100 dark:bg-stone-950 rounded-xl">
                {(['hi', 'en'] as const).map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setStoryLang(code)}
                    className={`flex-1 min-h-[38px] text-xs font-semibold rounded-lg ${
                      storyLang === code
                        ? 'bg-white dark:bg-stone-800 text-stone-950 dark:text-white shadow-sm'
                        : 'text-stone-500'
                    }`}
                  >
                    {code === 'hi' ? 'Hindi (हिन्दी)' : 'English'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-stone-700 dark:text-stone-300 mb-2">
                Duration
              </p>
              <div className="flex gap-1 p-1 bg-stone-100 dark:bg-stone-950 rounded-xl">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDurationMinutes(d)}
                    className={`flex-1 min-h-[38px] text-xs font-semibold font-mono-tabular rounded-lg ${
                      durationMinutes === d
                        ? 'bg-white dark:bg-stone-800 text-stone-950 dark:text-white shadow-sm'
                        : 'text-stone-500'
                    }`}
                  >
                    {d}m
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-stone-700 dark:text-stone-300 mb-2">
                Format & Quality
              </p>
              <div className="flex gap-1.5">
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as VideoAspectRatio)}
                  className="flex-1 min-h-[42px] px-2.5 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl text-xs font-semibold"
                >
                  <option value="16:9">16:9 Landscape</option>
                  <option value="9:16">9:16 Vertical</option>
                </select>
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value as VideoQuality)}
                  className="w-24 min-h-[42px] px-2 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl text-xs font-semibold"
                >
                  <option value="720p">720p</option>
                  <option value="1080p">1080p</option>
                </select>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full min-h-[48px] px-5 py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{busy ? 'Writing 4-Act Script & Bilingual Dialogues...' : 'Generate Complete Cartoon Story'}</span>
          </button>
        </div>

        {/* Right: Cast Selector */}
        <div className="lg:col-span-5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-stone-900 dark:text-white">
                Cast Cartoon Characters ({selectedCharIds.length} selected)
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('create-character')}
                className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline"
              >
                + Add Character
              </button>
            </div>

            {characters.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-stone-200 dark:border-stone-800 rounded-xl">
                <p className="text-xs text-stone-500 px-4">
                  No custom characters saved yet. A default Narrator cast will be used, or create characters first.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {characters.map((c) => {
                  const active = selectedCharIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleChar(c.id)}
                      className={`w-full p-2.5 rounded-xl border flex items-center gap-3 text-left transition-colors ${
                        active
                          ? 'border-orange-600 bg-orange-50/70 dark:bg-orange-950/25'
                          : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-950'
                      }`}
                    >
                      <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0">
                        <SafeImage src={c.cartoonImageUrl} alt={c.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-stone-900 dark:text-white truncate">{c.name}</p>
                        <p className="text-[11px] text-stone-500 truncate">
                          {c.style.toUpperCase()} · {c.voiceStyle} ({c.voiceName})
                        </p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                          active
                            ? 'bg-orange-600 border-orange-600 text-white'
                            : 'border-stone-300 dark:border-stone-700'
                        }`}
                      >
                        {active && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-stone-100 dark:border-stone-800 text-xs text-stone-500 dark:text-stone-400">
            Structure: Beginning · Middle · Climax · Ending with synchronized Hindi & English subtitles.
          </div>
        </div>
      </form>
    </div>
  );
}

export function ScriptEditorScreen({
  uid,
  language,
  project,
  scenes,
  characters,
  onNavigate,
}: {
  uid: string;
  language: LanguageCode;
  project: StoryProject | null;
  scenes: StoryScene[];
  characters: CartoonCharacter[];
  onNavigate: (screen: ScreenId) => void;
}) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [localEdits, setLocalEdits] = useState<Record<string, Partial<StoryScene>>>({});
  const [notice, setNotice] = useState<string | null>(null);

  if (!project) {
    return (
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-10 text-center">
        <BookOpen className="w-8 h-8 mx-auto text-stone-400 mb-3" />
        <p className="text-sm text-stone-600 dark:text-stone-400">
          Select a project or generate a story first to edit its script.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('story-generator')}
          className="mt-4 min-h-[44px] px-5 py-2 bg-orange-600 text-white text-xs font-semibold rounded-xl"
        >
          Go to AI Story Generator
        </button>
      </div>
    );
  }

  function getMergedScene(scene: StoryScene): StoryScene {
    return { ...scene, ...(localEdits[scene.id] || {}) };
  }

  function patchLocal(sceneId: string, patch: Partial<StoryScene>) {
    setLocalEdits((prev) => ({
      ...prev,
      [sceneId]: { ...(prev[sceneId] || {}), ...patch },
    }));
  }

  async function handleSaveScene(scene: StoryScene) {
    setSavingId(scene.id);
    setNotice(null);
    const merged = getMergedScene(scene);
    await saveSceneDoc(project!.id, merged);
    setLocalEdits((prev) => {
      const next = { ...prev };
      delete next[scene.id];
      return next;
    });
    setSavingId(null);
    setNotice(`Saved "${merged.title}"`);
  }

  async function handleAddScene() {
    const newId = makeSafeId('sc');
    const newScene: StoryScene = {
      id: newId,
      projectId: project!.id,
      ownerId: uid,
      orderIndex: scenes.length,
      act: 'middle',
      title: `Scene ${scenes.length + 1}`,
      visualPrompt: 'Warm colorful animated scene with smiling character',
      cameraMovement: 'zoom-in',
      transition: 'fade',
      backgroundMood: 'sunny_village',
      characterName: characters[0]?.name || 'Narrator',
      characterId: characters[0]?.id || '',
      speakerVoiceStyle: characters[0]?.voiceStyle || 'narrator',
      voiceName: characters[0]?.voiceName || 'Charon',
      dialogueHindi: 'नई कहानी का दृश्य यहाँ से शुरू होता है।',
      dialogueEnglish: 'A new scene begins right here.',
      durationSec: 8,
      animationStatus: 'pending',
    };
    await saveSceneDoc(project!.id, newScene);
    await updateProjectDoc(project!.id, { sceneCount: scenes.length + 1 });
  }

  async function handleMoveScene(idx: number, dir: -1 | 1) {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= scenes.length) return;
    const a = getMergedScene(scenes[idx]);
    const b = getMergedScene(scenes[targetIdx]);
    await Promise.all([
      saveSceneDoc(project!.id, { ...a, orderIndex: targetIdx }),
      saveSceneDoc(project!.id, { ...b, orderIndex: idx }),
    ]);
  }

  async function handleDeleteScene(sceneId: string) {
    if (scenes.length <= 1) return;
    await deleteSceneDoc(project!.id, sceneId);
    const remaining = scenes.filter((s) => s.id !== sceneId);
    await Promise.all(
      remaining.map((s, idx) => saveSceneDoc(project!.id, { ...s, orderIndex: idx }))
    );
    await updateProjectDoc(project!.id, { sceneCount: remaining.length });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            {project.genre} · {project.durationMinutes} min · {project.aspectRatio}
          </p>
          <h1 className="text-2xl font-display font-bold text-stone-950 dark:text-white">
            {project.title} {project.titleHindi ? `· ${project.titleHindi}` : ''}
          </h1>
          {project.moralOrSummary && (
            <p className="mt-1 text-xs text-stone-600 dark:text-stone-400 max-w-2xl">
              {project.moralOrSummary}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAddScene}
            className="min-h-[42px] px-3.5 py-2 border border-stone-200 dark:border-stone-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-stone-100 dark:hover:bg-stone-900"
          >
            <Plus className="w-4 h-4" />
            <span>Add Scene</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('voice-selection')}
            className="min-h-[42px] px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5"
          >
            <Mic className="w-4 h-4" />
            <span>Next: Voice Casting</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300">
          {notice}
        </div>
      )}

      <div className="space-y-4">
        {scenes.map((rawScene, idx) => {
          const s = getMergedScene(rawScene);
          const dirty = Boolean(localEdits[rawScene.id]);
          return (
            <div
              key={rawScene.id}
              className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                  <span className="text-xs font-mono-tabular font-semibold text-stone-500">
                    #{idx + 1}
                  </span>
                  <select
                    value={s.act}
                    onChange={(e) => patchLocal(s.id, { act: e.target.value as StoryAct })}
                    className="min-h-[36px] px-2.5 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg text-xs font-semibold"
                  >
                    <option value="beginning">Beginning</option>
                    <option value="middle">Middle</option>
                    <option value="climax">Climax</option>
                    <option value="ending">Ending</option>
                  </select>
                  <input
                    type="text"
                    value={s.title}
                    onChange={(e) => patchLocal(s.id, { title: e.target.value })}
                    className="flex-1 min-h-[36px] px-3 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg text-sm font-semibold"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleMoveScene(idx, -1)}
                    aria-label="Move scene up"
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center border border-stone-200 dark:border-stone-800 rounded-lg disabled:opacity-30"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === scenes.length - 1}
                    onClick={() => handleMoveScene(idx, 1)}
                    aria-label="Move scene down"
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center border border-stone-200 dark:border-stone-800 rounded-lg disabled:opacity-30"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={scenes.length <= 1}
                    onClick={() => handleDeleteScene(s.id)}
                    aria-label="Delete scene"
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center text-stone-400 hover:text-red-600 rounded-lg disabled:opacity-30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                    Hindi Dialogue (हिन्दी संवाद)
                  </label>
                  <textarea
                    rows={2}
                    value={s.dialogueHindi}
                    onChange={(e) => patchLocal(s.id, { dialogueHindi: e.target.value })}
                    className="w-full p-3 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                    English Dialogue / Subtitle
                  </label>
                  <textarea
                    rows={2}
                    value={s.dialogueEnglish}
                    onChange={(e) => patchLocal(s.id, { dialogueEnglish: e.target.value })}
                    className="w-full p-3 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] text-stone-500 mb-1">Speaker Character</label>
                  <input
                    type="text"
                    value={s.characterName || ''}
                    onChange={(e) => patchLocal(s.id, { characterName: e.target.value })}
                    className="w-full min-h-[38px] px-2.5 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-stone-500 mb-1">Background Mood</label>
                  <select
                    value={s.backgroundMood || 'sunny_village'}
                    onChange={(e) => patchLocal(s.id, { backgroundMood: e.target.value })}
                    className="w-full min-h-[38px] px-2.5 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg text-xs"
                  >
                    <option value="sunny_village">Sunny Village</option>
                    <option value="cozy_home">Cozy Home</option>
                    <option value="enchanted_forest">Enchanted Forest</option>
                    <option value="starry_night">Starry Night</option>
                    <option value="vibrant_market">Vibrant Market</option>
                    <option value="school_courtyard">School Courtyard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-stone-500 mb-1">Camera Motion</label>
                  <select
                    value={s.cameraMovement || 'zoom-in'}
                    onChange={(e) => patchLocal(s.id, { cameraMovement: e.target.value })}
                    className="w-full min-h-[38px] px-2.5 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg text-xs"
                  >
                    <option value="zoom-in">Zoom In</option>
                    <option value="zoom-out">Zoom Out</option>
                    <option value="pan-left">Pan Left</option>
                    <option value="pan-right">Pan Right</option>
                    <option value="static">Static</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-stone-500 mb-1">Duration (sec)</label>
                  <input
                    type="number"
                    min={2}
                    max={60}
                    value={s.durationSec}
                    onChange={(e) => patchLocal(s.id, { durationSec: Number(e.target.value) || 8 })}
                    className="w-full min-h-[38px] px-2.5 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg text-xs font-mono-tabular"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <input
                  type="text"
                  value={s.visualPrompt || ''}
                  onChange={(e) => patchLocal(s.id, { visualPrompt: e.target.value })}
                  placeholder="Visual scene direction..."
                  className="flex-1 min-h-[38px] px-3 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg text-xs text-stone-600 dark:text-stone-300"
                />
                <button
                  type="button"
                  disabled={savingId === s.id}
                  onClick={() => handleSaveScene(rawScene)}
                  className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 ${
                    dirty
                      ? 'bg-orange-600 text-white'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  {savingId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{t(language, 'save')}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
