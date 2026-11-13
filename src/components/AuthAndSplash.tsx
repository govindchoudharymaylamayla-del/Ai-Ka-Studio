import { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import {
  Check,
  Clapperboard,
  Copy,
  Download,
  Globe,
  Loader2,
  LogIn,
  Mail,
  Smartphone,
} from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import type { LanguageCode } from '../types/studio';
import { t } from '../i18n/translations';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { SafeImage } from './SafeImage';

export function SplashScreen({
  language,
  onContinue,
}: {
  language: LanguageCode;
  onContinue: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onContinue, 1400);
    return () => window.clearTimeout(timer);
  }, [onContinue]);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-orange-600 flex items-center justify-center mb-6 shadow-lg shadow-orange-600/20">
        <Clapperboard className="w-8 h-8 text-white" />
      </div>
      <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-white">
        {t(language, 'brand')}
      </h1>
      <p className="mt-2 text-sm text-stone-400 max-w-md">
        Photo to Cartoon · Hindi & English Stories · Animated Studio
      </p>
      <div className="mt-8 flex items-center gap-4">
        <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
        <button
          type="button"
          onClick={onContinue}
          className="text-xs font-medium text-stone-300 hover:text-white underline underline-offset-4 min-h-[44px] px-3"
        >
          Enter Studio
        </button>
      </div>
    </div>
  );
}

