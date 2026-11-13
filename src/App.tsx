/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, testFirestoreConnection } from './lib/firebase';
import {
  ensureUserProfile,
  subscribeCharacters,
  subscribeProjects,
  subscribeScenes,
  subscribeTemplates,
  subscribeUserUsageLogs,
  subscribeVideos,
  updateUserProfileFields,
} from './lib/firestoreService';
import type {
  CartoonCharacter,
  ExportedVideo,
  FeaturedTemplate,
  LanguageCode,
  ScreenId,
  StoryGenre,
  StoryProject,
  StoryScene,
  ThemeMode,
  UsageLog,
  UserProfile,
  VideoAspectRatio,
  VideoQuality,
} from './types/studio';
import { AuthScreen, SplashScreen } from './components/AuthAndSplash';
import { StudioLayout } from './components/StudioLayout';
import { HomeDashboard } from './components/HomeDashboard';
import {
  CharacterGalleryScreen,
  CreateCharacterScreen,
} from './components/CharacterScreens';
import {
  ScriptEditorScreen,
  StoryGeneratorScreen,
} from './components/StoryScreens';
import {
  AnimationGeneratorScreen,
  VoiceSelectionScreen,
} from './components/VoiceAndAnimationScreens';
import {
  VideoPreviewScreen,
  VideoStudioScreen,
} from './components/VideoStudioScreen';
import {
  AdminDashboardScreen,
  DownloadedVideosScreen,
  ProjectsScreen,
  SettingsScreen,
  UserProfileScreen,
} from './components/LibraryAndAccountScreens';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const [screen, setScreen] = useState<ScreenId>('home');
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [defaultAspectRatio, setDefaultAspectRatio] = useState<VideoAspectRatio>('16:9');
  const [defaultQuality, setDefaultQuality] = useState<VideoQuality>('720p');

  const [characters, setCharacters] = useState<CartoonCharacter[]>([]);
  const [projects, setProjects] = useState<StoryProject[]>([]);
  const [videos, setVideos] = useState<ExportedVideo[]>([]);
  const [templates, setTemplates] = useState<FeaturedTemplate[]>([]);
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);

  const [activeProject, setActiveProject] = useState<StoryProject | null>(null);
  const [activeScenes, setActiveScenes] = useState<StoryScene[]>([]);
  const [activeVideo, setActiveVideo] = useState<ExportedVideo | null>(null);

  const [storyDraftPrompt, setStoryDraftPrompt] = useState<string | undefined>(undefined);
  const [storyDraftGenre, setStoryDraftGenre] = useState<StoryGenre | undefined>(undefined);
  const [storyDraftChars, setStoryDraftChars] = useState<string[] | undefined>(undefined);

  // Sync Tailwind dark class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Verify Firestore connection + listen to auth state
  useEffect(() => {
    void testFirestoreConnection();

    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const profile = await ensureUserProfile(user);
          setUserProfile(profile);
          setLanguage(profile.preferredLanguage || 'en');
          setTheme(profile.theme || 'light');
        } catch (err) {
          console.error('Failed to initialize user profile:', err);
        }
      } else {
        setUserProfile(null);
        setCharacters([]);
        setProjects([]);
        setVideos([]);
        setUsageLogs([]);
        setActiveProject(null);
        setActiveScenes([]);
      }
      setAuthReady(true);
    });

    return () => unsub();
  }, []);

  // Attach Firestore listeners only when authenticated
  useEffect(() => {
    if (!authReady || !firebaseUser) return;

    const uid = firebaseUser.uid;
    const unsubChars = subscribeCharacters(uid, setCharacters);
    const unsubProjs = subscribeProjects(uid, (items) => {
      setProjects(items);
      setActiveProject((curr) => {
        if (!curr) return items[0] || null;
        return items.find((p) => p.id === curr.id) || items[0] || null;
      });
    });
    const unsubVideos = subscribeVideos(uid, (vids) => {
      setVideos(vids);
      setActiveVideo((curr) => curr || vids[0] || null);
    });
    const unsubLogs = subscribeUserUsageLogs(uid, setUsageLogs);
    const unsubTemplates = subscribeTemplates(setTemplates);

    return () => {
      unsubChars();
      unsubProjs();
      unsubVideos();
      unsubLogs();
      unsubTemplates();
    };
  }, [authReady, firebaseUser?.uid]);

  // Listen to active project's scenes subcollection
  useEffect(() => {
    if (!authReady || !firebaseUser || !activeProject?.id) {
      setActiveScenes([]);
      return;
    }
    const unsub = subscribeScenes(activeProject.id, setActiveScenes);
    return () => unsub();
  }, [authReady, firebaseUser?.uid, activeProject?.id]);

  function handleChangeLanguage(nextLang: LanguageCode) {
    setLanguage(nextLang);
    if (firebaseUser) {
      void updateUserProfileFields(firebaseUser.uid, { preferredLanguage: nextLang });
    }
  }

  function handleChangeTheme(nextTheme: ThemeMode) {
    setTheme(nextTheme);
    if (firebaseUser) {
      void updateUserProfileFields(firebaseUser.uid, { theme: nextTheme });
    }
  }

  if (showSplash || !authReady) {
    return (
      <SplashScreen
        language={language}
        onContinue={() => setShowSplash(false)}
      />
    );
  }

  if (!firebaseUser) {
    return (
      <AuthScreen
        language={language}
        onToggleLanguage={handleChangeLanguage}
      />
    );
  }

  const uid = firebaseUser.uid;
  const userEmail = firebaseUser.email || undefined;

  return (
    <StudioLayout
      screen={screen}
      onNavigate={setScreen}
      language={language}
      userProfile={userProfile}
    >
      {screen === 'home' && (
        <HomeDashboard
          language={language}
          userProfile={userProfile}
          characters={characters}
          projects={projects}
          videos={videos}
          templates={templates}
          onNavigate={setScreen}
          onSelectProject={(proj, target = 'studio') => {
            setActiveProject(proj);
            setScreen(target);
          }}
          onUseTemplate={(tpl) => {
            setStoryDraftPrompt(tpl.prompt);
            setStoryDraftGenre(tpl.genre);
            setScreen('story-generator');
          }}
        />
      )}

      {screen === 'create-character' && (
        <CreateCharacterScreen
          uid={uid}
          userEmail={userEmail}
          language={language}
          onNavigate={setScreen}
        />
      )}

      {screen === 'characters' && (
        <CharacterGalleryScreen
          uid={uid}
          userEmail={userEmail}
          language={language}
          characters={characters}
          onNavigate={setScreen}
          onCastCharacterInStory={(charId) => {
            setStoryDraftChars([charId]);
            setScreen('story-generator');
          }}
        />
      )}

      {screen === 'story-generator' && (
        <StoryGeneratorScreen
          uid={uid}
          userEmail={userEmail}
          language={language}
          characters={characters}
          initialPrompt={storyDraftPrompt}
          initialGenre={storyDraftGenre}
          initialCharIds={storyDraftChars}
          defaultAspectRatio={defaultAspectRatio}
          defaultQuality={defaultQuality}
          onProjectCreated={(proj) => setActiveProject(proj)}
          onNavigate={setScreen}
        />
      )}

      {screen === 'script-editor' && (
        <ScriptEditorScreen
          uid={uid}
          language={language}
          project={activeProject}
          scenes={activeScenes}
          characters={characters}
          onNavigate={setScreen}
        />
      )}

      {screen === 'voice-selection' && (
        <VoiceSelectionScreen
          uid={uid}
          userEmail={userEmail}
          language={language}
          project={activeProject}
          scenes={activeScenes}
          onNavigate={setScreen}
        />
      )}

      {screen === 'animation-generator' && (
        <AnimationGeneratorScreen
          uid={uid}
          userEmail={userEmail}
          language={language}
          project={activeProject}
          scenes={activeScenes}
          characters={characters}
          onNavigate={setScreen}
        />
      )}

      {screen === 'studio' && (
        <VideoStudioScreen
          uid={uid}
          userEmail={userEmail}
          language={language}
          project={activeProject}
          scenes={activeScenes}
          characters={characters}
          onNavigate={setScreen}
          onVideoExported={(vid) => setActiveVideo(vid)}
        />
      )}

      {screen === 'video-preview' && (
        <VideoPreviewScreen
          language={language}
          video={activeVideo}
          onNavigate={setScreen}
        />
      )}

      {screen === 'projects' && (
        <ProjectsScreen
          language={language}
          projects={projects}
          onSelectProject={(proj, target) => {
            setActiveProject(proj);
            setScreen(target);
          }}
          onNavigate={setScreen}
        />
      )}

      {screen === 'videos' && (
        <DownloadedVideosScreen
          language={language}
          videos={videos}
          onPreviewVideo={(vid) => {
            setActiveVideo(vid);
            setScreen('video-preview');
          }}
        />
      )}

      {screen === 'profile' && (
        <UserProfileScreen
          language={language}
          userProfile={userProfile}
          characters={characters}
          projects={projects}
          videos={videos}
          usageLogs={usageLogs}
          onNavigate={setScreen}
        />
      )}

      {screen === 'settings' && (
        <SettingsScreen
          language={language}
          theme={theme}
          defaultAspectRatio={defaultAspectRatio}
          defaultQuality={defaultQuality}
          onChangeLanguage={handleChangeLanguage}
          onChangeTheme={handleChangeTheme}
          onChangeDefaultAspectRatio={setDefaultAspectRatio}
          onChangeDefaultQuality={setDefaultQuality}
        />
      )}

      {screen === 'admin' && (
        <AdminDashboardScreen
          language={language}
          templates={templates}
          userProfile={userProfile}
        />
      )}
    </StudioLayout>
  );
}
