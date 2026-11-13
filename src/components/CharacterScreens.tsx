import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Loader2,
  Mic,
  Play,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import type {
  CartoonCharacter,
  CartoonStyle,
  GeminiVoiceName,
  LanguageCode,
  ScreenId,
  VoiceStyle,
} from '../types/studio';
import { t } from '../i18n/translations';
import {
  generateCharacterFromPhoto,
  generateSceneTts,
  uploadBase64DataUrl,
} from '../lib/aiClient';
import {
  createCharacterDoc,
  deleteCharacterDoc,
  updateCharacterDoc,
} from '../lib/firestoreService';
import { renderStylizedCartoonPortrait } from '../lib/toonRenderer';
import { SafeImage } from './SafeImage';

const STYLE_OPTIONS: Array<{
  id: CartoonStyle;
  label: string;
  desc: string;
  preview: string;
}> = [
  {
    id: '3d',
    label: '3D Animation',
    desc: 'Smooth volumetric 3D film look',
    preview: '/src/assets/images/style_3d_pixar_1794597395388.jpg',
  },
  {
    id: 'pixar',
    label: 'Pixar-Inspired 3D',
    desc: 'Warm expressive cinema lighting',
    preview: '/src/assets/images/style_3d_pixar_1794597395388.jpg',
  },
  {
    id: 'anime',
    label: 'Anime',
    desc: 'Crisp hand-inked cel shading',
    preview: '/src/assets/images/style_anime_showcase_1794597395757.jpg',
  },
  {
    id: 'comic',
    label: 'Comic Style',
    desc: 'Graphic novel ink & halftone',
    preview: '/src/assets/images/style_comic_showcase_1794597395292.jpg',
  },
];

const VOICE_STYLE_OPTIONS: Array<{ id: VoiceStyle; label: string; defaultVoice: GeminiVoiceName }> = [
  { id: 'male', label: 'Male', defaultVoice: 'Fenrir' },
  { id: 'female', label: 'Female', defaultVoice: 'Kore' },
  { id: 'child', label: 'Child-like', defaultVoice: 'Puck' },
  { id: 'narrator', label: 'Narrator', defaultVoice: 'Charon' },
];

const GEMINI_VOICES: GeminiVoiceName[] = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];

