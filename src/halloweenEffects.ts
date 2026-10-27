/**
 * PR Phantom — Interactive Halloween Theme & Animations
 * Features:
 * - Web Audio API synthesized soundscapes (no audio files required)
 * - Canvas ambient ethereal wisps & cursor particle trail
 * - Interactive hanging spider with elastic web physics
 * - Clickable moon that unleashes flying bats
 * - Jack-o'-lantern mascot ("Phantom Bob") with spooky code review tips
 * - Halloween confetti pops on guess reveals
 * - Hunk spotlight & interactive diff sync
 */

// ── Sound Synthesizer (Web Audio API) ──────────────────────────────────────

let audioCtx: AudioContext | null = null;
let soundEnabled = true;

function getAudioContext(): AudioContext | null {
  if (!audioCtx && typeof window !== 'undefined') {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function setSoundEnabled(enabled: boolean) {
  soundEnabled = enabled;
  try {
    localStorage.setItem('pr_phantom_sound', enabled ? '1' : '0');
  } catch {
    // ignore
  }
}

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

/** Ethereal chime for hover/interact */
export function playEtherealChime(freq = 587.33) {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.3);

  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.6);
}

/** Potion bubble pop sound for loading */
export function playBubbleSound() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  const startFreq = 220 + Math.random() * 200;
  osc.type = 'sine';
  osc.frequency.setValueAtTime(startFreq, now);
  osc.frequency.exponentialRampToValueAtTime(startFreq * 2.2, now + 0.12);

  gain.gain.setValueAtTime(0.09, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.15);
}

/** Spooky gust / swoosh for bats or button click */
export function playSwooshSound() {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  // White noise via buffer
  const bufferSize = ctx.sampleRate * 0.3;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(400, now);
  filter.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
  filter.frequency.exponentialRampToValueAtTime(300, now + 0.3);
  filter.Q.value = 3;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.12, now + 0.12);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
  noise.stop(now + 0.3);
}

/** Celebration chime for guess reveal */
export function playRevealChime() {
  if (!soundEnabled) return;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
  notes.forEach((freq, idx) => {
    setTimeout(() => {
      playEtherealChime(freq);
    }, idx * 75);
  });
}

// ── Particle Canvas System (Ambient + Cursor Trail) ─────────────────────────

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  decay: number;
  type: 'ember' | 'wisp' | 'spark';
}

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
const particles: Particle[] = [];
let particlesEnabled = true;
let animFrameId: number | null = null;
const colors = [
  '#ff7200', // pumpkin orange
  '#ff9640', // light pumpkin
  '#c4a6ff', // ethereal lavender
  '#9b6dff', // deep purple
  '#f8f4ff', // ghost white
  '#7ee787', // toxic green
];

export function initCanvasParticles(canvasElement: HTMLCanvasElement) {
  canvas = canvasElement;
  ctx = canvas.getContext('2d');
  if (!ctx) return;

  function resize() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // Spawn background ambient embers
  for (let i = 0; i < 25; i++) {
    spawnAmbientEmber(true);
  }

  // Cursor move handler
  let lastMove = 0;
  window.addEventListener('mousemove', (e) => {
    if (!particlesEnabled) return;
    const now = performance.now();
    if (now - lastMove > 25) {
      lastMove = now;
      addCursorWisp(e.clientX, e.clientY);
    }
  });

  // Click burst
  window.addEventListener('click', (e) => {
    if (!particlesEnabled) return;
    addClickBurst(e.clientX, e.clientY);
  });

  startRenderLoop();
}

function spawnAmbientEmber(randomY = false) {
  if (!canvas) return;
  particles.push({
    x: Math.random() * canvas.width,
    y: randomY ? Math.random() * canvas.height : canvas.height + 10,
    vx: (Math.random() - 0.5) * 0.6,
    vy: -0.4 - Math.random() * 0.8,
    radius: 1 + Math.random() * 2.2,
    color: colors[Math.floor(Math.random() * colors.length)],
    alpha: 0.2 + Math.random() * 0.5,
    decay: 0.001 + Math.random() * 0.002,
    type: 'ember',
  });
}

function addCursorWisp(x: number, y: number) {
  particles.push({
    x: x + (Math.random() - 0.5) * 8,
    y: y + (Math.random() - 0.5) * 8,
    vx: (Math.random() - 0.5) * 1.2,
    vy: -0.8 - Math.random() * 1.2,
    radius: 2 + Math.random() * 3,
    color: colors[Math.floor(Math.random() * colors.length)],
    alpha: 0.8,
    decay: 0.025 + Math.random() * 0.02,
    type: 'wisp',
  });
}

