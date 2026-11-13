import type {
  CartoonCharacter,
  CartoonStyle,
  StoryProject,
  StoryScene,
  SubtitleMode,
  VideoAspectRatio,
  VideoQuality,
} from '../types/studio';

export async function loadHtmlImage(src: string): Promise<HTMLImageElement | null> {
  if (!src) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Applies a real Canvas2D posterized toon + edge-ink shader to an uploaded portrait photo
 * so users always receive a stylized cartoon asset when AI image generation is unavailable
 * or while previewing locally.
 */
export async function renderStylizedCartoonPortrait(
  sourceUrl: string,
  style: CartoonStyle,
  accentColor = '#EA580C'
): Promise<string> {
  const img = await loadHtmlImage(sourceUrl);
  if (!img) return sourceUrl;

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return sourceUrl;

  // Center-crop square
  const minSide = Math.min(img.width, img.height);
  const sx = (img.width - minSide) / 2;
  const sy = (img.height - minSide) / 2;

  // Soft studio backdrop ring
  const grad = ctx.createRadialGradient(size * 0.5, size * 0.42, 40, size * 0.5, size * 0.5, size * 0.72);
  grad.addColorStop(0, '#FFF7ED');
  grad.addColorStop(1, accentColor + '33');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Draw source photo into offscreen buffer for cel-shading & edge detection
  const off = document.createElement('canvas');
  off.width = size;
  off.height = size;
  const octx = off.getContext('2d');
  if (!octx) return sourceUrl;
  octx.filter = style === '3d' || style === 'pixar'
    ? 'saturate(1.28) contrast(1.12) brightness(1.04)'
    : style === 'anime'
      ? 'saturate(1.38) contrast(1.18) brightness(1.06)'
      : 'saturate(1.2) contrast(1.32) brightness(1.02)';
  octx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

  const imgData = octx.getImageData(0, 0, size, size);
  const data = imgData.data;
  const copy = new Uint8ClampedArray(data);

  const levels = style === 'comic' ? 5 : style === 'anime' ? 6 : 8;
  const step = 255 / levels;

  // Posterize + subtle ink edge pass
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const idx = (y * size + x) * 4;
      const r = copy[idx];
      const g = copy[idx + 1];
      const b = copy[idx + 2];

      // Quantize colors into smooth cartoon bands
      let qr = Math.round(r / step) * step;
      let qg = Math.round(g / step) * step;
      let qb = Math.round(b / step) * step;

      if (style === 'pixar' || style === '3d') {
        // Warm subsurface tint
        qr = Math.min(255, qr * 1.04 + 6);
        qg = Math.min(255, qg * 1.01 + 2);
      }

      // Simple Sobel gradient for crisp ink outlines on Anime & Comic
      const idxRight = (y * size + (x + 1)) * 4;
      const idxDown = ((y + 1) * size + x) * 4;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const lumR = 0.299 * copy[idxRight] + 0.587 * copy[idxRight + 1] + 0.114 * copy[idxRight + 2];
      const lumD = 0.299 * copy[idxDown] + 0.587 * copy[idxDown + 1] + 0.114 * copy[idxDown + 2];
      const edge = Math.abs(lum - lumR) + Math.abs(lum - lumD);

      const threshold = style === 'comic' ? 26 : style === 'anime' ? 32 : 48;
      if (edge > threshold) {
        const inkStrength = style === 'comic' ? 0.85 : style === 'anime' ? 0.72 : 0.35;
        data[idx] = qr * (1 - inkStrength) + 28 * inkStrength;
        data[idx + 1] = qg * (1 - inkStrength) + 25 * inkStrength;
        data[idx + 2] = qb * (1 - inkStrength) + 23 * inkStrength;
      } else {
        data[idx] = qr;
        data[idx + 1] = qg;
        data[idx + 2] = qb;
      }
    }
  }

  octx.putImageData(imgData, 0, 0);

  // Composite with clean rounded frame & rim highlight
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(16, 16, size - 32, size - 32, 36);
  ctx.clip();
  ctx.drawImage(off, 0, 0);

  // Subtle rim light
  const rim = ctx.createLinearGradient(0, 0, size, size);
  rim.addColorStop(0, 'rgba(255,255,255,0.22)');
  rim.addColorStop(0.5, 'rgba(255,255,255,0)');
  rim.addColorStop(1, accentColor + '2A');
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  return canvas.toDataURL('image/png');
}