export function AuthScreen({
  language,
  onToggleLanguage,
}: {
  language: LanguageCode;
  onToggleLanguage: (lang: LanguageCode) => void;
}) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showApkGuide, setShowApkGuide] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  async function handleGoogleLogin() {
    setBusy(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google Sign-In failed.';
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) {
          await updateProfile(cred.user, { displayName: name.trim() });
        }
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      if (raw.includes('operation-not-allowed')) {
        setError(
          'Email/Password login is not enabled yet in your Firebase Console (Authentication > Sign-in method). Please use "Continue with Google" right above, or enable Email/Password in Firebase Console.'
        );
      } else {
        setError(raw);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 grid lg:grid-cols-2">
      {/* Left Studio Visual Showcase */}
      <div className="relative hidden lg:flex flex-col justify-end p-12 bg-stone-900 overflow-hidden">
        <SafeImage
          src="/src/assets/images/hero_studio_backdrop_1794597394457.jpg"
          alt="KathaToon Animation Studio Desk"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/20" />
        <div className="relative z-10 max-w-lg text-white">
          <p className="text-xs font-medium text-orange-300 mb-3">
            Character Studio · Hindi Voices · Video Editor
          </p>
          <h2 className="text-3xl font-display font-bold leading-tight">
            {t(language, 'heroTitle')}
          </h2>
          <p className="mt-3 text-sm text-stone-200 leading-relaxed">
            {t(language, 'heroSubtitle')}
          </p>
        </div>
      </div>

      {/* Right Authentication Form */}
      <div className="flex flex-col justify-between p-6 sm:p-12 max-w-lg w-full mx-auto">
        <div className="flex items-center justify-between">
          <span className="text-lg font-display font-bold tracking-tight">
            {t(language, 'brand')}
          </span>
          <button
            type="button"
            onClick={() => onToggleLanguage(language === 'en' ? 'hi' : 'en')}
            className="min-h-[44px] px-3 py-2 flex items-center gap-2 text-xs font-medium text-stone-600 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white border border-stone-200 dark:border-stone-800 rounded-lg"
          >
            <Globe className="w-4 h-4" />
            <span>{language === 'en' ? 'हिन्दी' : 'English'}</span>
          </button>
        </div>

        <div className="my-auto py-8 bg-white dark:bg-stone-900/90 border border-stone-200/90 dark:border-stone-800 rounded-2xl p-6 sm:p-8 shadow-sm">
          <h1 className="text-2xl sm:text-3xl font-display font-bold">
            {t(language, 'loginTitle')}
          </h1>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
            {t(language, 'loginSubtitle')}
          </p>

          <button
            type="button"
            disabled={busy}
            onClick={handleGoogleLogin}
            className="mt-6 w-full min-h-[48px] px-5 py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2.5 transition-colors"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            <span>{t(language, 'continueGoogle')}</span>
          </button>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
            <span className="text-xs text-stone-500">or email</span>
            <div className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
          </div>

          <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-stone-950 rounded-lg mb-5">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 min-h-[40px] text-xs font-semibold rounded-md transition-colors ${
                mode === 'login'
                  ? 'bg-white dark:bg-stone-800 text-stone-950 dark:text-white shadow-sm'
                  : 'text-stone-600 dark:text-stone-400'
              }`}
            >
              {t(language, 'signInEmail')}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
              className={`flex-1 min-h-[40px] text-xs font-semibold rounded-md transition-colors ${
                mode === 'signup'
                  ? 'bg-white dark:bg-stone-800 text-stone-950 dark:text-white shadow-sm'
                  : 'text-stone-600 dark:text-stone-400'
              }`}
            >
              {t(language, 'signUpEmail')}
            </button>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                  Creator Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Aarav Sharma"
                  className="w-full min-h-[44px] px-3.5 py-2.5 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl text-sm focus:outline-2 focus:outline-orange-600"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="creator@example.com"
                className="w-full min-h-[44px] px-3.5 py-2.5 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl text-sm focus:outline-2 focus:outline-orange-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full min-h-[44px] px-3.5 py-2.5 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl text-sm focus:outline-2 focus:outline-orange-600"
              />
            </div>

            {error && (
              <div role="alert" className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full min-h-[46px] px-4 py-2.5 border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <Mail className="w-4 h-4" />
              <span>{mode === 'login' ? t(language, 'signInEmail') : t(language, 'signUpEmail')}</span>
            </button>
          </form>

          {/* Android App / APK Download & Install Block */}
          {!isInstalled && (
            <div className="mt-6 pt-5 border-t border-stone-200 dark:border-stone-800">
              <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-600/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-display font-bold text-stone-900 dark:text-white">
                      {language === 'hi' ? 'मोबाइल ऐप इंस्टॉल करें (Android / APK)' : 'Get KathaToon Mobile App (Android / APK)'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed">
                      {language === 'hi'
                        ? 'सीधे फ़ोन पर WebAPK के रूप में इंस्टॉल करें या Bubblewrap Android APK मैनिफ़ेस्ट डाउनलोड करें।'
                        : 'Install directly as a native Android WebAPK or download the Bubblewrap TWA manifest to build a signed APK.'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (isInstallable) {
                        await install();
                      } else {
                        setShowApkGuide((prev) => !prev);
                      }
                    }}
                    className="flex-1 min-w-[150px] min-h-[42px] px-3.5 py-2 bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-stone-200 text-white dark:text-stone-950 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>
                      {isInstallable
                        ? language === 'hi'
                          ? 'Android ऐप इंस्टॉल करें'
                          : 'Install Android App'
                        : language === 'hi'
                          ? 'APK / ऐप इंस्टॉल गाइड'
                          : 'Download / Install App'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const origin = window.location.origin;
                      const host = window.location.host;
                      const twaManifest = {
                        packageId: 'com.kathatoon.studio',
                        host,
                        name: 'KathaToon Studio',
                        launcherName: 'KathaToon',
                        display: 'standalone',
                        themeColor: '#EA580C',
                        navigationColor: '#0C0A09',
                        backgroundColor: '#0C0A09',
                        startUrl: '/',
                        iconUrl: `${origin}/pwa-512x512.png`,
                        maskableIconUrl: `${origin}/pwa-maskable-512x512.png`,
                        appVersionName: '1.0.0',
                        appVersionCode: 1,
                        webManifestUrl: `${origin}/manifest.webmanifest`,
                        generatorApp: 'bubblewrap-cli',
                      };
                      const blob = new Blob([JSON.stringify(twaManifest, null, 2)], {
                        type: 'application/json',
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'twa-manifest.json';
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="min-h-[42px] px-3.5 py-2 border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-900 text-stone-800 dark:text-stone-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>APK Config</span>
                  </button>
                </div>

                {showApkGuide && (
                  <div className="p-3 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-[11px] text-stone-600 dark:text-stone-300 space-y-2">
                    {isIOS ? (
                      <p>
                        {language === 'hi'
                          ? 'iPhone / iPad पर: Safari में Share बटन दबाएँ और "Add to Home Screen" चुनें।'
                          : 'On iPhone / iPad: Tap the Share button in Safari, then choose "Add to Home Screen".'}
                      </p>
                    ) : (
                      <p>
                        {language === 'hi'
                          ? 'Android Chrome में यह URL खोलें और ब्राउज़र मेनू (⋮) → "Install app" चुनें ताकि फ़ोन पर असली WebAPK इंस्टॉल हो सके।'
                          : 'Open this URL directly in Android Chrome and tap Menu (⋮) → "Install app" to mint & install the native Android WebAPK, or build a sideloadable .apk with `npx @bubblewrap/cli init` using the downloaded twa-manifest.json.'}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(window.location.origin);
                          setCopiedUrl(true);
                          window.setTimeout(() => setCopiedUrl(false), 2000);
                        } catch {
                          setCopiedUrl(false);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 text-orange-600 dark:text-orange-400 font-semibold hover:underline"
                    >
                      {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedUrl ? 'App URL Copied' : 'Copy App URL for Mobile Chrome'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-stone-500">
          Firebase Auth & Firestore · Secured Creator Workspace
        </p>
      </div>
    </div>
  );
}
