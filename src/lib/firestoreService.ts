import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { ADMIN_EMAIL, db, handleFirestoreError, OperationType } from './firebase';
import type {
  CartoonCharacter,
  ExportedVideo,
  FeaturedTemplate,
  StoryProject,
  StoryScene,
  UsageLog,
  UserProfile,
} from '../types/studio';

export function makeSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10).replace(/[^a-zA-Z0-9]/g, 'x');
  return `${prefix}_${Date.now()}_${rand}`;
}

export function isValidFirestoreId(id: string): boolean {
  return /^[a-zA-Z0-9_\-]+$/.test(id) && id.length >= 1 && id.length <= 128;
}

export async function ensureUserProfile(firebaseUser: User): Promise<UserProfile> {
  const userPath = `users/${firebaseUser.uid}`;
  try {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const snap = await getDoc(userRef);
    const isAdminEmail =
      firebaseUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() && firebaseUser.emailVerified;

    if (snap.exists()) {
      const data = snap.data() as UserProfile;
      return {
        ...data,
        role: isAdminEmail ? 'admin' : data.role,
      };
    }

    const initialProfile: UserProfile = {
      uid: firebaseUser.uid,
      email: (firebaseUser.email || `${firebaseUser.uid}@creator.local`).slice(0, 200),
      displayName: (firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Creator').slice(0, 100),
      ...(firebaseUser.photoURL ? { photoURL: firebaseUser.photoURL.slice(0, 500) } : {}),
      role: 'creator',
      plan: 'free',
      preferredLanguage: 'en',
      theme: 'light',
      charactersCount: 0,
      projectsCount: 0,
      videosCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(userRef, initialProfile);
    return {
      ...initialProfile,
      role: isAdminEmail ? 'admin' : 'creator',
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, userPath);
  }
}

export async function updateUserProfileFields(
  uid: string,
  updates: Partial<Pick<UserProfile, 'displayName' | 'preferredLanguage' | 'theme' | 'charactersCount' | 'projectsCount' | 'videosCount'>>
): Promise<void> {
  const path = `users/${uid}`;
  try {
    const ref = doc(db, 'users', uid);
    await updateDoc(ref, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

// Characters
export function subscribeCharacters(
  uid: string,
  onData: (items: CartoonCharacter[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'characters';
  const q = query(collection(db, path), where('ownerId', '==', uid), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as CartoonCharacter));
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export async function createCharacterDoc(
  uid: string,
  char: Omit<CartoonCharacter, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>
): Promise<CartoonCharacter> {
  const id = makeSafeId('char');
  const path = `characters/${id}`;
  try {
    const payload: CartoonCharacter = {
      id,
      ownerId: uid,
      name: char.name.slice(0, 80),
      style: char.style,
      voiceStyle: char.voiceStyle,
      voiceName: char.voiceName,
      ...(char.personality ? { personality: char.personality.slice(0, 300) } : {}),
      ...(char.facialTraits ? { facialTraits: char.facialTraits.slice(0, 1000) } : {}),
      ...(char.sourceImageUrl ? { sourceImageUrl: char.sourceImageUrl.slice(0, 500) } : {}),
      cartoonImageUrl: char.cartoonImageUrl.slice(0, 500),
      ...(char.accentColor ? { accentColor: char.accentColor.slice(0, 20) } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'characters', id), payload);
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateCharacterDoc(
  id: string,
  updates: Partial<Pick<CartoonCharacter, 'name' | 'style' | 'voiceStyle' | 'voiceName' | 'personality' | 'cartoonImageUrl'>>
): Promise<void> {
  const path = `characters/${id}`;
  try {
    await updateDoc(doc(db, 'characters', id), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteCharacterDoc(id: string): Promise<void> {
  const path = `characters/${id}`;
  try {
    await deleteDoc(doc(db, 'characters', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// Projects & Scenes
export function subscribeProjects(
  uid: string,
  onData: (items: StoryProject[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'projects';
  const q = query(collection(db, path), where('ownerId', '==', uid), orderBy('updatedAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as StoryProject));
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export async function createProjectWithScenes(
  uid: string,
  projectData: Omit<StoryProject, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
  scenesInput: Array<Omit<StoryScene, 'id' | 'projectId' | 'ownerId' | 'updatedAt'>>
): Promise<{ project: StoryProject; scenes: StoryScene[] }> {
  const projectId = makeSafeId('proj');
  const projectPath = `projects/${projectId}`;
  try {
    const projectPayload: StoryProject = {
      id: projectId,
      ownerId: uid,
      title: projectData.title.slice(0, 140),
      ...(projectData.titleHindi ? { titleHindi: projectData.titleHindi.slice(0, 160) } : {}),
      ...(projectData.moralOrSummary ? { moralOrSummary: projectData.moralOrSummary.slice(0, 600) } : {}),
      language: projectData.language,
      genre: projectData.genre,
      durationMinutes: projectData.durationMinutes,
      aspectRatio: projectData.aspectRatio,
      quality: projectData.quality,
      status: projectData.status,
      ...(projectData.bgmMood ? { bgmMood: projectData.bgmMood.slice(0, 120) } : {}),
      ...(projectData.bgmAudioUrl ? { bgmAudioUrl: projectData.bgmAudioUrl.slice(0, 500) } : {}),
      musicVolume: projectData.musicVolume ?? 0.25,
      voiceVolume: projectData.voiceVolume ?? 1,
      sceneCount: scenesInput.length,
      characterIds: (projectData.characterIds || []).slice(0, 10),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Write parent project first so Firestore rules `exists()` passes for subcollection scenes
    await setDoc(doc(db, 'projects', projectId), projectPayload);

    const savedScenes: StoryScene[] = [];
    for (let i = 0; i < scenesInput.length; i++) {
      const s = scenesInput[i];
      const sceneId = makeSafeId(`sc${i}`);
      const scenePayload: StoryScene = {
        id: sceneId,
        projectId,
        ownerId: uid,
        orderIndex: i,
        act: s.act,
        title: s.title.slice(0, 140),
        ...(s.visualPrompt ? { visualPrompt: s.visualPrompt.slice(0, 1000) } : {}),
        ...(s.cameraMovement ? { cameraMovement: s.cameraMovement.slice(0, 60) } : {}),
        ...(s.transition ? { transition: s.transition.slice(0, 40) } : {}),
        ...(s.backgroundMood ? { backgroundMood: s.backgroundMood.slice(0, 60) } : {}),
        ...(s.characterName ? { characterName: s.characterName.slice(0, 80) } : {}),
        ...(s.characterId ? { characterId: s.characterId.slice(0, 128) } : {}),
        ...(s.speakerVoiceStyle ? { speakerVoiceStyle: s.speakerVoiceStyle } : {}),
        ...(s.voiceName ? { voiceName: s.voiceName } : {}),
        dialogueHindi: (s.dialogueHindi || '').slice(0, 1000),
        dialogueEnglish: (s.dialogueEnglish || '').slice(0, 1000),
        durationSec: Math.min(120, Math.max(1, Number(s.durationSec) || 8)),
        ...(s.frameImageUrl ? { frameImageUrl: s.frameImageUrl.slice(0, 500) } : {}),
        ...(s.audioUrl ? { audioUrl: s.audioUrl.slice(0, 500) } : {}),
        ...(s.videoUrl ? { videoUrl: s.videoUrl.slice(0, 500) } : {}),
        animationStatus: s.animationStatus || 'pending',
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'projects', projectId, 'scenes', sceneId), scenePayload);
      savedScenes.push(scenePayload);
    }

    return { project: projectPayload, scenes: savedScenes };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, projectPath);
  }
}

export async function updateProjectDoc(
  projectId: string,
  updates: Partial<Pick<StoryProject, 'title' | 'titleHindi' | 'moralOrSummary' | 'aspectRatio' | 'quality' | 'status' | 'bgmMood' | 'bgmAudioUrl' | 'musicVolume' | 'voiceVolume' | 'sceneCount' | 'characterIds'>>
): Promise<void> {
  const path = `projects/${projectId}`;
  try {
    await updateDoc(doc(db, 'projects', projectId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteProjectDoc(projectId: string): Promise<void> {
  const path = `projects/${projectId}`;
  try {
    const scenesSnap = await getDocs(collection(db, 'projects', projectId, 'scenes'));
    await Promise.all(scenesSnap.docs.map((d) => deleteDoc(d.ref)));
    await deleteDoc(doc(db, 'projects', projectId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export function subscribeScenes(
  projectId: string,
  onData: (scenes: StoryScene[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = `projects/${projectId}/scenes`;
  const q = query(collection(db, 'projects', projectId, 'scenes'), orderBy('orderIndex', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as StoryScene));
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export async function saveSceneDoc(
  projectId: string,
  scene: StoryScene
): Promise<void> {
  const path = `projects/${projectId}/scenes/${scene.id}`;
  try {
    const ref = doc(db, 'projects', projectId, 'scenes', scene.id);
    const existing = await getDoc(ref);
    const sanitized = {
      orderIndex: scene.orderIndex,
      act: scene.act,
      title: scene.title.slice(0, 140),
      ...(scene.visualPrompt !== undefined ? { visualPrompt: scene.visualPrompt.slice(0, 1000) } : {}),
      ...(scene.cameraMovement !== undefined ? { cameraMovement: scene.cameraMovement.slice(0, 60) } : {}),
      ...(scene.transition !== undefined ? { transition: scene.transition.slice(0, 40) } : {}),
      ...(scene.backgroundMood !== undefined ? { backgroundMood: scene.backgroundMood.slice(0, 60) } : {}),
      ...(scene.characterName !== undefined ? { characterName: scene.characterName.slice(0, 80) } : {}),
      ...(scene.characterId !== undefined ? { characterId: scene.characterId.slice(0, 128) } : {}),
      ...(scene.speakerVoiceStyle !== undefined ? { speakerVoiceStyle: scene.speakerVoiceStyle } : {}),
      ...(scene.voiceName !== undefined ? { voiceName: scene.voiceName } : {}),
      dialogueHindi: scene.dialogueHindi.slice(0, 1000),
      dialogueEnglish: scene.dialogueEnglish.slice(0, 1000),
      durationSec: Math.min(120, Math.max(1, Number(scene.durationSec) || 8)),
      ...(scene.frameImageUrl !== undefined ? { frameImageUrl: scene.frameImageUrl.slice(0, 500) } : {}),
      ...(scene.audioUrl !== undefined ? { audioUrl: scene.audioUrl.slice(0, 500) } : {}),
      ...(scene.videoUrl !== undefined ? { videoUrl: scene.videoUrl.slice(0, 500) } : {}),
      animationStatus: scene.animationStatus,
      updatedAt: serverTimestamp(),
    };

    if (existing.exists()) {
      await updateDoc(ref, sanitized);
    } else {
      await setDoc(ref, {
        ...sanitized,
        id: scene.id,
        projectId,
        ownerId: scene.ownerId,
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteSceneDoc(projectId: string, sceneId: string): Promise<void> {
  const path = `projects/${projectId}/scenes/${sceneId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId, 'scenes', sceneId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// Exported Videos
export function subscribeVideos(
  uid: string,
  onData: (videos: ExportedVideo[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'videos';
  const q = query(collection(db, path), where('ownerId', '==', uid), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as ExportedVideo));
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export async function createVideoDoc(
  uid: string,
  video: Omit<ExportedVideo, 'id' | 'ownerId' | 'createdAt'>
): Promise<ExportedVideo> {
  const id = makeSafeId('vid');
  const path = `videos/${id}`;
  try {
    const payload: ExportedVideo = {
      id,
      ownerId: uid,
      projectId: video.projectId,
      title: video.title.slice(0, 140),
      ...(video.language ? { language: video.language } : {}),
      aspectRatio: video.aspectRatio,
      quality: video.quality,
      durationSec: Math.max(1, Number(video.durationSec) || 5),
      ...(video.fileSizeBytes !== undefined ? { fileSizeBytes: Math.round(video.fileSizeBytes) } : {}),
      ...(video.format ? { format: video.format.slice(0, 20) } : {}),
      downloadUrl: video.downloadUrl.slice(0, 500),
      ...(video.thumbnailUrl ? { thumbnailUrl: video.thumbnailUrl.slice(0, 500) } : {}),
      createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'videos', id), payload);
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function deleteVideoDoc(videoId: string): Promise<void> {
  const path = `videos/${videoId}`;
  try {
    await deleteDoc(doc(db, 'videos', videoId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// Usage Logs
export async function logUsage(
  uid: string,
  userEmail: string | undefined,
  entry: Omit<UsageLog, 'id' | 'ownerId' | 'userEmail' | 'createdAt'>
): Promise<void> {
  const id = makeSafeId('log');
  const path = `usageLogs/${id}`;
  try {
    await setDoc(doc(db, 'usageLogs', id), {
      id,
      ownerId: uid,
      ...(userEmail ? { userEmail: userEmail.slice(0, 200) } : {}),
      feature: entry.feature,
      model: entry.model.slice(0, 100),
      status: entry.status,
      durationMs: Math.max(0, Math.round(entry.durationMs)),
      ...(entry.errorMessage ? { errorMessage: entry.errorMessage.slice(0, 500) } : {}),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Usage log write skipped:', err);
  }
}

export function subscribeUserUsageLogs(
  uid: string,
  onData: (logs: UsageLog[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'usageLogs'),
    where('ownerId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(25)
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as UsageLog)),
    (err) => console.warn('Usage log listener warning:', err)
  );
}

// Templates
export function subscribeTemplates(
  onData: (templates: FeaturedTemplate[]) => void
): Unsubscribe {
  const q = query(collection(db, 'templates'), orderBy('updatedAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as FeaturedTemplate)),
    (err) => console.warn('Templates listener warning:', err)
  );
}

// Admin queries
export async function adminFetchOverview(): Promise<{
  users: UserProfile[];
  projects: StoryProject[];
  logs: UsageLog[];
}> {
  try {
    const [usersSnap, projSnap, logsSnap] = await Promise.all([
      getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(50))),
      getDocs(query(collection(db, 'projects'), orderBy('updatedAt', 'desc'), limit(50))),
      getDocs(query(collection(db, 'usageLogs'), orderBy('createdAt', 'desc'), limit(100))),
    ]);
    return {
      users: usersSnap.docs.map((d) => d.data() as UserProfile),
      projects: projSnap.docs.map((d) => d.data() as StoryProject),
      logs: logsSnap.docs.map((d) => d.data() as UsageLog),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'admin/overview');
  }
}

export async function adminUpdateUserPlan(uid: string, plan: 'free' | 'pro' | 'studio'): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      plan,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function adminSaveTemplate(
  template: Omit<FeaturedTemplate, 'id' | 'updatedAt'> & { id?: string }
): Promise<void> {
  const id = template.id && isValidFirestoreId(template.id) ? template.id : makeSafeId('tpl');
  const path = `templates/${id}`;
  try {
    await setDoc(doc(db, 'templates', id), {
      id,
      title: template.title.slice(0, 120),
      genre: template.genre,
      language: template.language,
      prompt: template.prompt.slice(0, 600),
      active: Boolean(template.active),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function adminDeleteTemplate(id: string): Promise<void> {
  const path = `templates/${id}`;
  try {
    await deleteDoc(doc(db, 'templates', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}