const MOOD_PALETTES: Record<string, { skyTop: string; skyBottom: string; ground: string; hill: string; accent: string; stars: boolean }> = {
  sunny_village: { skyTop: '#38BDF8', skyBottom: '#FEF3C7', ground: '#84CC16', hill: '#65A30D', accent: '#F59E0B', stars: false },
  cozy_home: { skyTop: '#FDE68A', skyBottom: '#FFEDD5', ground: '#B45309', hill: '#92400E', accent: '#EA580C', stars: false },
  enchanted_forest: { skyTop: '#0F766E', skyBottom: '#A7F3D0', ground: '#15803D', hill: '#166534', accent: '#34D399', stars: false },
  starry_night: { skyTop: '#0F172A', skyBottom: '#312E81', ground: '#1E293B', hill: '#334155', accent: '#FBBF24', stars: true },
  vibrant_market: { skyTop: '#FB923C', skyBottom: '#FEF08A', ground: '#C2410C', hill: '#9A3412', accent: '#F43F5E', stars: false },
  school_courtyard: { skyTop: '#60A5FA', skyBottom: '#E0F2FE', ground: '#D97706', hill: '#16A34A', accent: '#2563EB', stars: false },
};

function wrapTextLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

export function drawAnimatedSceneFrame(params: {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  scene: StoryScene;
  character?: CartoonCharacter;
  frameImg?: HTMLImageElement | null;
  charImg?: HTMLImageElement | null;
  elapsedInScene: number;
  audioAmplitude: number;
  subtitleMode: SubtitleMode;
  transitionAlpha?: number;
}) {
  const {
    ctx,
    width,
    height,
    scene,
    character,
    frameImg,
    charImg,
    elapsedInScene,
    audioAmplitude,
    subtitleMode,
    transitionAlpha = 1,
  } = params;

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  const duration = Math.max(1, scene.durationSec || 8);
  const progress = Math.min(1, Math.max(0, elapsedInScene / duration));

  // Camera transforms
  let scale = 1.0;
  let panX = 0;
  let panY = 0;
  const cam = scene.cameraMovement || 'zoom-in';
  if (cam === 'zoom-in') scale = 1.0 + progress * 0.08;
  else if (cam === 'zoom-out') scale = 1.08 - progress * 0.08;
  else if (cam === 'pan-left') {
    scale = 1.06;
    panX = (0.5 - progress) * width * 0.05;
  } else if (cam === 'pan-right') {
    scale = 1.06;
    panX = (progress - 0.5) * width * 0.05;
  } else if (cam === 'tilt-up') {
    scale = 1.05;
    panY = (0.5 - progress) * height * 0.04;
  }

  ctx.save();
  ctx.translate(width / 2 + panX, height / 2 + panY);
  ctx.scale(scale, scale);
  ctx.translate(-width / 2, -height / 2);

  if (frameImg) {
    // Draw AI-generated scene frame cover-fit
    const imgRatio = frameImg.width / frameImg.height;
    const canvasRatio = width / height;
    let dw = width;
    let dh = height;
    if (imgRatio > canvasRatio) {
      dw = height * imgRatio;
    } else {
      dh = width / imgRatio;
    }
    ctx.drawImage(frameImg, (width - dw) / 2, (height - dh) / 2, dw, dh);
  } else {
    // Rich layered cartoon studio scenery
    const palette = MOOD_PALETTES[scene.backgroundMood || 'sunny_village'] || MOOD_PALETTES.sunny_village;
    const sky = ctx.createLinearGradient(0, 0, 0, height * 0.72);
    sky.addColorStop(0, palette.skyTop);
    sky.addColorStop(1, palette.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    if (palette.stars) {
      ctx.fillStyle = '#FEF9C3';
      for (let i = 0; i < 28; i++) {
        const sx = ((i * 197) % width);
        const sy = ((i * 113) % (height * 0.55));
        const twinkle = 1.5 + Math.sin(elapsedInScene * 3 + i) * 1.2;
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(0.8, twinkle), 0, Math.PI * 2);
        ctx.fill();
      }
      // Crescent moon
      ctx.fillStyle = '#FDE68A';
      ctx.beginPath();
      ctx.arc(width * 0.82, height * 0.18, Math.min(width, height) * 0.07, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Glowing sun + drifting cartoon clouds
      ctx.fillStyle = palette.accent + '44';
      ctx.beginPath();
      ctx.arc(width * 0.82, height * 0.19, Math.min(width, height) * 0.11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(width * 0.82, height * 0.19, Math.min(width, height) * 0.065, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (let c = 0; c < 3; c++) {
        const cx = ((c * width * 0.38 + elapsedInScene * (12 + c * 4)) % (width + 180)) - 90;
        const cy = height * (0.14 + c * 0.08);
        ctx.beginPath();
        ctx.arc(cx, cy, width * 0.04, 0, Math.PI * 2);
        ctx.arc(cx + width * 0.035, cy - 8, width * 0.048, 0, Math.PI * 2);
        ctx.arc(cx + width * 0.07, cy, width * 0.038, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Rolling cartoon hills
    ctx.fillStyle = palette.hill;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.68);
    ctx.quadraticCurveTo(width * 0.25, height * 0.56, width * 0.55, height * 0.66);
    ctx.quadraticCurveTo(width * 0.82, height * 0.74, width, height * 0.6);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    // Foreground stage floor
    ctx.fillStyle = palette.ground;
    ctx.fillRect(0, height * 0.72, width, height * 0.28);

    // Stylized trees/props
    const treePositions = [0.12, 0.88];
    for (const txRatio of treePositions) {
      const tx = width * txRatio;
      const ty = height * 0.72;
      ctx.fillStyle = '#78350F';
      ctx.fillRect(tx - width * 0.012, ty - height * 0.14, width * 0.024, height * 0.14);
      ctx.fillStyle = palette.accent;
      ctx.beginPath();
      ctx.arc(tx, ty - height * 0.16, width * 0.048, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw animated Character Rig / Portrait with breathing bob, blink, and lip-sync
  const bobY = Math.sin(elapsedInScene * 3.2) * (height * 0.012) - audioAmplitude * (height * 0.018);
  const charCenterX = width * 0.5;
  const charBaseY = height * 0.74 + bobY;
  const portraitSize = Math.min(width, height) * (width > height ? 0.44 : 0.48);

  if (charImg && !frameImg) {
    // Framed character cutout with expressive speaking glow & lip-sync indicator
    const px = charCenterX - portraitSize / 2;
    const py = charBaseY - portraitSize * 0.85;

    ctx.save();
    // Soft character drop shadow on stage
    ctx.fillStyle = 'rgba(0,0,0,0.24)';
    ctx.beginPath();
    ctx.ellipse(charCenterX, height * 0.76, portraitSize * 0.34, portraitSize * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();

    // Speaking aura pulse driven by real WAV audio amplitude
    if (audioAmplitude > 0.05) {
      ctx.strokeStyle = character?.accentColor || '#EA580C';
      ctx.lineWidth = 4 + audioAmplitude * 8;
      ctx.beginPath();
      ctx.roundRect(px - 6, py - 6, portraitSize + 12, portraitSize + 12, 34);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.roundRect(px, py, portraitSize, portraitSize, 30);
    ctx.clip();
    ctx.drawImage(charImg, px, py, portraitSize, portraitSize);
    ctx.restore();

    // Animated cartoon lip-sync mouth indicator badge below portrait when speaking
    const mouthOpen = Math.min(1, audioAmplitude * 2.4);
    const blink = (elapsedInScene % 3.6) > 3.45;
    const rigX = charCenterX + portraitSize * 0.36;
    const rigY = py + portraitSize * 0.16;
    ctx.save();
    ctx.fillStyle = 'rgba(28, 25, 23, 0.82)';
    ctx.beginPath();
    ctx.arc(rigX, rigY, portraitSize * 0.1, 0, Math.PI * 2);
    ctx.fill();
    // Mini animated eyes + lip-sync mouth
    ctx.fillStyle = '#FFFFFF';
    if (blink) {
      ctx.fillRect(rigX - 8, rigY - 5, 5, 1.5);
      ctx.fillRect(rigX + 3, rigY - 5, 5, 1.5);
    } else {
      ctx.beginPath();
      ctx.arc(rigX - 5.5, rigY - 5, 2.5, 0, Math.PI * 2);
      ctx.arc(rigX + 5.5, rigY - 5, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#FB923C';
    ctx.beginPath();
    ctx.ellipse(rigX, rigY + 5, 6, 1.8 + mouthOpen * 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (!frameImg) {
    // Full procedural 2D cartoon character rig with blinking & lip-sync!
    const headR = portraitSize * 0.28;
    const headY = charBaseY - portraitSize * 0.56;
    const accent = character?.accentColor || '#EA580C';

    // Body
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(charCenterX - headR * 0.9, headY + headR * 0.85, headR * 1.8, headR * 1.5, 28);
    ctx.fill();

    // Head
    ctx.fillStyle = '#FDBA74';
    ctx.beginPath();
    ctx.arc(charCenterX, headY, headR, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = '#1C1917';
    ctx.beginPath();
    ctx.arc(charCenterX, headY - headR * 0.22, headR * 1.02, Math.PI, 0);
    ctx.fill();

    // Blinking Eyes
    const isBlinking = (elapsedInScene % 3.4) > 3.25;
    ctx.fillStyle = '#1C1917';
    if (isBlinking) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#1C1917';
      ctx.beginPath();
      ctx.moveTo(charCenterX - headR * 0.45, headY - headR * 0.05);
      ctx.lineTo(charCenterX - headR * 0.2, headY - headR * 0.05);
      ctx.moveTo(charCenterX + headR * 0.2, headY - headR * 0.05);
      ctx.lineTo(charCenterX + headR * 0.45, headY - headR * 0.05);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(charCenterX - headR * 0.34, headY - headR * 0.05, headR * 0.16, 0, Math.PI * 2);
      ctx.arc(charCenterX + headR * 0.34, headY - headR * 0.05, headR * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1C1917';
      ctx.beginPath();
      ctx.arc(charCenterX - headR * 0.34, headY - headR * 0.05, headR * 0.08, 0, Math.PI * 2);
      ctx.arc(charCenterX + headR * 0.34, headY - headR * 0.05, headR * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }

    // Audio-driven lip-sync mouth
    const openH = Math.max(3, audioAmplitude * headR * 0.45);
    ctx.fillStyle = '#991B1B';
    ctx.beginPath();
    ctx.ellipse(charCenterX, headY + headR * 0.42, headR * 0.26, openH, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore(); // end camera transform

  // Scrim + Bilingual Subtitles
  if (subtitleMode !== 'off') {
    const scrimH = height * 0.28;
    const scrim = ctx.createLinearGradient(0, height - scrimH, 0, height);
    scrim.addColorStop(0, 'rgba(0,0,0,0)');
    scrim.addColorStop(0.45, 'rgba(0,0,0,0.62)');
    scrim.addColorStop(1, 'rgba(0,0,0,0.88)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, height - scrimH, width, scrimH);

    const fontSize = Math.round(Math.min(width, height) * 0.036);
    const subSize = Math.round(fontSize * 0.82);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Speaker kicker
    if (scene.characterName) {
      ctx.font = `600 ${Math.round(subSize * 0.88)}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = '#FDBA74';
      ctx.fillText(scene.characterName.toUpperCase(), width / 2, height - scrimH * 0.72);
    }

    const showHi = subtitleMode === 'hi' || subtitleMode === 'both';
    const showEn = subtitleMode === 'en' || subtitleMode === 'both';

    let yCursor = height - scrimH * 0.46;
    if (showHi && scene.dialogueHindi) {
      ctx.font = `600 ${fontSize}px "Noto Sans Devanagari", "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = '#FFFFFF';
      const lines = wrapTextLines(ctx, scene.dialogueHindi, width * 0.84);
      for (const line of lines) {
        ctx.fillText(line, width / 2, yCursor);
        yCursor += fontSize * 1.25;
      }
    }
    if (showEn && scene.dialogueEnglish) {
      ctx.font = `500 ${subSize}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = showHi ? '#E7E5E4' : '#FFFFFF';
      const lines = wrapTextLines(ctx, scene.dialogueEnglish, width * 0.84);
      for (const line of lines) {
        ctx.fillText(line, width / 2, yCursor);
        yCursor += subSize * 1.25;
      }
    }
  }

  // Transition veil
  if (transitionAlpha < 1) {
    ctx.fillStyle = `rgba(12, 10, 9, ${Math.max(0, 1 - transitionAlpha)})`;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.restore();
}

export class StudioAudioEngine {
  private ctx: AudioContext | null = null;
  private bgmNodes: AudioNode[] = [];
  private bgmGain: GainNode | null = null;

  private ensureContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  playSfx(type: 'chime' | 'whoosh' | 'sparkle' | 'chuckle') {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'chime') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.25);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc.start(now);
      osc.stop(now + 0.6);
    } else if (type === 'sparkle') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1760, now + 0.22);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.45);
    } else if (type === 'chuckle') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(330, now);
      osc.frequency.setValueAtTime(440, now + 0.1);
      osc.frequency.setValueAtTime(392, now + 0.2);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.38);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.35);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      osc.start(now);
      osc.stop(now + 0.38);
    }
  }

  startProceduralBgm(mood: string, volume = 0.2) {
    this.stopProceduralBgm();
    const ctx = this.ensureContext();
    const master = ctx.createGain();
    master.gain.value = Math.max(0.02, Math.min(0.5, volume));
    master.connect(ctx.destination);
    this.bgmGain = master;

    // Pentatonic Indian/cartoon melody loop
    const scales: Record<string, number[]> = {
      comedy: [261.63, 329.63, 392.0, 523.25, 392.0, 329.63],
      adventure: [293.66, 369.99, 440.0, 587.33, 440.0, 369.99],
      mystery: [220.0, 261.63, 311.13, 392.0, 311.13, 261.63],
      family: [261.63, 293.66, 329.63, 392.0, 440.0, 392.0],
    };
    const notes = scales[mood] || scales.family;
    let step = 0;

    const timer = window.setInterval(() => {
      if (!this.ctx || !this.bgmGain || this.ctx.state === 'closed') return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(notes[step % notes.length], now);
      g.gain.setValueAtTime(0.18, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(g);
      g.connect(this.bgmGain);
      osc.start(now);
      osc.stop(now + 0.48);
      step++;
    }, 520);

    this.bgmNodes.push({
      disconnect: () => window.clearInterval(timer),
    } as unknown as AudioNode);
  }

  stopProceduralBgm() {
    for (const n of this.bgmNodes) {
      try {
        n.disconnect();
      } catch {
        // ignore
      }
    }
    this.bgmNodes = [];
    if (this.bgmGain) {
      try {
        this.bgmGain.disconnect();
      } catch {
        // ignore
      }
      this.bgmGain = null;
    }
  }
}

export async function exportProjectVideoWebM(params: {
  project: StoryProject;
  scenes: StoryScene[];
  characters: CartoonCharacter[];
  quality: VideoQuality;
  aspectRatio: VideoAspectRatio;
  subtitleMode: SubtitleMode;
  musicVolume: number;
  voiceVolume: number;
  onProgress: (pct: number, label: string) => void;
}): Promise<{ blob: Blob; durationSec: number; mimeType: string }> {
  const {
    project,
    scenes,
    characters,
    quality,
    aspectRatio,
    subtitleMode,
    musicVolume,
    voiceVolume,
    onProgress,
  } = params;

  const is720 = quality === '720p';
  const width = aspectRatio === '16:9' ? (is720 ? 1280 : 1920) : (is720 ? 720 : 1080);
  const height = aspectRatio === '16:9' ? (is720 ? 720 : 1080) : (is720 ? 1280 : 1920);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is unavailable in this browser.');

  onProgress(5, 'Preloading scene artwork and character portraits...');

  const charImgMap = new Map<string, HTMLImageElement | null>();
  for (const c of characters) {
    charImgMap.set(c.id, await loadHtmlImage(c.cartoonImageUrl));
  }

  const sceneFrameMap = new Map<string, HTMLImageElement | null>();
  for (const s of scenes) {
    if (s.frameImageUrl) {
      sceneFrameMap.set(s.id, await loadHtmlImage(s.frameImageUrl));
    }
  }

  // Prepare WebAudio mix destination
  const audioCtx = new AudioContext();
  const dest = audioCtx.createMediaStreamDestination();
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  const freqData = new Uint8Array(analyser.frequencyBinCount);

  const voiceGain = audioCtx.createGain();
  voiceGain.gain.value = voiceVolume;
  voiceGain.connect(analyser);
  voiceGain.connect(dest);

  const bgmGain = audioCtx.createGain();
  bgmGain.gain.value = musicVolume * 0.35;
  bgmGain.connect(dest);

  // Pre-decode WAV voiceovers per scene
  const sceneAudioBuffers = new Map<string, AudioBuffer | null>();
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    if (s.audioUrl) {
      try {
        const resp = await fetch(s.audioUrl);
        if (resp.ok) {
          const arr = await resp.arrayBuffer();
          const decoded = await audioCtx.decodeAudioData(arr);
          sceneAudioBuffers.set(s.id, decoded);
        }
      } catch {
        sceneAudioBuffers.set(s.id, null);
      }
    }
  }

  // Optional Lyria BGM audio buffer
  let bgmBuffer: AudioBuffer | null = null;
  if (project.bgmAudioUrl) {
    try {
      const resp = await fetch(project.bgmAudioUrl);
      if (resp.ok) {
        bgmBuffer = await audioCtx.decodeAudioData(await resp.arrayBuffer());
      }
    } catch {
      bgmBuffer = null;
    }
  }

  const canvasStream = canvas.captureStream(30);
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);

  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
    ? 'video/webm;codecs=vp9,opus'
    : 'video/webm';

  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: is720 ? 3_500_000 : 6_000_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const stopPromise = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: mimeType }));
    };
  });

  // Start BGM (either Lyria track or gentle procedural chord pulse)
  let bgmSource: AudioBufferSourceNode | null = null;
  let bgmPulseTimer: number | null = null;
  if (bgmBuffer) {
    bgmSource = audioCtx.createBufferSource();
    bgmSource.buffer = bgmBuffer;
    bgmSource.loop = true;
    bgmSource.connect(bgmGain);
    bgmSource.start();
  } else if (musicVolume > 0.01) {
    const notes = [261.63, 329.63, 392.0, 523.25, 392.0, 329.63];
    let step = 0;
    bgmPulseTimer = window.setInterval(() => {
      if (audioCtx.state !== 'running') return;
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(notes[step % notes.length], now);
      g.gain.setValueAtTime(0.16, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(g);
      g.connect(bgmGain);
      osc.start(now);
      osc.stop(now + 0.48);
      step++;
    }, 520);
  }

  recorder.start(250);

  const totalDuration = scenes.reduce((acc, s) => acc + Math.max(2, s.durationSec), 0);
  let elapsedTotal = 0;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const character = characters.find((c) => c.id === scene.characterId || c.name === scene.characterName);
    const charImg = character ? charImgMap.get(character.id) || null : null;
    const frameImg = sceneFrameMap.get(scene.id) || null;

    const audioBuf = sceneAudioBuffers.get(scene.id) || null;
    const sceneDuration = Math.max(2.5, audioBuf ? Math.max(scene.durationSec, audioBuf.duration + 0.6) : scene.durationSec);

    if (audioBuf) {
      const src = audioCtx.createBufferSource();
      src.buffer = audioBuf;
      src.connect(voiceGain);
      src.start();
    }

    const sceneStart = performance.now();
    await new Promise<void>((resolveScene) => {
      const renderTick = () => {
        const elapsedSec = (performance.now() - sceneStart) / 1000;
        if (elapsedSec >= sceneDuration) {
          resolveScene();
          return;
        }

        analyser.getByteTimeDomainData(freqData);
        let sum = 0;
        for (let k = 0; k < freqData.length; k++) {
          const v = (freqData[k] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.min(1, Math.sqrt(sum / freqData.length) * 3.5);
        const fade = elapsedSec < 0.35 ? elapsedSec / 0.35 : elapsedSec > sceneDuration - 0.3 ? (sceneDuration - elapsedSec) / 0.3 : 1;

        drawAnimatedSceneFrame({
          ctx,
          width,
          height,
          scene,
          character,
          frameImg,
          charImg,
          elapsedInScene: elapsedSec,
          audioAmplitude: audioBuf ? rms : Math.abs(Math.sin(elapsedSec * 7)) * 0.25,
          subtitleMode,
          transitionAlpha: Math.max(0.05, Math.min(1, fade)),
        });

        const pct = Math.min(96, Math.round(((elapsedTotal + elapsedSec) / Math.max(1, totalDuration)) * 90) + 6);
        onProgress(pct, `Rendering Scene ${i + 1}/${scenes.length}: ${scene.title}`);
        requestAnimationFrame(renderTick);
      };
      requestAnimationFrame(renderTick);
    });

    elapsedTotal += sceneDuration;
  }

  onProgress(98, 'Finalizing video container...');
  if (bgmPulseTimer !== null) window.clearInterval(bgmPulseTimer);
  if (bgmSource) {
    try {
      bgmSource.stop();
    } catch {
      // ignore
    }
  }
  recorder.stop();
  const blob = await stopPromise;
  await audioCtx.close();

  onProgress(100, 'Export complete!');
  return { blob, durationSec: Math.round(elapsedTotal), mimeType };
}
