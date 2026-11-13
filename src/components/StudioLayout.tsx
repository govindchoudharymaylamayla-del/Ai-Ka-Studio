import type { ReactNode } from 'react';
import {
  Film,
  FolderKanban,
  Home,
  Settings,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  Video,
} from 'lucide-react';
import type { LanguageCode, ScreenId, UserProfile } from '../types/studio';
import { t } from '../i18n/translations';

interface StudioLayoutProps {
  screen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
  language: LanguageCode;
  userProfile: UserProfile | null;
  children: ReactNode;
}

export function StudioLayout({
  screen,
  onNavigate,
  language,
  userProfile,
  children,
}: StudioLayoutProps) {
  const isAdmin = userProfile?.role === 'admin';

  const topNavItems: Array<{ id: ScreenId; label: string }> = [
    { id: 'home', label: t(language, 'navHome') },
    { id: 'characters', label: t(language, 'navCharacters') },
    { id: 'story-generator', label: t(language, 'navCreateStory') },
    { id: 'projects', label: t(language, 'navProjects') },
    { id: 'videos', label: t(language, 'navVideos') },
  ];

  const mobileTabs: Array<{ id: ScreenId; label: string; icon: typeof Home }> = [
    { id: 'home', label: t(language, 'navHome'), icon: Home },
    { id: 'characters', label: t(language, 'navCharacters'), icon: Users },
    { id: 'story-generator', label: t(language, 'navCreateStory'), icon: Sparkles },
    { id: 'studio', label: t(language, 'navStudio'), icon: Film },
    { id: 'projects', label: t(language, 'navProjects'), icon: FolderKanban },
  ];

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 h-14 md:h-16 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border-b border-stone-200 dark:border-stone-800 px-4 lg:px-8 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="text-lg font-display font-bold tracking-tight text-stone-900 dark:text-stone-50 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-orange-600 rounded"
        >
          {t(language, 'brand')}
        </button>

        {/* Zone 2: 5 concise single-line nav links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600 dark:text-stone-300">
          {topNavItems.map((item) => {
            const active = screen === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                  active
                    ? 'border-orange-600 text-stone-950 dark:text-white font-semibold'
                    : 'border-transparent hover:text-stone-950 dark:hover:text-white hover:border-stone-300 dark:hover:border-stone-700'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('studio')}
            className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            {t(language, 'openStudio')}
          </button>
        </div>
      </header>

      {/* Main Content Workspace with Optional Desktop Utility Rail */}
      <div className="flex-1 flex max-w-[1440px] w-full mx-auto">
        <aside className="hidden xl:flex flex-col justify-between w-56 shrink-0 border-r border-stone-200 dark:border-stone-800 py-6 px-4">
          <div className="space-y-1">
            <p className="px-3 pb-2 text-xs font-medium text-stone-500 dark:text-stone-400">
              Production Pipeline
            </p>
            {[
              { id: 'create-character' as ScreenId, label: t(language, 'charactersTitle'), icon: Users },
              { id: 'script-editor' as ScreenId, label: t(language, 'scriptEditorTitle'), icon: FolderKanban },
              { id: 'voice-selection' as ScreenId, label: t(language, 'voiceSelectionTitle'), icon: Sparkles },
              { id: 'animation-generator' as ScreenId, label: t(language, 'animationGeneratorTitle'), icon: Film },
              { id: 'video-preview' as ScreenId, label: t(language, 'videoPreviewTitle'), icon: Video },
            ].map((item) => {
              const Icon = item.icon;
              const active = screen === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`w-full min-h-[40px] flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                    active
                      ? 'bg-stone-200/80 dark:bg-stone-800 text-stone-950 dark:text-white font-semibold'
                      : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-900 hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-1 pt-6 border-t border-stone-200 dark:border-stone-800">
            <button
              type="button"
              onClick={() => onNavigate('profile')}
              className={`w-full min-h-[40px] flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                screen === 'profile'
                  ? 'bg-stone-200/80 dark:bg-stone-800 text-stone-950 dark:text-white font-semibold'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-900'
              }`}
            >
              <User className="w-4 h-4 shrink-0" />
              <span className="truncate">{t(language, 'profileTitle')}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className={`w-full min-h-[40px] flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                screen === 'settings'
                  ? 'bg-stone-200/80 dark:bg-stone-800 text-stone-950 dark:text-white font-semibold'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-900'
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span className="truncate">{t(language, 'settingsTitle')}</span>
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => onNavigate('admin')}
                className={`w-full min-h-[40px] flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                  screen === 'admin'
                    ? 'bg-orange-600 text-white font-semibold'
                    : 'text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40'
                }`}
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span className="truncate">{t(language, 'navAdmin')}</span>
              </button>
            )}
          </div>
        </aside>

        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar (Thumb Zone, strictly <= 15% combined viewport height) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border-t border-stone-200 dark:border-stone-800 grid grid-cols-5 items-center"
      >
        {mobileTabs.map((tab) => {
          const Icon = tab.icon;
          const active = screen === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.id)}
              className={`min-h-[44px] flex flex-col items-center justify-center px-1 transition-colors ${
                active
                  ? 'text-orange-600 dark:text-orange-400 font-semibold'
                  : 'text-stone-500 dark:text-stone-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] mt-1 truncate max-w-full">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
