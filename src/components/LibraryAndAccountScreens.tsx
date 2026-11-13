import { useEffect, useState } from 'react';
import { signOut } from 'firebase/auth';
import {
  Check,
  Download,
  Film,
  FolderKanban,
  Globe,
  Loader2,
  LogOut,
  Moon,
  Play,
  Plus,
  ShieldCheck,
  Sun,
  Trash2,
  Video,
} from 'lucide-react';
import { auth } from '../lib/firebase';
import {
  adminDeleteTemplate,
  adminFetchOverview,
  adminSaveTemplate,
  adminUpdateUserPlan,
  deleteProjectDoc,
  deleteVideoDoc,
  updateUserProfileFields,
} from '../lib/firestoreService';
import type {
  CartoonCharacter,
  ExportedVideo,
  FeaturedTemplate,
  LanguageCode,
  ScreenId,
  StoryGenre,
  StoryProject,
  ThemeMode,
  UsageLog,
  UserProfile,
  VideoAspectRatio,
  VideoQuality,
} from '../types/studio';
import { t } from '../i18n/translations';
import { SafeImage } from './SafeImage';

export function ProjectsScreen({
  language,
  projects,
  onSelectProject,
  onNavigate,
}: {
  language: LanguageCode;
  projects: StoryProject[];
  onSelectProject: (project: StoryProject, target: ScreenId) => void;
  onNavigate: (screen: ScreenId) => void;
}) {
  const [filter, setFilter] = useState<'all' | StoryProject['status']>('all');

  const filtered = projects.filter((p) => filter === 'all' || p.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-stone-950 dark:text-white">
            {t(language, 'myProjectsTitle')}
          </h1>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            Resume any story script, voice session, animation pass, or studio timeline.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('story-generator')}
          className="min-h-[44px] px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>New Story Project</span>
        </button>
      </div>

      <div className="flex items-center gap-1 p-1 bg-stone-200/70 dark:bg-stone-900 rounded-xl w-fit overflow-x-auto max-w-full">
        {(['all', 'scripted', 'voiced', 'animated', 'exported'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`min-h-[36px] px-3 text-xs font-semibold rounded-lg capitalize whitespace-nowrap shrink-0 ${
              filter === tab
                ? 'bg-white dark:bg-stone-800 text-stone-950 dark:text-white shadow-sm'
                : 'text-stone-600 dark:text-stone-400'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-10 text-center">
          <FolderKanban className="w-8 h-8 mx-auto text-stone-400 mb-3" />
          <p className="text-sm text-stone-600 dark:text-stone-400">{t(language, 'noProjects')}</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 flex flex-col justify-between gap-4"
            >
              <div>
                <p className="text-xs text-stone-500">
                  {p.genre} · {p.language === 'hi' ? 'Hindi' : 'English'} · {p.durationMinutes} min · {p.aspectRatio} · {p.status}
                </p>
                <h3 className="mt-1 text-base font-display font-bold text-stone-950 dark:text-white">
                  {p.title}
                </h3>
                {p.moralOrSummary && (
                  <p className="mt-1.5 text-xs text-stone-600 dark:text-stone-400 line-clamp-2">
                    {p.moralOrSummary}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-stone-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => onSelectProject(p, 'script-editor')}
                  className="min-h-[38px] px-3 py-1.5 border border-stone-200 dark:border-stone-700 rounded-lg text-xs font-medium"
                >
                  Script
                </button>
                <button
                  type="button"
                  onClick={() => onSelectProject(p, 'voice-selection')}
                  className="min-h-[38px] px-3 py-1.5 border border-stone-200 dark:border-stone-700 rounded-lg text-xs font-medium"
                >
                  Voices
                </button>
                <button
                  type="button"
                  onClick={() => onSelectProject(p, 'animation-generator')}
                  className="min-h-[38px] px-3 py-1.5 border border-stone-200 dark:border-stone-700 rounded-lg text-xs font-medium"
                >
                  Animate
                </button>
                <button
                  type="button"
                  onClick={() => onSelectProject(p, 'studio')}
                  className="min-h-[38px] px-3 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-semibold ml-auto"
                >
                  Open Studio
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${p.title}`}
                  onClick={() => deleteProjectDoc(p.id)}
                  className="min-h-[38px] min-w-[38px] flex items-center justify-center text-stone-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DownloadedVideosScreen({
  language,
  videos,
  onPreviewVideo,
}: {
  language: LanguageCode;
  videos: ExportedVideo[];
  onPreviewVideo: (video: ExportedVideo) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-stone-950 dark:text-white">
          {t(language, 'downloadedVideosTitle')}
        </h1>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          Your rendered 720p and 1080p cartoon videos ready for playback and download.
        </p>
      </div>

      {videos.length === 0 ? (
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-10 text-center">
          <Video className="w-8 h-8 mx-auto text-stone-400 mb-3" />
          <p className="text-sm text-stone-600 dark:text-stone-400">{t(language, 'noVideos')}</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {videos.map((v) => {
            const mb = v.fileSizeBytes ? (v.fileSizeBytes / (1024 * 1024)).toFixed(2) : null;
            return (
              <div
                key={v.id}
                className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden flex flex-col"
              >
                <div className="aspect-video bg-stone-950 relative">
                  <SafeImage
                    src={v.thumbnailUrl}
                    alt={v.title}
                    fallbackTitle={v.title}
                    className="w-full h-full object-cover opacity-90"
                  />
                  <button
                    type="button"
                    onClick={() => onPreviewVideo(v)}
                    aria-label={`Play ${v.title}`}
                    className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/45 transition-colors"
                  >
                    <span className="w-12 h-12 rounded-full bg-white text-stone-950 flex items-center justify-center shadow-lg">
                      <Play className="w-5 h-5 ml-0.5" />
                    </span>
                  </button>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-display font-bold text-stone-950 dark:text-white truncate">
                      {v.title}
                    </h3>
                    <p className="mt-1 text-xs font-mono-tabular text-stone-500">
                      {v.quality} · {v.aspectRatio} · {v.durationSec}s{mb ? ` · ${mb} MB` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                    <button
                      type="button"
                      onClick={() => onPreviewVideo(v)}
                      className="flex-1 min-h-[38px] px-3 py-1.5 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-950 rounded-lg text-xs font-semibold"
                    >
                      Watch
                    </button>
                    <a
                      href={v.downloadUrl}
                      download={`${v.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.webm`}
                      className="min-h-[38px] px-3 py-1.5 border border-stone-200 dark:border-stone-700 rounded-lg text-xs font-semibold flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </a>
                    <button
                      type="button"
                      aria-label={`Delete ${v.title}`}
                      onClick={() => deleteVideoDoc(v.id)}
                      className="min-h-[38px] min-w-[38px] flex items-center justify-center text-stone-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function UserProfileScreen({
  language,
  userProfile,
  characters,
  projects,
  videos,
  usageLogs,
  onNavigate,
}: {
  language: LanguageCode;
  userProfile: UserProfile | null;
  characters: CartoonCharacter[];
  projects: StoryProject[];
  videos: ExportedVideo[];
  usageLogs: UsageLog[];
  onNavigate: (screen: ScreenId) => void;
}) {
  const [name, setName] = useState(userProfile?.displayName || '');
  const [saved, setSaved] = useState(false);

  async function handleUpdateName(e: React.FormEvent) {
    e.preventDefault();
    if (!userProfile || !name.trim()) return;
    await updateUserProfileFields(userProfile.uid, { displayName: name.trim() });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-display font-bold text-stone-950 dark:text-white">
          {t(language, 'profileTitle')}
        </h1>
        <button
          type="button"
          onClick={() => signOut(auth)}
          className="min-h-[42px] px-4 py-2 border border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-900 rounded-xl text-xs font-semibold flex items-center gap-2 text-red-600"
        >
          <LogOut className="w-4 h-4" />
          <span>{t(language, 'signOut')}</span>
        </button>
      </div>

      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 space-y-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-14 h-14 rounded-2xl overflow-hidden bg-stone-200 dark:bg-stone-800 shrink-0">
            <SafeImage
              src={userProfile?.photoURL}
              alt={userProfile?.displayName || 'Creator'}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-display font-bold text-stone-950 dark:text-white truncate">
              {userProfile?.displayName}
            </p>
            <p className="text-xs text-stone-500 truncate">
              {userProfile?.email} · Role: {userProfile?.role} · Plan: {(userProfile?.plan || 'free').toUpperCase()}
            </p>
          </div>
          {userProfile?.role === 'admin' && (
            <button
              type="button"
              onClick={() => onNavigate('admin')}
              className="min-h-[40px] px-4 py-2 bg-orange-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Open Admin Panel</span>
            </button>
          )}
        </div>

        <form onSubmit={handleUpdateName} className="flex flex-wrap gap-3 pt-4 border-t border-stone-100 dark:border-stone-800">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Creator display name"
            className="flex-1 min-w-[200px] min-h-[42px] px-3.5 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl text-sm"
          />
          <button
            type="submit"
            className="min-h-[42px] px-4 py-2 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-950 rounded-xl text-xs font-semibold flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{saved ? 'Saved' : 'Update Name'}</span>
          </button>
        </form>

        <div className="grid grid-cols-3 gap-4 pt-2">
          <div>
            <p className="text-xs text-stone-500">Characters</p>
            <p className="text-xl font-mono-tabular font-bold">{characters.length}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Projects</p>
            <p className="text-xl font-mono-tabular font-bold">{projects.length}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Exported Videos</p>
            <p className="text-xl font-mono-tabular font-bold">{videos.length}</p>
          </div>
        </div>
      </div>

      {/* Generation History */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-6">
        <h2 className="text-base font-display font-bold text-stone-950 dark:text-white mb-4">
          Recent AI Generation History
        </h2>
        {usageLogs.length === 0 ? (
          <p className="text-xs text-stone-500">No generation requests logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-stone-200 dark:border-stone-800 text-stone-500">
                <tr>
                  <th className="py-2 pr-4 font-medium">Feature</th>
                  <th className="py-2 pr-4 font-medium">Model</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 text-right font-medium">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {usageLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2.5 pr-4 font-medium capitalize">{log.feature}</td>
                    <td className="py-2.5 pr-4 font-mono-tabular text-stone-500">{log.model}</td>
                    <td className="py-2.5 pr-4">
                      <span className={log.status === 'success' ? 'text-emerald-600' : 'text-red-600'}>
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-mono-tabular">{log.durationMs} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function SettingsScreen({
  language,
  theme,
  defaultAspectRatio,
  defaultQuality,
  onChangeLanguage,
  onChangeTheme,
  onChangeDefaultAspectRatio,
  onChangeDefaultQuality,
}: {
  language: LanguageCode;
  theme: ThemeMode;
  defaultAspectRatio: VideoAspectRatio;
  defaultQuality: VideoQuality;
  onChangeLanguage: (lang: LanguageCode) => void;
  onChangeTheme: (theme: ThemeMode) => void;
  onChangeDefaultAspectRatio: (ratio: VideoAspectRatio) => void;
  onChangeDefaultQuality: (q: VideoQuality) => void;
}) {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-stone-950 dark:text-white">
          {t(language, 'settingsTitle')}
        </h1>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          Customize app language, light/dark appearance, and default video export preferences.
        </p>
      </div>

      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl divide-y divide-stone-100 dark:divide-stone-800">
        <div className="p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-orange-600" />
            <div>
              <p className="text-sm font-semibold">{t(language, 'languageLabel')}</p>
              <p className="text-xs text-stone-500">Switch UI between English and हिन्दी</p>
            </div>
          </div>
          <div className="flex p-1 bg-stone-100 dark:bg-stone-950 rounded-xl">
            {(['en', 'hi'] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => onChangeLanguage(code)}
                className={`min-h-[38px] px-4 text-xs font-semibold rounded-lg ${
                  language === code
                    ? 'bg-white dark:bg-stone-800 text-stone-950 dark:text-white shadow-sm'
                    : 'text-stone-500'
                }`}
              >
                {code === 'en' ? 'English' : 'हिन्दी'}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {theme === 'dark' ? (
              <Moon className="w-5 h-5 text-orange-500" />
            ) : (
              <Sun className="w-5 h-5 text-orange-600" />
            )}
            <div>
              <p className="text-sm font-semibold">{t(language, 'themeLabel')}</p>
              <p className="text-xs text-stone-500">Toggle Light Mode and Dark Mode</p>
            </div>
          </div>
          <div className="flex p-1 bg-stone-100 dark:bg-stone-950 rounded-xl">
            <button
              type="button"
              onClick={() => onChangeTheme('light')}
              className={`min-h-[38px] px-4 text-xs font-semibold rounded-lg ${
                theme === 'light'
                  ? 'bg-white text-stone-950 shadow-sm'
                  : 'text-stone-500'
              }`}
            >
              {t(language, 'lightMode')}
            </button>
            <button
              type="button"
              onClick={() => onChangeTheme('dark')}
              className={`min-h-[38px] px-4 text-xs font-semibold rounded-lg ${
                theme === 'dark'
                  ? 'bg-stone-800 text-white shadow-sm'
                  : 'text-stone-500'
              }`}
            >
              {t(language, 'darkMode')}
            </button>
          </div>
        </div>

        <div className="p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">Default Video Format</p>
            <p className="text-xs text-stone-500">Widescreen 16:9 or Vertical Shorts/Reels 9:16</p>
          </div>
          <select
            value={defaultAspectRatio}
            onChange={(e) => onChangeDefaultAspectRatio(e.target.value as VideoAspectRatio)}
            className="min-h-[40px] px-3 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl text-xs font-semibold"
          >
            <option value="16:9">16:9 Landscape</option>
            <option value="9:16">9:16 Vertical</option>
          </select>
        </div>

        <div className="p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">Default Export Resolution</p>
            <p className="text-xs text-stone-500">720p fast export or 1080p Full HD</p>
          </div>
          <select
            value={defaultQuality}
            onChange={(e) => onChangeDefaultQuality(e.target.value as VideoQuality)}
            className="min-h-[40px] px-3 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl text-xs font-semibold"
          >
            <option value="720p">720p HD</option>
            <option value="1080p">1080p Full HD</option>
          </select>
        </div>
      </div>
    </div>
  );
}

export function AdminDashboardScreen({
  language,
  templates,
  userProfile,
}: {
  language: LanguageCode;
  templates: FeaturedTemplate[];
  userProfile: UserProfile | null;
}) {
  const [tab, setTab] = useState<'overview' | 'users' | 'projects' | 'api' | 'content'>('overview');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [projects, setProjects] = useState<StoryProject[]>([]);
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Content management form
  const [tplTitle, setTplTitle] = useState('');
  const [tplGenre, setTplGenre] = useState<StoryGenre>('moral');
  const [tplLang, setTplLang] = useState<LanguageCode>('hi');
  const [tplPrompt, setTplPrompt] = useState('');

  async function loadAdminData() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await adminFetchOverview();
      setUsers(data.users);
      setProjects(data.projects);
      setLogs(data.logs);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to load admin records.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (userProfile?.role === 'admin') {
      void loadAdminData();
    } else {
      setLoading(false);
    }
  }, [userProfile?.role]);

  if (userProfile?.role !== 'admin') {
    return (
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-10 text-center">
        <ShieldCheck className="w-8 h-8 mx-auto text-stone-400 mb-3" />
        <p className="text-sm text-stone-600 dark:text-stone-400">
          Admin privileges are required to view this control center.
        </p>
      </div>
    );
  }

  async function handlePlanChange(uid: string, plan: 'free' | 'pro' | 'studio') {
    await adminUpdateUserPlan(uid, plan);
    setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, plan } : u)));
  }

  async function handleCreateTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!tplTitle.trim() || !tplPrompt.trim()) return;
    await adminSaveTemplate({
      title: tplTitle.trim(),
      genre: tplGenre,
      language: tplLang,
      prompt: tplPrompt.trim(),
      active: true,
    });
    setTplTitle('');
    setTplPrompt('');
  }

  const successCount = logs.filter((l) => l.status === 'success').length;
  const errorCount = logs.filter((l) => l.status === 'error').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-stone-950 dark:text-white">
            {t(language, 'adminTitle')}
          </h1>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            User management, projects, AI generation statistics, API usage, templates, and subscriptions.
          </p>
        </div>
        <button
          type="button"
          onClick={loadAdminData}
          className="min-h-[40px] px-4 py-2 border border-stone-200 dark:border-stone-800 rounded-xl text-xs font-semibold"
        >
          Refresh Metrics
        </button>
      </div>

      <div className="flex items-center gap-1 p-1 bg-stone-200/70 dark:bg-stone-900 rounded-xl w-fit overflow-x-auto max-w-full">
        {(
          [
            { id: 'overview', label: 'Overview' },
            { id: 'users', label: 'Users & Plans' },
            { id: 'projects', label: 'Projects' },
            { id: 'api', label: 'API Monitoring' },
            { id: 'content', label: 'Content Templates' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`min-h-[38px] px-3.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
              tab === item.id
                ? 'bg-white dark:bg-stone-800 text-stone-950 dark:text-white shadow-sm'
                : 'text-stone-600 dark:text-stone-400'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
        </div>
      ) : (
        <>
          {tab === 'overview' && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Creators', val: users.length },
                { label: 'Total Projects', val: projects.length },
                { label: 'AI Calls Succeeded', val: successCount },
                { label: 'AI Calls Failed / Limited', val: errorCount },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="p-5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl"
                >
                  <p className="text-xs text-stone-500">{stat.label}</p>
                  <p className="mt-1.5 text-2xl font-display font-bold font-mono-tabular">
                    {stat.val}
                  </p>
                </div>
              ))}
            </div>
          )}

          {tab === 'users' && (
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-stone-200 dark:border-stone-800 text-stone-500">
                  <tr>
                    <th className="py-2 pr-4">Creator</th>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">Role</th>
                    <th className="py-2">Subscription Plan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {users.map((u) => (
                    <tr key={u.uid}>
                      <td className="py-3 pr-4 font-semibold">{u.displayName}</td>
                      <td className="py-3 pr-4 text-stone-500">{u.email}</td>
                      <td className="py-3 pr-4 capitalize">{u.role}</td>
                      <td className="py-3">
                        <select
                          value={u.plan}
                          onChange={(e) =>
                            handlePlanChange(u.uid, e.target.value as 'free' | 'pro' | 'studio')
                          }
                          className="min-h-[34px] px-2.5 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg text-xs font-semibold"
                        >
                          <option value="free">Free</option>
                          <option value="pro">Pro</option>
                          <option value="studio">Studio</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'projects' && (
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-stone-200 dark:border-stone-800 text-stone-500">
                  <tr>
                    <th className="py-2 pr-4">Title</th>
                    <th className="py-2 pr-4">Genre</th>
                    <th className="py-2 pr-4">Format</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {projects.map((p) => (
                    <tr key={p.id}>
                      <td className="py-3 pr-4 font-semibold">{p.title}</td>
                      <td className="py-3 pr-4 capitalize">{p.genre}</td>
                      <td className="py-3 pr-4 font-mono-tabular">
                        {p.aspectRatio} · {p.quality}
                      </td>
                      <td className="py-3 pr-4 capitalize">{p.status}</td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteProjectDoc(p.id);
                            setProjects((prev) => prev.filter((item) => item.id !== p.id));
                          }}
                          className="text-red-600 hover:underline font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'api' && (
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-stone-200 dark:border-stone-800 text-stone-500">
                  <tr>
                    <th className="py-2 pr-4">User</th>
                    <th className="py-2 pr-4">Feature</th>
                    <th className="py-2 pr-4">Model</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 text-right">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {logs.map((l) => (
                    <tr key={l.id}>
                      <td className="py-2.5 pr-4 text-stone-500">{l.userEmail || l.ownerId}</td>
                      <td className="py-2.5 pr-4 capitalize font-medium">{l.feature}</td>
                      <td className="py-2.5 pr-4 font-mono-tabular">{l.model}</td>
                      <td className="py-2.5 pr-4">
                        <span className={l.status === 'success' ? 'text-emerald-600' : 'text-red-600'}>
                          {l.status}
                        </span>
                        {l.errorMessage && (
                          <p className="text-[11px] text-stone-500 max-w-xs truncate">{l.errorMessage}</p>
                        )}
                      </td>
                      <td className="py-2.5 text-right font-mono-tabular">{l.durationMs} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'content' && (
            <div className="grid lg:grid-cols-12 gap-6">
              <form
                onSubmit={handleCreateTemplate}
                className="lg:col-span-5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 space-y-4"
              >
                <h2 className="text-sm font-display font-bold">Add Featured Story Template</h2>
                <input
                  type="text"
                  value={tplTitle}
                  onChange={(e) => setTplTitle(e.target.value)}
                  placeholder="Template title (e.g. Chintu Ki Chaturai)"
                  className="w-full min-h-[40px] px-3 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={tplGenre}
                    onChange={(e) => setTplGenre(e.target.value as StoryGenre)}
                    className="min-h-[40px] px-2.5 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl text-xs"
                  >
                    <option value="moral">Moral</option>
                    <option value="comedy">Comedy</option>
                    <option value="family">Family</option>
                    <option value="adventure">Adventure</option>
                    <option value="education">Education</option>
                    <option value="mystery">Mystery</option>
                  </select>
                  <select
                    value={tplLang}
                    onChange={(e) => setTplLang(e.target.value as LanguageCode)}
                    className="min-h-[40px] px-2.5 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl text-xs"
                  >
                    <option value="hi">Hindi</option>
                    <option value="en">English</option>
                  </select>
                </div>
                <textarea
                  rows={3}
                  value={tplPrompt}
                  onChange={(e) => setTplPrompt(e.target.value)}
                  placeholder="Story prompt..."
                  className="w-full p-3 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl text-xs"
                />
                <button
                  type="submit"
                  className="w-full min-h-[42px] bg-orange-600 text-white rounded-xl text-xs font-semibold"
                >
                  Publish Template
                </button>
              </form>

              <div className="lg:col-span-7 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 space-y-3">
                <h2 className="text-sm font-display font-bold">Published Templates ({templates.length})</h2>
                {templates.length === 0 ? (
                  <p className="text-xs text-stone-500">No curated templates published yet.</p>
                ) : (
                  <div className="divide-y divide-stone-100 dark:divide-stone-800">
                    {templates.map((tpl) => (
                      <div key={tpl.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">{tpl.title}</p>
                          <p className="text-[11px] text-stone-500 truncate">
                            {tpl.genre} · {tpl.language} · {tpl.active ? 'Active' : 'Hidden'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => adminSaveTemplate({ ...tpl, active: !tpl.active })}
                            className="min-h-[34px] px-2.5 border border-stone-200 dark:border-stone-700 rounded-lg text-xs"
                          >
                            {tpl.active ? 'Hide' : 'Show'}
                          </button>
                          <button
                            type="button"
                            onClick={() => adminDeleteTemplate(tpl.id)}
                            className="min-h-[34px] px-2.5 text-red-600 text-xs"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