export function addClickBurst(x: number, y: number) {
  for (let i = 0; i < 16; i++) {
    const angle = (Math.PI * 2 * i) / 16 + (Math.random() - 0.5) * 0.2;
    const speed = 1.5 + Math.random() * 3.5;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 2 + Math.random() * 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      decay: 0.02 + Math.random() * 0.02,
      type: 'spark',
    });
  }
}

function startRenderLoop() {
  function loop() {
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Keep ambient embers populated
    if (particlesEnabled && particles.filter((p) => p.type === 'ember').length < 25) {
      spawnAmbientEmber();
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;

      if (p.alpha <= 0 || p.y < -20 || p.x < -20 || p.x > canvas.width + 20) {
        particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = p.type === 'wisp' ? 8 : 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    animFrameId = requestAnimationFrame(loop);
  }
  if (!animFrameId) {
    animFrameId = requestAnimationFrame(loop);
  }
}

export function setParticlesEnabled(enabled: boolean) {
  particlesEnabled = enabled;
  if (!enabled) {
    particles.length = 0;
  }
}

// ── Interactive Swarm of Bats ───────────────────────────────────────────────

export function summonBatSwarm(originX?: number, originY?: number) {
  playSwooshSound();

  const count = 10;
  const startX = originX ?? window.innerWidth * 0.5;
  const startY = originY ?? 120;

  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      createFlyingBat(startX, startY);
    }, i * 90);
  }
}

function createFlyingBat(startX: number, startY: number) {
  const bat = document.createElement('div');
  bat.className = 'interactive-flying-bat';
  bat.innerHTML = `
    <svg viewBox="0 0 48 30" width="36" height="24">
      <path class="bat-wings" fill="#2d1260" stroke="#c4a6ff" stroke-width="1.2" d="M24,14 C18,2 6,4 1,13 C7,17 14,13 18,17 C19,23 23,26 24,28 C25,26 29,23 30,17 C34,13 41,17 47,13 C42,4 30,2 24,14 Z" />
      <circle cx="21" cy="15" r="1.5" fill="#ff7200" />
      <circle cx="27" cy="15" r="1.5" fill="#ff7200" />
    </svg>
  `;

  // Random trajectory
  const angle = (Math.random() - 0.5) * 1.2 - Math.PI / 2; // generally upward/outward
  const distance = 400 + Math.random() * 500;
  const duration = 2.2 + Math.random() * 1.5;
  const targetX = startX + Math.sin(angle) * distance;
  const targetY = startY + Math.cos(angle) * -distance;
  const scale = 0.7 + Math.random() * 0.6;

  bat.style.left = `${startX}px`;
  bat.style.top = `${startY}px`;
  bat.style.transform = `scale(${scale})`;
  bat.style.transition = `transform ${duration}s cubic-bezier(0.2, 0.8, 0.4, 1), opacity ${duration}s ease-in`;

  document.body.appendChild(bat);

  // Trigger flight on next animation frame
  requestAnimationFrame(() => {
    bat.style.transform = `translate(${targetX - startX}px, ${targetY - startY}px) scale(${scale * 0.5}) rotate(${(Math.random() - 0.5) * 50}deg)`;
    bat.style.opacity = '0';
  });

  setTimeout(() => {
    bat.remove();
  }, duration * 1000 + 100);
}

// ── Interactive Hanging Spider ──────────────────────────────────────────────