export function CreateCharacterScreen({
  uid,
  userEmail,
  language,
  onNavigate,
}: {
  uid: string;
  userEmail?: string;
  language: LanguageCode;
  onNavigate: (screen: ScreenId) => void;
}) {
  const [name, setName] = useState('');
  const [style, setStyle] = useState<CartoonStyle>('pixar');
  const [voiceStyle, setVoiceStyle] = useState<VoiceStyle>('child');
  const [voiceName, setVoiceName] = useState<GeminiVoiceName>('Puck');
  const [personality, setPersonality] = useState('');

  const [photoDataUrl, setPhotoDataUrl] = useState<string>('');
  const [photoMime, setPhotoMime] = useState<string>('image/jpeg');
  const [cartoonPreviewUrl, setCartoonPreviewUrl] = useState<string>('');
  const [facialTraits, setFacialTraits] = useState<string>('');
  const [accentColor, setAccentColor] = useState<string>('#EA580C');
  const [sourceMediaUrl, setSourceMediaUrl] = useState<string>('');

  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [voiceTesting, setVoiceTesting] = useState(false);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((tr) => tr.stop());
      }
    };
  }, []);

  async function openCamera() {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      setCameraOpen(true);
      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      }, 80);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? `Camera permission unavailable: ${err.message}`
          : 'Unable to access camera on this device.'
      );
    }
  }

  function closeCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  }

  function snapPhoto() {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth || 640;
    canvas.height = v.videoHeight || 640;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setPhotoDataUrl(dataUrl);
    setPhotoMime('image/jpeg');
    setCartoonPreviewUrl('');
    closeCamera();
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setPhotoMime(file.type || 'image/jpeg');
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoDataUrl(String(reader.result || ''));
      setCartoonPreviewUrl('');
    };
    reader.readAsDataURL(file);
  }

  async function handleConvert() {
    if (!photoDataUrl) {
      setErrorMsg('Upload a gallery photo or capture one with your camera first.');
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    setWarningMsg(null);
    setSuccessMsg(null);

    try {
      const result = await generateCharacterFromPhoto(uid, userEmail, {
        imageBase64: photoDataUrl,
        mimeType: photoMime,
        name: name.trim() || 'Aarav',
        style,
        personality: personality.trim(),
      });

      setSourceMediaUrl(result.sourceImageUrl);
      setFacialTraits(result.facialTraits);
      setAccentColor(result.accentColor);
      if (!personality.trim() && result.suggestedPersonality) {
        setPersonality(result.suggestedPersonality);
      }

      if (result.aiPortraitGenerated) {
        setCartoonPreviewUrl(result.cartoonImageUrl);
        setSuccessMsg('AI cartoon character portrait generated while preserving facial traits.');
      } else {
        // Real Canvas2D stylized toon portrait from the uploaded photo + upload to /api/media/upload
        const stylizedDataUrl = await renderStylizedCartoonPortrait(
          photoDataUrl,
          style,
          result.accentColor
        );
        const uploaded = await uploadBase64DataUrl(stylizedDataUrl, 'image/png', 'toon');
        setCartoonPreviewUrl(uploaded.url);
        setWarningMsg(
          result.warningMessage ||
            'Gemini AI image generation requires a billing-enabled key; a stylized Canvas2D cartoon portrait was rendered from your photo alongside Gemini facial trait extraction.'
        );
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Character conversion failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleTestVoice() {
    setVoiceTesting(true);
    setErrorMsg(null);
    try {
      const sampleLine =
        language === 'hi'
          ? `नमस्ते! मेरा नाम ${name.trim() || 'आरव'} है, और मैं एक नई कहानी के लिए तैयार हूँ।`
          : `Namaste! I am ${name.trim() || 'Aarav'}, ready for our animated adventure!`;
      const res = await generateSceneTts(uid, userEmail, {
        text: sampleLine,
        language,
        voiceStyle,
        voiceName,
      });
      const audio = new Audio(res.audioUrl);
      await audio.play();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Voice preview failed.');
    } finally {
      setVoiceTesting(false);
    }
  }

  async function handleSaveCharacter() {
    if (!name.trim()) {
      setErrorMsg('Enter a character name before saving.');
      return;
    }
    const finalImage = cartoonPreviewUrl || sourceMediaUrl;
    if (!finalImage) {
      setErrorMsg('Convert your uploaded photo into a cartoon character first.');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      await createCharacterDoc(uid, {
        name: name.trim(),
        style,
        voiceStyle,
        voiceName,
        personality: personality.trim(),
        facialTraits: facialTraits.trim(),
        sourceImageUrl: sourceMediaUrl || undefined,
        cartoonImageUrl: finalImage,
        accentColor,
      });
      onNavigate('characters');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save character.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-stone-950 dark:text-white">
            {t(language, 'charactersTitle')}
          </h1>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            Upload a real photo, preserve facial features, choose an animation style, and assign a Hindi/English voice.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('characters')}
          className="min-h-[44px] px-4 py-2 border border-stone-200 dark:border-stone-800 rounded-xl text-xs font-semibold hover:bg-stone-100 dark:hover:bg-stone-900"
        >
          View Gallery
        </button>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Left: Photo Input & Result Comparison */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-stone-900 dark:text-white mb-3">
              01. Source Photo & Cartoon Output
            </h2>

            {cameraOpen ? (
              <div className="space-y-3">
                <div className="aspect-square rounded-xl overflow-hidden bg-black">
                  <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={snapPhoto}
                    className="flex-1 min-h-[44px] bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Capture Photo</span>
                  </button>
                  <button
                    type="button"
                    onClick={closeCamera}
                    className="min-h-[44px] px-4 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-medium"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-stone-500 mb-1.5">Original Photo</p>
                  <div className="aspect-square rounded-xl overflow-hidden border border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-950 flex items-center justify-center">
                    {photoDataUrl ? (
                      <img src={photoDataUrl} alt="Source portrait" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs text-stone-400 px-3 text-center">No photo selected</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-stone-500 mb-1.5">Cartoon Character</p>
                  <div className="aspect-square rounded-xl overflow-hidden border border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-950 flex items-center justify-center">
                    {busy ? (
                      <div className="flex flex-col items-center gap-2 text-stone-500">
                        <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
                        <span className="text-xs">Converting...</span>
                      </div>
                    ) : cartoonPreviewUrl ? (
                      <SafeImage
                        src={cartoonPreviewUrl}
                        alt="Generated cartoon character"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-stone-400 px-3 text-center">Preview appears here</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <label className="min-h-[44px] px-3 py-2 border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>Gallery Upload</span>
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </label>
              <button
                type="button"
                onClick={openCamera}
                className="min-h-[44px] px-3 py-2 border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                <span>Use Camera</span>
              </button>
            </div>
          </div>

          {facialTraits && (
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5">
              <p className="text-xs font-semibold text-stone-900 dark:text-white mb-1">
                Preserved Character Facial Sheet
              </p>
              <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                {facialTraits}
              </p>
            </div>
          )}
        </div>

        {/* Right: Style, Personality & Voice Assignment */}
        <div className="lg:col-span-7 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                Character Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Aarav, Meera, Dadaji"
                className="w-full min-h-[44px] px-3.5 py-2 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl text-sm focus:outline-2 focus:outline-orange-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                Personality Trait
              </label>
              <input
                type="text"
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                placeholder="Curious, brave, funny"
                className="w-full min-h-[44px] px-3.5 py-2 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl text-sm focus:outline-2 focus:outline-orange-600"
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-stone-700 dark:text-stone-300 mb-2">
              Cartoon Animation Style
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {STYLE_OPTIONS.map((opt) => {
                const selected = style === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setStyle(opt.id)}
                    className={`p-2.5 rounded-xl border text-left transition-colors ${
                      selected
                        ? 'border-orange-600 bg-orange-50/70 dark:bg-orange-950/30'
                        : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700'
                    }`}
                  >
                    <div className="aspect-square rounded-lg overflow-hidden mb-2">
                      <SafeImage src={opt.preview} alt={opt.label} className="w-full h-full object-cover" />
                    </div>
                    <p className="text-xs font-semibold text-stone-900 dark:text-white truncate">{opt.label}</p>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 line-clamp-1">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-stone-100 dark:border-stone-800">
            <div>
              <p className="text-xs font-medium text-stone-700 dark:text-stone-300 mb-2">
                Voice Persona Style
              </p>
              <div className="grid grid-cols-2 gap-2">
                {VOICE_STYLE_OPTIONS.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      setVoiceStyle(v.id);
                      setVoiceName(v.defaultVoice);
                    }}
                    className={`min-h-[42px] px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                      voiceStyle === v.id
                        ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-950 border-transparent'
                        : 'border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-stone-700 dark:text-stone-300 mb-2">
                Gemini Voice Timbre & Preview
              </p>
              <div className="flex gap-2">
                <select
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value as GeminiVoiceName)}
                  className="flex-1 min-h-[42px] px-3 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl text-xs font-medium"
                >
                  {GEMINI_VOICES.map((vn) => (
                    <option key={vn} value={vn}>
                      {vn}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={voiceTesting}
                  onClick={handleTestVoice}
                  className="min-h-[42px] px-3.5 border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  {voiceTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Volume2 className="w-3.5 h-3.5" />}
                  <span>Sample</span>
                </button>
              </div>
            </div>
          </div>

          {warningMsg && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-200">
              {warningMsg}
            </div>
          )}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300">
              {successMsg}
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleConvert}
              className="min-h-[46px] px-5 py-2.5 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-950 hover:opacity-90 disabled:opacity-60 text-sm font-semibold rounded-xl flex items-center gap-2"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>Convert Photo to Cartoon</span>
            </button>

            <button
              type="button"
              disabled={saving || !cartoonPreviewUrl}
              onClick={handleSaveCharacter}
              className="min-h-[46px] px-5 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>Save to Character Gallery</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CharacterGalleryScreen({
  uid,
  userEmail,
  language,
  characters,
  onNavigate,
  onCastCharacterInStory,
}: {
  uid: string;
  userEmail?: string;
  language: LanguageCode;
  characters: CartoonCharacter[];
  onNavigate: (screen: ScreenId) => void;
  onCastCharacterInStory: (charId: string) => void;
}) {
  const [filterStyle, setFilterStyle] = useState<'all' | CartoonStyle>('all');
  const [search, setSearch] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filtered = characters.filter((c) => {
    const matchStyle = filterStyle === 'all' || c.style === filterStyle;
    const matchSearch =
      !search.trim() ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.personality || '').toLowerCase().includes(search.toLowerCase());
    return matchStyle && matchSearch;
  });

  async function handlePlaySample(char: CartoonCharacter) {
    setPlayingId(char.id);
    setErrorMsg(null);
    try {
      const line =
        language === 'hi'
          ? `नमस्ते! मैं ${char.name} हूँ। चलो आज एक शानदार कहानी बनाते हैं!`
          : `Hello! I am ${char.name}, let us begin our cartoon story!`;
      const res = await generateSceneTts(uid, userEmail, {
        text: line,
        language,
        voiceStyle: char.voiceStyle,
        voiceName: char.voiceName,
      });
      const audio = new Audio(res.audioUrl);
      await audio.play();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to play voice sample.');
    } finally {
      setPlayingId(null);
    }
  }

  async function handleSaveRename(charId: string) {
    if (!editName.trim()) return;
    await updateCharacterDoc(charId, { name: editName.trim() });
    setEditingId(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-stone-950 dark:text-white">
            {t(language, 'characterGalleryTitle')}
          </h1>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            Manage your cartoon cast, test Hindi & English voices, and cast them in new stories.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('create-character')}
          className="min-h-[44px] px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-xl flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>New Character</span>
        </button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-stone-200/70 dark:bg-stone-900 rounded-xl overflow-x-auto no-scrollbar">
          {(['all', '3d', 'pixar', 'anime', 'comic'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilterStyle(tab)}
              className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors ${
                filterStyle === tab
                  ? 'bg-white dark:bg-stone-800 text-stone-950 dark:text-white shadow-sm'
                  : 'text-stone-600 dark:text-stone-400'
              }`}
            >
              {tab === 'all' ? 'All Styles' : tab.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search characters..."
            className="w-full min-h-[42px] pl-9 pr-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl text-xs focus:outline-2 focus:outline-orange-600"
          />
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
          {errorMsg}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-10 text-center">
          <Mic className="w-8 h-8 mx-auto text-stone-400 mb-3" />
          <p className="text-sm text-stone-600 dark:text-stone-400 max-w-md mx-auto">
            {t(language, 'noCharacters')}
          </p>
          <button
            type="button"
            onClick={() => onNavigate('create-character')}
            className="mt-4 min-h-[44px] px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-xl"
          >
            {t(language, 'ctaCreateCharacter')}
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((char) => (
            <div
              key={char.id}
              className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden flex flex-col"
            >
              <div className="aspect-square bg-stone-100 dark:bg-stone-950">
                <SafeImage
                  src={char.cartoonImageUrl}
                  alt={char.name}
                  fallbackTitle={char.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  {editingId === char.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 min-h-[38px] px-2.5 border border-stone-300 dark:border-stone-700 rounded-lg text-sm bg-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveRename(char.id)}
                        className="min-h-[38px] px-3 bg-orange-600 text-white text-xs font-semibold rounded-lg"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-base font-display font-bold text-stone-950 dark:text-white truncate">
                        {char.name}
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(char.id);
                          setEditName(char.name);
                        }}
                        className="text-xs text-stone-500 hover:text-stone-900 dark:hover:text-white"
                      >
                        Rename
                      </button>
                    </div>
                  )}

                  <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                    {char.style.toUpperCase()} · {char.voiceStyle} voice · {char.voiceName}
                  </p>
                  {char.personality && (
                    <p className="mt-2 text-xs text-stone-600 dark:text-stone-300 line-clamp-2">
                      {char.personality}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={playingId === char.id}
                    onClick={() => handlePlaySample(char)}
                    className="min-h-[40px] px-3 py-1.5 border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg text-xs font-medium flex items-center gap-1.5"
                  >
                    {playingId === char.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    <span>Voice</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onCastCharacterInStory(char.id)}
                    className="flex-1 min-h-[40px] px-3 py-1.5 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-950 rounded-lg text-xs font-semibold"
                  >
                    Cast in Story
                  </button>

                  <button
                    type="button"
                    aria-label={`Delete ${char.name}`}
                    onClick={() => deleteCharacterDoc(char.id)}
                    className="min-h-[40px] min-w-[40px] flex items-center justify-center text-stone-400 hover:text-red-600 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
