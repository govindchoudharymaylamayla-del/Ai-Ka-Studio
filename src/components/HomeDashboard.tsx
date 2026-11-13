import {
  ArrowRight,
  Clapperboard,
  Film,
  FolderKanban,
  Mic,
  Settings,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  Video,
} from 'lucide-react';
import type {
  CartoonCharacter,
  ExportedVideo,
  FeaturedTemplate,
  LanguageCode,
  ScreenId,
  StoryProject,
  UserProfile,
} from '../types/studio';
import { t } from '../i18n/translations';
import { SafeImage } from './SafeImage';

interface HomeDashboardProps {
  language: LanguageCode;
  userProfile: UserProfile | null;
  characters: CartoonCharacter[];
  projects: StoryProject[];
  videos: ExportedVideo[];
  templates: FeaturedTemplate[];
  onNavigate: (screen: ScreenId) => void;
  onSelectProject: (project: StoryProject, targetScreen?: ScreenId) => void;
  onUseTemplate: (template: FeaturedTemplate) => void;
}

export function HomeDashboard({
  language,
  userProfile,
  characters,
  projects,
  videos,
  templates,
  onNavigate,
  onSelectProject,
  onUseTemplate,
}: HomeDashboardProps) {
  const activeTemplates = templates.filter((tpl) => tpl.active);

  return (
    <div className="space-y-8">
      {/* Hero Split Banner */}
      <section className="grid lg:grid-cols-12 gap-6 items-stretch bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden">
        <div className="lg:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-between">
          <div>
            <p className="text-xs font-medium text-orange-600 dark:text-orange-400">
              {userProfile?.displayName ? `Studio Workspace · ${userProfile.displayName}` : 'KathaToon Studio'}
            </p>
            <h1 className="mt-2 text-2xl sm:text-4xl font-display font-bold tracking-tight text-stone-950 dark:text-white leading-tight">
              {t(language, 'heroTitle')}
            </h1>
            <p className="mt-3 text-sm sm:text-base text-stone-600 dark:text-stone-300 max-w-2xl leading-relaxed">
              {t(language, 'heroSubtitle')}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('create-character')}
              className="min-h-[44px] px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-xl flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Users className="w-4 h-4" />
              <span>{t(language, 'ctaCreateCharacter')}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('story-generator')}
              className="min-h-[44px] px-5 py-2.5 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-900 dark:text-stone-100 text-sm font-semibold rounded-xl flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              <span>{t(language, 'ctaGenerateStory')}</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-5 relative min-h-[220px] lg:min-h-full bg-stone-900">
          <SafeImage
            src="/src/assets/images/hero_studio_backdrop_1794597394457.jpg"
            alt="Animation Studio Workbench"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent flex items-end p-5">
            <p className="text-xs font-medium text-stone-200">
              3D · Pixar-Inspired · Anime · Comic · Hindi & English Voice Sync
            </p>
          </div>
        </div>
      </section>

      {/* 4-Column KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Cartoon Characters', value: characters.length, screen: 'characters' as ScreenId },
          { label: 'Story Projects', value: projects.length, screen: 'projects' as ScreenId },
          { label: 'Exported Videos', value: videos.length, screen: 'videos' as ScreenId },
          { label: 'Account Plan', value: (userProfile?.plan || 'free').toUpperCase(), screen: 'profile' as ScreenId },
        ].map((kpi) => (
          <button
            key={kpi.label}
            type="button"
            onClick={() => onNavigate(kpi.screen)}
            className="text-left p-5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 rounded-xl transition-colors"
          >
            <p className="text-xs font-medium text-stone-500 dark:text-stone-400">{kpi.label}</p>
            <p className="mt-1.5 text-2xl font-display font-bold font-mono-tabular text-stone-950 dark:text-white">
              {kpi.value}
            </p>
          </button>
        ))}
      </section>

      {/* Production Pipeline Quick Access */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-display font-bold text-stone-950 dark:text-white">
            01. Production Workflow
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('profile')}
              className="min-h-[40px] px-3 py-1.5 text-xs font-medium text-stone-600 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white flex items-center gap-1.5"
            >
              <User className="w-3.5 h-3.5" />
              <span>Profile</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="min-h-[40px] px-3 py-1.5 text-xs font-medium text-stone-600 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white flex items-center gap-1.5"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>
            {userProfile?.role === 'admin' && (
              <button
                type="button"
                onClick={() => onNavigate('admin')}
                className="min-h-[40px] px-3 py-1.5 text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Admin</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              title: 'Photo to Cartoon Character',
              desc: 'Upload a portrait or snap via camera to generate 3D, Pixar-inspired, Anime, or Comic characters.',
              icon: Users,
              screen: 'create-character' as ScreenId,
            },
            {
              title: 'AI Story Generator',
              desc: 'Create 1–10 minute Hindi & English stories across 6 genres with 4-act dramatic structure.',
              icon: Sparkles,
              screen: 'story-generator' as ScreenId,
            },
            {
              title: 'Hindi Voice & Dialogue',
              desc: 'Assign Male, Female, Child, or Narrator Hindi voices with natural expression per scene.',
              icon: Mic,
              screen: 'voice-selection' as ScreenId,
            },
            {
              title: 'Scene Animation Generator',
              desc: 'Animate camera motion, blinking eyes, lip-sync, or render AI video clips via Omni Flash.',
              icon: Clapperboard,
              screen: 'animation-generator' as ScreenId,
            },
            {
              title: 'Video Editing Studio',
              desc: 'Edit dialogues & subtitles, mix music/SFX, reorder scenes, and export 720p/1080p video.',
              icon: Film,
              screen: 'studio' as ScreenId,
            },
            {
              title: 'Downloaded Videos',
              desc: 'Preview finished 16:9 widescreen or 9:16 Reels/Shorts exports and download anytime.',
              icon: Video,
              screen: 'videos' as ScreenId,
            },
          ].map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.title}
                type="button"
                onClick={() => onNavigate(tool.screen)}
                className="text-left p-5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-orange-500/60 dark:hover:border-orange-500/60 rounded-xl transition-colors flex flex-col justify-between group"
              >
                <div>
                  <div className="w-9 h-9 rounded-lg bg-stone-100 dark:bg-stone-800 text-orange-600 dark:text-orange-400 flex items-center justify-center mb-3">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-display font-semibold text-stone-950 dark:text-white">
                    {tool.title}
                  </h3>
                  <p className="mt-1.5 text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                    {tool.desc}
                  </p>
                </div>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-orange-600 dark:text-orange-400 group-hover:translate-x-0.5 transition-transform">
                  <span>Open tool</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Cartoon Style Showcase + Recent Projects */}
      <section className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-6">
          <h2 className="text-base font-display font-bold text-stone-950 dark:text-white">
            02. Character Style Presets
          </h2>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            Consistent likeness across every story frame.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { name: '3D / Pixar', img: '/src/assets/images/style_3d_pixar_1794597395388.jpg' },
              { name: 'Anime', img: '/src/assets/images/style_anime_showcase_1794597395757.jpg' },
              { name: 'Comic', img: '/src/assets/images/style_comic_showcase_1794597395292.jpg' },
            ].map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => onNavigate('create-character')}
                className="text-left group"
              >
                <div className="aspect-square rounded-xl overflow-hidden border border-stone-200 dark:border-stone-800">
                  <SafeImage
                    src={item.img}
                    alt={`${item.name} cartoon character style`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                </div>
                <p className="mt-1.5 text-xs font-medium text-stone-700 dark:text-stone-300 truncate">
                  {item.name}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-display font-bold text-stone-950 dark:text-white">
              03. Recent Projects
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('projects')}
              className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline min-h-[36px] px-2"
            >
              View all
            </button>
          </div>

          {projects.length === 0 ? (
            <div className="py-8 text-center">
              <FolderKanban className="w-8 h-8 mx-auto text-stone-400 mb-2" />
              <p className="text-sm text-stone-600 dark:text-stone-400 max-w-sm mx-auto">
                {t(language, 'noProjects')}
              </p>
              <button
                type="button"
                onClick={() => onNavigate('story-generator')}
                className="mt-4 min-h-[44px] px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-xl"
              >
                {t(language, 'ctaGenerateStory')}
              </button>
            </div>
          ) : (
            <div className="divide-y divide-stone-100 dark:divide-stone-800">
              {projects.slice(0, 4).map((proj) => (
                <div key={proj.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onSelectProject(proj, 'studio')}
                      className="text-sm font-semibold text-stone-900 dark:text-stone-100 hover:text-orange-600 dark:hover:text-orange-400 truncate block text-left"
                    >
                      {proj.title}
                    </button>
                    <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400 truncate">
                      {proj.genre} · {proj.language === 'hi' ? 'Hindi' : 'English'} · {proj.durationMinutes} min · {proj.aspectRatio} · {proj.status}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSelectProject(proj, 'script-editor')}
                      className="min-h-[38px] px-3 py-1.5 text-xs font-medium border border-stone-200 dark:border-stone-700 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800"
                    >
                      Script
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectProject(proj, 'studio')}
                      className="min-h-[38px] px-3 py-1.5 text-xs font-semibold bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-950 rounded-lg"
                    >
                      Studio
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Featured Story Templates (managed by Admin) */}
      {activeTemplates.length > 0 && (
        <section className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-6">
          <h2 className="text-base font-display font-bold text-stone-950 dark:text-white mb-4">
            04. Curated Story Ideas
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeTemplates.map((tpl) => (
              <div
                key={tpl.id}
                className="p-4 border border-stone-200 dark:border-stone-800 rounded-xl flex flex-col justify-between"
              >
                <div>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {tpl.genre} · {tpl.language === 'hi' ? 'Hindi' : 'English'}
                  </p>
                  <h3 className="mt-1 text-sm font-semibold text-stone-900 dark:text-white">
                    {tpl.title}
                  </h3>
                  <p className="mt-1.5 text-xs text-stone-600 dark:text-stone-400 line-clamp-2">
                    {tpl.prompt}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onUseTemplate(tpl)}
                  className="mt-4 min-h-[40px] w-full px-3 py-2 text-xs font-semibold bg-stone-100 dark:bg-stone-800 hover:bg-orange-600 hover:text-white rounded-lg transition-colors"
                >
                  Use Template
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