export function setupInteractiveSpider(container: HTMLElement) {
  const spiderEl = document.createElement('div');
  spiderEl.className = 'hanging-spider';
  spiderEl.setAttribute('role', 'button');
  spiderEl.setAttribute('tabindex', '0');
  spiderEl.setAttribute('aria-label', 'Interactive Spider — click to make it drop!');
  spiderEl.title = 'Click or tap me! 🕷️';

  spiderEl.innerHTML = `
    <div class="spider-thread"></div>
    <div class="spider-body-wrap">
      <svg class="spider-svg" viewBox="0 0 60 70" width="46" height="54">
        <!-- Silk anchor -->
        <circle cx="30" cy="4" r="3" fill="#ffffff" opacity="0.4" />
        <!-- Legs (left) -->
        <path class="spider-leg leg-l1" d="M26,32 Q10,18 2,24" stroke="#a04a00" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path class="spider-leg leg-l2" d="M25,36 Q8,32 4,40" stroke="#a04a00" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path class="spider-leg leg-l3" d="M26,40 Q10,48 6,56" stroke="#a04a00" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path class="spider-leg leg-l4" d="M28,44 Q14,62 10,70" stroke="#a04a00" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <!-- Legs (right) -->
        <path class="spider-leg leg-r1" d="M34,32 Q50,18 58,24" stroke="#a04a00" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path class="spider-leg leg-r2" d="M35,36 Q52,32 56,40" stroke="#a04a00" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path class="spider-leg leg-r3" d="M34,40 Q50,48 54,56" stroke="#a04a00" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path class="spider-leg leg-r4" d="M32,44 Q46,62 50,70" stroke="#a04a00" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <!-- Abdomen -->
        <ellipse cx="30" cy="44" rx="14" ry="17" fill="#1e0a3c" stroke="#ff7200" stroke-width="2"/>
        <ellipse cx="30" cy="44" rx="9" ry="11" fill="#2d1260"/>
        <!-- Thorax -->
        <ellipse cx="30" cy="28" rx="8" ry="7" fill="#14141f" stroke="#ff7200" stroke-width="1.5"/>
        <!-- Glowing eyes -->
        <circle cx="27" cy="26" r="2" fill="#ff7200" class="spider-eye"/>
        <circle cx="33" cy="26" r="2" fill="#ff7200" class="spider-eye"/>
        <circle cx="24" cy="29" r="1.3" fill="#ffaa00"/>
        <circle cx="36" cy="29" r="1.3" fill="#ffaa00"/>
      </svg>
      <div class="spider-speech" id="spider-speech">Boo! 🕷️</div>
    </div>
  `;

  let isDropping = false;
  const triggerDrop = () => {
    if (isDropping) return;
    isDropping = true;
    spiderEl.classList.add('spider--dropped');
    playEtherealChime(784);

    const speech = spiderEl.querySelector('.spider-speech') as HTMLElement;
    if (speech) {
      const messages = ['Boo! 🕷️', 'Checked your diff! 🕸️', 'No bugs here! 🎃', 'Spooky code! 👻', 'Trick or treat! 🍬'];
      speech.textContent = messages[Math.floor(Math.random() * messages.length)];
      speech.classList.add('spider-speech--visible');
    }

    setTimeout(() => {
      spiderEl.classList.remove('spider--dropped');
      if (speech) speech.classList.remove('spider-speech--visible');
      setTimeout(() => {
        isDropping = false;
      }, 700);
    }, 1800);
  };

  spiderEl.addEventListener('click', triggerDrop);
  spiderEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      triggerDrop();
    }
  });

  container.appendChild(spiderEl);
}

// ── Interactive Jack-O'-Lantern Companion (Phantom Bob) ─────────────────────

const SPOOKY_TIPS = [
  "🎃 Bob says: Small PRs under 200 lines are 3x less likely to hide scary bugs!",
  "👻 Bob whispers: Writing clear commit messages wards off evil merge conflicts!",
  "🧙 Bob's advice: Ask 'Why was this changed?' before asking 'How does it work?'",
  "🦇 Bob chuckles: What do ghosts put in their code? Boolean logic! 👻",
  "🍬 Bob offers a treat: Click on 'See in diff' to jump right to the matching code hunk!",
  "🕷️ Bob warns: Watch out for secret hardcoded passwords lurking in the dark!",
  "🔮 Bob foresees: A clean code review in your near future!",
  "🎃 Bob's pun: Why did the JavaScript developer wear glasses? Because they didn't C#! 😂",
];

export function setupPumpkinMascot(targetContainer: HTMLElement) {
  const mascot = document.createElement('div');
  mascot.className = 'phantom-mascot';
  mascot.setAttribute('role', 'button');
  mascot.setAttribute('tabindex', '0');
  mascot.setAttribute('aria-label', "Phantom Bob — Click for code review tips and spooky jokes!");
  mascot.title = "Click me for a review tip or joke! 🎃";

  mascot.innerHTML = `
    <div class="mascot-pumpkin-wrap">
      <svg class="mascot-svg" viewBox="0 0 100 95" width="68" height="65">
        <!-- Stem -->
        <path d="M48,15 Q50,2 62,5 Q55,14 51,18 Z" fill="#2ea043" stroke="#1b6329" stroke-width="1.5"/>
        <!-- Pumpkin Body -->
        <ellipse cx="50" cy="55" rx="36" ry="32" fill="#ff7200" stroke="#a04a00" stroke-width="2.5"/>
        <ellipse cx="32" cy="55" rx="20" ry="29" fill="#ff7e15" opacity="0.8"/>
        <ellipse cx="68" cy="55" rx="20" ry="29" fill="#ff7e15" opacity="0.8"/>
        <ellipse cx="50" cy="55" rx="14" ry="28" fill="#ff9640" opacity="0.6"/>
        <!-- Candlelit Eyes -->
        <polygon class="jack-glow eye-left" points="33,42 43,47 36,52" fill="#fff5b8"/>
        <polygon class="jack-glow eye-right" points="67,42 57,47 64,52" fill="#fff5b8"/>
        <!-- Nose -->
        <polygon class="jack-glow nose" points="50,49 46,55 54,55" fill="#fff5b8"/>
        <!-- Mouth -->
        <path class="jack-glow mouth" d="M30,64 Q50,84 70,64 Q64,72 58,66 Q52,74 46,67 Q40,73 30,64 Z" fill="#fff5b8"/>
      </svg>
      <span class="mascot-badge">Click me!</span>
    </div>
    <div class="mascot-speech-bubble" id="mascot-speech">
      <span class="mascot-speech-close">✕</span>
      <p id="mascot-text">🎃 Hi! I'm <strong>Phantom Bob</strong>. Click me anytime for code review tips and spooky jokes!</p>
    </div>
  `;

  let tipIndex = 0;
  const showNextTip = () => {
    playEtherealChime(659.25);
    mascot.classList.add('mascot--talking');
    const speech = mascot.querySelector('#mascot-speech') as HTMLElement;
    const text = mascot.querySelector('#mascot-text') as HTMLElement;

    speech.classList.add('mascot-speech--open');
    text.textContent = SPOOKY_TIPS[tipIndex % SPOOKY_TIPS.length];
    tipIndex++;

    addClickBurst(mascot.getBoundingClientRect().left + 35, mascot.getBoundingClientRect().top + 30);

    setTimeout(() => {
      mascot.classList.remove('mascot--talking');
    }, 600);
  };

  mascot.addEventListener('click', (e) => {
    // If clicking close button
    if ((e.target as HTMLElement).classList.contains('mascot-speech-close')) {
      const speech = mascot.querySelector('#mascot-speech') as HTMLElement;
      speech.classList.remove('mascot-speech--open');
      return;
    }
    showNextTip();
  });

  mascot.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      showNextTip();
    }
  });

  targetContainer.appendChild(mascot);
}

// ── Confetti Burst for Guess Reveal ─────────────────────────────────────────

export function setupGuessRevealCelebration() {
  document.addEventListener('toggle', (e) => {
    const target = e.target as HTMLElement;
    if (target && target.classList && target.classList.contains('guess-reveal')) {
      const details = target as HTMLDetailsElement;
      if (details.open) {
        playRevealChime();
        const rect = details.getBoundingClientRect();
        burstHalloweenConfetti(rect.left + rect.width / 2, rect.top + 20);
      }
    }
  }, true);
}

function burstHalloweenConfetti(x: number, y: number) {
  const emojis = ['🎃', '👻', '🍬', '✨', '🦇', '🕷️', '🌟', '🍫'];
  const count = 14;

  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'halloween-confetti';
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];

    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
    const distance = 60 + Math.random() * 90;
    const endX = Math.cos(angle) * distance;
    const endY = Math.sin(angle) * distance - 30; // slight upward bias
    const duration = 0.9 + Math.random() * 0.5;

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.setProperty('--tx', `${endX}px`);
    el.style.setProperty('--ty', `${endY}px`);
    el.style.setProperty('--rot', `${(Math.random() - 0.5) * 540}deg`);
    el.style.animationDuration = `${duration}s`;

    document.body.appendChild(el);

    setTimeout(() => {
      el.remove();
    }, duration * 1000 + 50);
  }
}

// ── Moon Click Handler ──────────────────────────────────────────────────────

export function setupInteractiveMoon(moonEl: HTMLElement) {
  moonEl.setAttribute('role', 'button');
  moonEl.setAttribute('tabindex', '0');
  moonEl.setAttribute('aria-label', 'Interactive Moon — Click to summon a flock of bats!');
  moonEl.title = 'Click the moon to summon bats! 🌕🦇';

  const trigger = (e: MouseEvent | KeyboardEvent) => {
    const rect = moonEl.getBoundingClientRect();
    const x = 'clientX' in e && e.clientX ? e.clientX : rect.left + rect.width / 2;
    const y = 'clientY' in e && e.clientY ? e.clientY : rect.top + rect.height / 2;

    moonEl.classList.add('moon--howl');
    summonBatSwarm(x, y);

    setTimeout(() => {
      moonEl.classList.remove('moon--howl');
    }, 1200);
  };

  moonEl.addEventListener('click', trigger);
  moonEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      trigger(e);
    }
  });
}
