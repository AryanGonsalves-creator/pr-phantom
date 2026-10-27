import './style.css';
import { parseDiff, type ParsedDiff, type DiffFile } from './diffParser';
import { SAMPLE_DIFF } from './sampleDiff';
import { DIFF_PRESETS, type DiffPreset } from './diffLibrary';
import {
  autoAuditDiff,
  saveChecklist,
  loadSavedChecklistOverrides,
  generateGitHubPRComment,
  calculateRiskAssessment,
  type SmartChecklistItem,
} from './reviewToolkit';
import {
  initCanvasParticles,
  setupInteractiveSpider,
  setupPumpkinMascot,
  setupInteractiveMoon,
  setupGuessRevealCelebration,
  summonBatSwarm,
  playEtherealChime,
  playBubbleSound,
  playSwooshSound,
  playRevealChime,
  setSoundEnabled,
  setParticlesEnabled,
} from './halloweenEffects';

// ── Types ──────────────────────────────────────────────────────────────────

interface GemmaChange {
  hunkId?: string;
  title: string;
  whatChanged: string;
  whyItMatters: string;
  reviewerQuestion: string;
  guess: string;
  needsMoreContext?: boolean;
}

interface GemmaResult {
  overview: string;
  changes: GemmaChange[];
  generalTips: string[];
}

interface HealthResponse {
  ok: boolean;
  provider: string;
  configured?: boolean;
  ollamaConnected: boolean;
  ollamaUrl: string;
  model: string;
  availableModels: string[];
  modelInstalled: boolean;
}

interface HistoryItem {
  timestamp: number;
  preview: string;
  filesCount: number;
  diff: string;
}

// ── App State ──────────────────────────────────────────────────────────────

let aiProvider = 'ollama';
let currentParsed: ParsedDiff | null = null;
let currentResult: GemmaResult | null = null;
let ollamaModel = 'gemma4:e2b';
let ollamaUrl = 'http://127.0.0.1:11434';
let bubblingInterval: number | null = null;
let checklistItems: SmartChecklistItem[] = [];
let currentChecklistFilter: 'all' | 'passed' | 'warning' = 'all';
let expandedCardId: string | null = null;
let activePresetId: string | null = null;

// ── DOM References ─────────────────────────────────────────────────────────

const diffInput = document.getElementById('diff-input') as HTMLTextAreaElement;
const explainBtn = document.getElementById('explain-btn') as HTMLButtonElement;
const sampleBtn = document.getElementById('sample-btn') as HTMLButtonElement;
const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement;
const fileList = document.getElementById('file-list') as HTMLDivElement;
const patchTrail = document.getElementById('patch-trail') as HTMLDivElement;
const statusBar = document.getElementById('status-bar') as HTMLDivElement;
const diffHighlightArea = document.getElementById('diff-highlight-area') as HTMLDivElement;
const statsBar = document.getElementById('stats-bar') as HTMLDivElement;
const ollamaStatusBanner = document.getElementById('ollama-status-banner') as HTMLDivElement;
const ollamaDot = document.getElementById('ollama-dot') as HTMLSpanElement;
const ollamaStatusText = document.getElementById('ollama-status-text') as HTMLSpanElement;
const ollamaModelBadge = document.getElementById('ollama-model-badge') as HTMLSpanElement;
const charCount = document.getElementById('char-count') as HTMLSpanElement;

// Sidebars & Toolkit Elements
const sidebarLeft = document.getElementById('sidebar-left') as HTMLElement;
const sidebarRight = document.getElementById('sidebar-right') as HTMLElement;
const toggleLeftSidebarBtn = document.getElementById('toggle-left-sidebar-btn') as HTMLButtonElement;
const toggleRightSidebarBtn = document.getElementById('toggle-right-sidebar-btn') as HTMLButtonElement;
const closeLeftSidebarBtn = document.getElementById('close-left-sidebar-btn') as HTMLButtonElement;
const closeRightSidebarBtn = document.getElementById('close-right-sidebar-btn') as HTMLButtonElement;
const sidebarBackdrop = document.getElementById('sidebar-backdrop') as HTMLElement;

const diffPresetsList = document.getElementById('diff-presets-list') as HTMLDivElement;
const sidebarFilesList = document.getElementById('sidebar-files-list') as HTMLDivElement;
const sidebarFilesFilter = document.getElementById('sidebar-files-filter') as HTMLInputElement;
const sidebarFilesCount = document.getElementById('sidebar-files-count') as HTMLSpanElement;
const sidebarHistoryList = document.getElementById('sidebar-history-list') as HTMLDivElement;
const clearHistoryBtn = document.getElementById('clear-history-btn') as HTMLButtonElement;

const riskGaugeLevel = document.getElementById('risk-gauge-level') as HTMLSpanElement;
const riskGaugeReasons = document.getElementById('risk-gauge-reasons') as HTMLUListElement;

// Smart Checklist DOM References
const autoScanBtn = document.getElementById('auto-scan-btn') as HTMLButtonElement;
const readinessBadge = document.getElementById('readiness-badge') as HTMLSpanElement;
const checklistContainer = document.getElementById('checklist-items-container') as HTMLDivElement;
const checklistProgressFill = document.getElementById('checklist-progress-fill') as HTMLDivElement;
const checklistProgressLabel = document.getElementById('checklist-progress-label') as HTMLSpanElement;
const resetChecklistBtn = document.getElementById('reset-checklist-btn') as HTMLButtonElement;
const countAll = document.getElementById('count-all') as HTMLSpanElement;
const countPassed = document.getElementById('count-passed') as HTMLSpanElement;
const countWarning = document.getElementById('count-warning') as HTMLSpanElement;

const copyPRCommentBtn = document.getElementById('copy-pr-comment-btn') as HTMLButtonElement;
const togglePreviewBtn = document.getElementById('toggle-preview-btn') as HTMLButtonElement;
const prExportPreview = document.getElementById('pr-export-preview') as HTMLDivElement;
const prExportTextarea = document.getElementById('pr-export-textarea') as HTMLTextAreaElement;
const toastNotification = document.getElementById('toast-notification') as HTMLDivElement;

// ── Initialise ─────────────────────────────────────────────────────────────

async function init() {
  initHalloweenInteractions();
  initSidebars();
  initPresetsList();
  initChecklist();
  initHistory();
  await checkHealth();

  sampleBtn.addEventListener('click', loadSample);
  clearBtn.addEventListener('click', clearAll);
  explainBtn.addEventListener('click', explainDiff);
  diffInput.addEventListener('input', onInputChange);

  // Scroll to hunk when input changes (live parse)
  diffInput.addEventListener('input', liveparse);

  // File search filter in left sidebar
  sidebarFilesFilter?.addEventListener('input', () => {
    if (currentParsed && currentParsed.isValid) {
      renderSidebarFiles(currentParsed);
    }
  });

  // Export action handlers
  copyPRCommentBtn?.addEventListener('click', copyPRComment);
  togglePreviewBtn?.addEventListener('click', togglePRPreview);
  clearHistoryBtn?.addEventListener('click', clearHistory);
}

// ── Sidebar Controls ───────────────────────────────────────────────────────

function initSidebars() {
  toggleLeftSidebarBtn?.addEventListener('click', () => toggleSidebar('left'));
  toggleRightSidebarBtn?.addEventListener('click', () => toggleSidebar('right'));

  closeLeftSidebarBtn?.addEventListener('click', () => setSidebarCollapsed('left', true));
  closeRightSidebarBtn?.addEventListener('click', () => setSidebarCollapsed('right', true));

  sidebarBackdrop?.addEventListener('click', () => {
    setSidebarCollapsed('left', true);
    setSidebarCollapsed('right', true);
  });

  // On smaller viewports, default to collapsed
  if (window.innerWidth < 1200) {
    setSidebarCollapsed('left', true, false);
    setSidebarCollapsed('right', true, false);
  }
}

function toggleSidebar(side: 'left' | 'right') {
  const el = side === 'left' ? sidebarLeft : sidebarRight;
  const isCollapsed = el.classList.contains('app-sidebar--collapsed');
  setSidebarCollapsed(side, !isCollapsed);
}

function setSidebarCollapsed(side: 'left' | 'right', collapse: boolean, playAudio = true) {
  const el = side === 'left' ? sidebarLeft : sidebarRight;
  const btn = side === 'left' ? toggleLeftSidebarBtn : toggleRightSidebarBtn;

  if (collapse) {
    el.classList.add('app-sidebar--collapsed');
    btn?.classList.remove('fx-btn--active');
    btn?.setAttribute('aria-pressed', 'false');
  } else {
    el.classList.remove('app-sidebar--collapsed');
    btn?.classList.add('fx-btn--active');
    btn?.setAttribute('aria-pressed', 'true');
    if (playAudio) playEtherealChime(side === 'left' ? 700 : 850);
  }

  // Handle backdrop on mobile
  if (window.innerWidth < 1200) {
    const leftOpen = !sidebarLeft.classList.contains('app-sidebar--collapsed');
    const rightOpen = !sidebarRight.classList.contains('app-sidebar--collapsed');
    sidebarBackdrop.classList.toggle('sidebar-backdrop--visible', leftOpen || rightOpen);
  }
}

// ── Presets Library ────────────────────────────────────────────────────────

function initPresetsList() {
  if (!diffPresetsList) return;

  diffPresetsList.innerHTML = DIFF_PRESETS.map((p: DiffPreset) => `
    <button class="diff-preset-card" type="button" data-preset-id="${p.id}" title="${escHtml(p.description)}">
      <div class="diff-preset-card__top">
        <span class="diff-preset-card__title">${p.icon} ${escHtml(p.name)}</span>
        <span class="preset-category-tag preset-category-tag--${p.category}">${p.category}</span>
      </div>
      <p class="diff-preset-card__desc">${escHtml(p.description)}</p>
    </button>
  `).join('');

  diffPresetsList.querySelectorAll('.diff-preset-card').forEach((card) => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-preset-id');
      const preset = DIFF_PRESETS.find((p) => p.id === id);
      if (preset) {
        loadPresetDiff(preset);
      }
    });
  });
}

function loadPresetDiff(preset: DiffPreset) {
  activePresetId = preset.id;
  diffPresetsList.querySelectorAll('.diff-preset-card').forEach((c) => {
    c.classList.toggle('diff-preset-card--active', c.getAttribute('data-preset-id') === preset.id);
  });

  playEtherealChime(620);
  diffInput.value = preset.diff;
  onInputChange();
  liveparse();

  showToast(`Loaded "${preset.name}" preset! 🎃`);
  showStatus(`Loaded preset "${preset.name}". Click "Explain this diff" to analyze it.`, 'info');

  // Close sidebar on mobile
  if (window.innerWidth < 1200) {
    setSidebarCollapsed('left', true);
  }
}

// ── Changed Files Mini-Map ─────────────────────────────────────────────────

function renderSidebarFiles(parsed: ParsedDiff) {
  if (!sidebarFilesList) return;

  const filter = (sidebarFilesFilter?.value || '').toLowerCase().trim();
  const filtered = parsed.files.filter((f) => f.filename.toLowerCase().includes(filter));

  if (sidebarFilesCount) {
    sidebarFilesCount.textContent = `${parsed.files.length}`;
  }

  if (filtered.length === 0) {
    sidebarFilesList.innerHTML = `<p class="sidebar-empty">${filter ? 'No matching files found' : 'No changed files'}</p>`;
    return;
  }

  sidebarFilesList.innerHTML = filtered.map((f: DiffFile) => {
    return `
      <div class="sidebar-file-item" data-filename="${escHtml(f.filename)}" title="Jump to ${escHtml(f.filename)} in diff">
        <span class="sidebar-file-name">${escHtml(f.filename)}</span>
        <span class="sidebar-file-stats">
          <span class="add">+${f.additions}</span>
          <span class="del">-${f.deletions}</span>
        </span>
      </div>
    `;
  }).join('');

  // Add click to jump listeners
  sidebarFilesList.querySelectorAll('.sidebar-file-item').forEach((item) => {
    item.addEventListener('click', () => {
      const filename = item.getAttribute('data-filename');
      if (filename) {
        playEtherealChime(640);
        const headers = Array.from(document.querySelectorAll('.diff-file-header'));
        const match = headers.find((h) => h.textContent?.includes(filename));
        if (match) {
          match.scrollIntoView({ behavior: 'smooth', block: 'center' });
          match.classList.add('header--highlight');
          setTimeout(() => match.classList.remove('header--highlight'), 1800);
        }
      }
    });
  });
}

// ── Recent Diffs History ───────────────────────────────────────────────────

function initHistory() {
  renderHistory();
}

function saveDiffToHistory(rawDiff: string, filesCount: number) {
  try {
    const existing: HistoryItem[] = JSON.parse(localStorage.getItem('pr_phantom_history') || '[]');
    const filtered = existing.filter((h) => h.diff.trim() !== rawDiff.trim());
    const firstLine = rawDiff.split('\n').find((l) => l.trim().length > 0) || 'Custom diff';
    filtered.unshift({
      timestamp: Date.now(),
      preview: firstLine.slice(0, 40),
      filesCount,
      diff: rawDiff,
    });
    localStorage.setItem('pr_phantom_history', JSON.stringify(filtered.slice(0, 6)));
    renderHistory();
  } catch {
    // ignore
  }
}

function renderHistory() {
  if (!sidebarHistoryList) return;
  try {
    const history: HistoryItem[] = JSON.parse(localStorage.getItem('pr_phantom_history') || '[]');
    if (history.length === 0) {
      sidebarHistoryList.innerHTML = '<p class="sidebar-empty">No saved history yet</p>';
      return;
    }

    sidebarHistoryList.innerHTML = history.map((h, idx) => {
      const timeStr = new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `
        <div class="sidebar-history-item" data-history-idx="${idx}" title="Click to restore this diff">
          <span class="sidebar-history-snippet">${escHtml(h.preview)}…</span>
          <div class="sidebar-history-meta">
            <span>${h.filesCount} file${h.filesCount !== 1 ? 's' : ''}</span>
            <span>${timeStr}</span>
          </div>
        </div>
      `;
    }).join('');

    sidebarHistoryList.querySelectorAll('.sidebar-history-item').forEach((item) => {
      item.addEventListener('click', () => {
        const idx = Number(item.getAttribute('data-history-idx'));
        if (history[idx]) {
          playEtherealChime(550);
          diffInput.value = history[idx].diff;
          onInputChange();
          liveparse();
          showToast('Diff restored from history! ⏳');
        }
      });
    });
  } catch {
    sidebarHistoryList.innerHTML = '<p class="sidebar-empty">History unavailable</p>';
  }
}

function clearHistory() {
  localStorage.removeItem('pr_phantom_history');
  renderHistory();
  showToast('Diff history cleared! 🧹');
}

// ── Smart Automated Checklist ──────────────────────────────────────────────

function initChecklist() {
  // Set up filter pills
  const pills = document.querySelectorAll('.checklist-filter-pills .filter-pill');
  pills.forEach((p) => {
    p.addEventListener('click', () => {
      pills.forEach((el) => el.classList.remove('filter-pill--active'));
      p.classList.add('filter-pill--active');
      currentChecklistFilter = (p.getAttribute('data-filter') as 'all' | 'passed' | 'warning') || 'all';
      playEtherealChime(650);
      renderChecklist();
    });
  });

  autoScanBtn?.addEventListener('click', () => {
    playSwooshSound();
    runAutoChecklistScan(diffInput.value.trim(), true);
    showToast('Diff auto-audited! ⚡');
  });

  resetChecklistBtn?.addEventListener('click', resetChecklist);

  // Initial audit of current diff
  runAutoChecklistScan(diffInput.value.trim(), false);
}

function runAutoChecklistScan(rawDiff: string, playAudio = false) {
  // Run rule-based automated audit on the diff text
  const audited = autoAuditDiff(rawDiff);
  checklistItems = loadSavedChecklistOverrides(audited);

  // Add scanning radar beam effect briefly
  if (checklistContainer) {
    checklistContainer.classList.add('scanning-radar');
    setTimeout(() => {
      checklistContainer.classList.remove('scanning-radar');
    }, 700);
  }

  renderChecklist();
  updateReadinessScore();
  updateExportPreviewIfOpen();

  if (playAudio) {
    const anyWarnings = checklistItems.some((i) => i.status === 'warning');
    if (anyWarnings) {
      playEtherealChime(420);
    } else {
      playRevealChime();
    }
  }
}

function renderChecklist() {
  if (!checklistContainer) return;

  // Filter items
  let displayItems = checklistItems;
  if (currentChecklistFilter === 'passed') {
    displayItems = checklistItems.filter((i) => i.status === 'passed');
  } else if (currentChecklistFilter === 'warning') {
    displayItems = checklistItems.filter((i) => i.status === 'warning');
  }

  // Update counts
  const totalCount = checklistItems.length;
  const passedCount = checklistItems.filter((i) => i.status === 'passed').length;
  const warningCount = checklistItems.filter((i) => i.status === 'warning').length;

  if (countAll) countAll.textContent = `${totalCount}`;
  if (countPassed) countPassed.textContent = `${passedCount}`;
  if (countWarning) countWarning.textContent = `${warningCount}`;

  if (displayItems.length === 0) {
    checklistContainer.innerHTML = `<p class="sidebar-empty">No items matching "${currentChecklistFilter}"</p>`;
    return;
  }

  checklistContainer.innerHTML = displayItems.map((item) => {
    const isExpanded = expandedCardId === item.id;
    const badgeText = item.status === 'passed' ? 'PASS ✅' : item.status === 'warning' ? 'FLAG ⚠️' : 'AUDITING ⏳';
    const badgeClass = `smart-status-badge--${item.status}`;
    const cardClass = `smart-checklist-card smart-checklist-card--${item.status} ${item.checked ? 'smart-checklist-card--checked' : ''}`;

    let detailsHtml = '';
    if (isExpanded) {
      const snippetHtml = item.findingSnippet
        ? `<div class="smart-snippet-box"><code>${escHtml(item.findingSnippet)}</code></div>`
        : '';
      const suggestionHtml = item.suggestion
        ? `<div class="smart-suggestion-box">💡 <strong>Author suggestion:</strong> ${escHtml(item.suggestion)}</div>`
        : '';

      detailsHtml = `
        <div class="smart-checklist-card__details">
          <p class="smart-evidence-text">${escHtml(item.evidence)}</p>
          ${snippetHtml}
          ${suggestionHtml}
          <div class="smart-card-actions">
            ${item.suggestion ? `<button class="smart-action-btn copy-suggestion-btn" type="button" data-suggestion="${escHtml(item.suggestion)}">📋 Copy Question</button>` : ''}
            <button class="smart-action-btn jump-diff-btn" type="button">🔎 See in Diff</button>
          </div>
        </div>
      `;
    }

    return `
      <div class="${cardClass}" data-id="${item.id}">
        <div class="smart-checklist-card__header" data-id="${item.id}" title="Click to view automated evidence">
          <div class="smart-checklist-card__left">
            <input type="checkbox" class="checklist-checkbox" ${item.checked ? 'checked' : ''} data-id="${item.id}" title="Manual override">
            <span class="smart-checklist-label">${escHtml(item.label)}</span>
          </div>
          <span class="smart-status-badge ${badgeClass}">${badgeText}</span>
        </div>
        ${detailsHtml}
      </div>
    `;
  }).join('');

  // Attach card header click to expand
  checklistContainer.querySelectorAll('.smart-checklist-card__header').forEach((header) => {
    header.addEventListener('click', (e) => {
      // Don't expand if user directly clicked the checkbox
      if ((e.target as HTMLElement).classList.contains('checklist-checkbox')) return;
      const id = header.getAttribute('data-id');
      expandedCardId = expandedCardId === id ? null : id;
      playEtherealChime(720);
      renderChecklist();
    });
  });

  // Attach checkbox manual override change
  checklistContainer.querySelectorAll('.checklist-checkbox').forEach((cb) => {
    cb.addEventListener('change', (e) => {
      e.stopPropagation();
      const id = (e.target as HTMLElement).getAttribute('data-id');
      const checked = (e.target as HTMLInputElement).checked;
      const found = checklistItems.find((i) => i.id === id);
      if (found) {
        found.checked = checked;
        saveChecklist(checklistItems);
        renderChecklist();
        updateReadinessScore();
        updateExportPreviewIfOpen();
        if (checked) {
          playEtherealChime(820);
        }
      }
    });
  });

  // Attach action buttons
  checklistContainer.querySelectorAll('.copy-suggestion-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const suggestion = btn.getAttribute('data-suggestion') || '';
      navigator.clipboard.writeText(`Review question: ${suggestion}`).then(() => {
        playRevealChime();
        showToast('Copied question for PR author! 📋');
      });
    });
  });

  checklistContainer.querySelectorAll('.jump-diff-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      playEtherealChime(640);
      const diffSection = document.getElementById('diff-section');
      if (diffSection) {
        diffSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  });

  updateReadinessScore();
}

function updateReadinessScore() {
  const verified = checklistItems.filter((i) => i.checked).length;
  const total = checklistItems.length;
  const pct = total > 0 ? Math.round((verified / total) * 100) : 0;

  if (checklistProgressFill) {
    checklistProgressFill.style.width = `${pct}%`;
  }
  if (checklistProgressLabel) {
    checklistProgressLabel.textContent = `${verified} / ${total} verified (${pct}%)`;
  }

  if (readinessBadge) {
    if (!diffInput.value.trim()) {
      readinessBadge.textContent = 'Awaiting Diff';
      readinessBadge.className = 'readiness-badge';
    } else if (pct >= 85) {
      readinessBadge.textContent = `${pct}% Review Ready 🎃`;
      readinessBadge.className = 'readiness-badge readiness-badge--ready';
    } else if (pct >= 50) {
      readinessBadge.textContent = `${pct}% Review Cautiously ⚠️`;
      readinessBadge.className = 'readiness-badge readiness-badge--caution';
    } else {
      readinessBadge.textContent = `${pct}% High Risk Flags 🚨`;
      readinessBadge.className = 'readiness-badge readiness-badge--danger';
    }
  }
}

function resetChecklist() {
  checklistItems.forEach((i) => (i.checked = false));
  saveChecklist(checklistItems);
  renderChecklist();
  updateReadinessScore();
  updateExportPreviewIfOpen();
  showToast('Checklist reset to manual! 🧹');
}

// ── Risk Assessment ────────────────────────────────────────────────────────

function updateRiskGauge(rawDiff: string) {
  if (!riskGaugeLevel || !riskGaugeReasons) return;

  if (!rawDiff.trim()) {
    riskGaugeLevel.textContent = 'Awaiting Diff';
    riskGaugeLevel.className = 'risk-level-badge risk-level--low';
    riskGaugeReasons.innerHTML = '<li>Paste a diff or select a preset to analyze review risk.</li>';
    return;
  }

  const assessment = calculateRiskAssessment(rawDiff);
  riskGaugeLevel.textContent = `${assessment.level} Risk`;
  riskGaugeLevel.className = `risk-level-badge risk-level--${assessment.level.toLowerCase()}`;

  riskGaugeReasons.innerHTML = assessment.reasons
    .map((r) => `<li>${escHtml(r)}</li>`)
    .join('');
}

// ── GitHub PR Comment Exporter ─────────────────────────────────────────────

function copyPRComment() {
  const comment = buildPRCommentMarkdown();
  navigator.clipboard.writeText(comment).then(() => {
    playRevealChime();
    showToast('📋 Copied review comment to clipboard! 🎃');
  }).catch(() => {
    showToast('⚠️ Could not write to clipboard automatically. Check preview!');
  });
}

function togglePRPreview() {
  if (!prExportPreview || !prExportTextarea) return;
  const isHidden = prExportPreview.hidden;
  prExportPreview.hidden = !isHidden;
  togglePreviewBtn.textContent = isHidden ? '✕ Close' : '👁️ Preview';

  if (isHidden) {
    prExportTextarea.value = buildPRCommentMarkdown();
  }
}

function updateExportPreviewIfOpen() {
  if (prExportPreview && !prExportPreview.hidden && prExportTextarea) {
    prExportTextarea.value = buildPRCommentMarkdown();
  }
}

function buildPRCommentMarkdown(): string {
  return generateGitHubPRComment({
    overview: currentResult?.overview,
    changes: currentResult?.changes,
    generalTips: currentResult?.generalTips,
    checklist: checklistItems,
    modelName: ollamaModel,
    filesCount: currentParsed?.totalFiles ?? 0,
  });
}

// ── Toast Notifications ────────────────────────────────────────────────────

let toastTimer: number | null = null;
function showToast(msg: string, duration = 3000) {
  if (!toastNotification) return;
  toastNotification.textContent = msg;
  toastNotification.classList.add('toast-notification--visible');

  if (toastTimer !== null) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastNotification.classList.remove('toast-notification--visible');
    toastTimer = null;
  }, duration);
}

// ── Halloween Interactions ─────────────────────────────────────────────────

function initHalloweenInteractions() {
  const canvasEl = document.getElementById('ambient-canvas') as HTMLCanvasElement;
  if (canvasEl) {
    initCanvasParticles(canvasEl);
  }

  const spiderMount = document.getElementById('spider-mount');
  if (spiderMount) {
    setupInteractiveSpider(spiderMount);
  }

  const mascotMount = document.getElementById('mascot-mount');
  if (mascotMount) {
    setupPumpkinMascot(mascotMount);
  }

  const moonEl = document.getElementById('header-moon');
  if (moonEl) {
    setupInteractiveMoon(moonEl);
  }

  setupGuessRevealCelebration();

  const soundBtn = document.getElementById('toggle-sound-btn');
  const particlesBtn = document.getElementById('toggle-particles-btn');
  const batsBtn = document.getElementById('summon-bats-btn');

  let soundOn = true;
  soundBtn?.addEventListener('click', () => {
    soundOn = !soundOn;
    setSoundEnabled(soundOn);
    soundBtn.classList.toggle('fx-btn--active', soundOn);
    const label = soundBtn.querySelector('.fx-btn__label');
    const icon = soundBtn.querySelector('.fx-btn__icon');
    if (label) label.textContent = soundOn ? 'Sounds: ON' : 'Sounds: OFF';
    if (icon) icon.textContent = soundOn ? '🔊' : '🔇';
    if (soundOn) playEtherealChime(880);
  });

  let particlesOn = true;
  particlesBtn?.addEventListener('click', () => {
    particlesOn = !particlesOn;
    setParticlesEnabled(particlesOn);
    particlesBtn.classList.toggle('fx-btn--active', particlesOn);
    const label = particlesBtn.querySelector('.fx-btn__label');
    if (label) label.textContent = particlesOn ? 'Wisps: ON' : 'Wisps: OFF';
    if (soundOn) playEtherealChime(660);
  });

  batsBtn?.addEventListener('click', () => {
    const rect = batsBtn.getBoundingClientRect();
    summonBatSwarm(rect.left + rect.width / 2, rect.top);
  });
}

async function checkHealth() {
  try {
    const resp = await fetch('/api/health');
    const data = (await resp.json()) as HealthResponse;
    aiProvider = data.provider || 'ollama';
    ollamaModel = data.model || (aiProvider === 'gemini' ? 'gemini-3.8-flash' : 'gemma4:e2b');
    ollamaUrl = data.ollamaUrl || 'http://127.0.0.1:11434';

    if (ollamaModelBadge) {
      ollamaModelBadge.textContent = ollamaModel;
    }

    if (aiProvider === 'gemini') {
      ollamaStatusBanner.className = data.configured
        ? 'ollama-status-banner ollama-status-banner--connected'
        : 'ollama-status-banner ollama-status-banner--disconnected';
      ollamaDot.className = data.configured
        ? 'ollama-dot ollama-dot--connected'
        : 'ollama-dot ollama-dot--disconnected';
      ollamaStatusText.innerHTML = data.configured
        ? `✨ <strong>Gemini AI ready</strong> — model <code>${escHtml(ollamaModel)}</code>`
        : '⚠️ <strong>Gemini API key is missing</strong>. Add GEMINI_API_KEY to the server environment.';
      return;
    }

    if (data.ollamaConnected) {
      ollamaStatusBanner.className = 'ollama-status-banner ollama-status-banner--connected';
      ollamaDot.className = 'ollama-dot ollama-dot--connected';
      if (data.modelInstalled) {
        ollamaStatusText.innerHTML = `🦙 <strong>Ollama Local AI connected</strong> — model <code>${escHtml(ollamaModel)}</code> ready`;
      } else {
        ollamaStatusText.innerHTML = `🦙 <strong>Ollama connected</strong>, but <code>${escHtml(ollamaModel)}</code> is not pulled yet`;
      }
    } else {
      ollamaStatusBanner.className = 'ollama-status-banner ollama-status-banner--disconnected';
      ollamaDot.className = 'ollama-dot ollama-dot--disconnected';
      ollamaStatusText.innerHTML = `⚠️ <strong>Ollama is not running</strong> at <code>${escHtml(ollamaUrl)}</code>. Launch Ollama to enable AI explanations.`;
    }
  } catch {
    ollamaStatusBanner.className = 'ollama-status-banner ollama-status-banner--disconnected';
    ollamaDot.className = 'ollama-dot ollama-dot--disconnected';
    ollamaStatusText.textContent = '⚠️ Could not reach backend server.';
  }
}
function loadSample() {
  playEtherealChime(523.25);
  diffInput.value = SAMPLE_DIFF;
  onInputChange();
  liveparse();
  showStatus('Sample diff loaded! Click "Explain this diff" to analyse it.', 'info');
}

function clearAll() {
  playSwooshSound();
  diffInput.value = '';
  activePresetId = null;
  diffPresetsList.querySelectorAll('.diff-preset-card').forEach((c) => c.classList.remove('diff-preset-card--active'));

  onInputChange();
  fileList.innerHTML = '';
  statsBar.innerHTML = '';
  patchTrail.innerHTML = '';
  diffHighlightArea.innerHTML = '';
  currentParsed = null;
  currentResult = null;
  updateRiskGauge('');
  runAutoChecklistScan('', false);
  if (sidebarFilesList) sidebarFilesList.innerHTML = '<p class="sidebar-empty">No diff loaded yet</p>';
  if (sidebarFilesCount) sidebarFilesCount.textContent = '0';
  hideStatus();
}

function onInputChange() {
  const len = diffInput.value.length;
  charCount.textContent = len.toLocaleString();
  if (len > 180_000) {
    charCount.style.color = 'var(--pumpkin)';
  } else {
    charCount.style.color = 'var(--mist)';
  }
}

function liveparse() {
  const raw = diffInput.value.trim();
  updateRiskGauge(raw);
  runAutoChecklistScan(raw, false);

  if (!raw) {
    fileList.innerHTML = '';
    statsBar.innerHTML = '';
    diffHighlightArea.innerHTML = '';
    currentParsed = null;
    if (sidebarFilesList) sidebarFilesList.innerHTML = '<p class="sidebar-empty">No diff loaded yet</p>';
    if (sidebarFilesCount) sidebarFilesCount.textContent = '0';
    return;
  }

  const parsed = parseDiff(raw);
  currentParsed = parsed;
  if (parsed.isValid) {
    renderFileList(parsed);
    renderStats(parsed);
    renderDiffHighlight(parsed);
    renderSidebarFiles(parsed);
  } else {
    fileList.innerHTML = `<p class="error-msg">⚠️ ${escHtml(parsed.errorMessage ?? 'Invalid diff')}</p>`;
    statsBar.innerHTML = '';
    diffHighlightArea.innerHTML = '';
    if (sidebarFilesList) sidebarFilesList.innerHTML = '<p class="sidebar-empty">Invalid diff syntax</p>';
  }
}

// ── Explain ────────────────────────────────────────────────────────────────

async function explainDiff() {
  const raw = diffInput.value.trim();
  if (!raw) {
    showStatus('Please paste a diff first, or click a preset from the sidebar.', 'warn');
    playEtherealChime(350);
    return;
  }

  const parsed = parseDiff(raw);
  currentParsed = parsed;

  if (!parsed.isValid) {
    showStatus(`⚠️ ${parsed.errorMessage}`, 'error');
    playEtherealChime(280);
    return;
  }

  // Save to history on successful analysis
  saveDiffToHistory(raw, parsed.totalFiles);

  playSwooshSound();
  setExplaining(true);
  patchTrail.innerHTML = `
    <div class="loading-ghost">
      <div class="cauldron-loader" aria-hidden="true">
        <div class="cauldron-bubble c1"></div>
        <div class="cauldron-bubble c2"></div>
        <div class="cauldron-bubble c3"></div>
        <div class="cauldron-steam"></div>
        <span class="ghost-icon">👻</span>
      </div>
      <p class="loading-title">Brewing your explanation…</p>
      <p class="loading-sub">PR Phantom is consulting ${aiProvider === 'gemini' ? 'Gemini' : 'local Ollama'} (<code>${escHtml(ollamaModel)}</code>) along the Patch Trail</p>
    </div>
  `;

  try {
    const resp = await fetch('/api/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        diff: raw.slice(0, 80_000),
        parsedSummary: parsed.parsedSummary,
        hunkIds: parsed.hunkIds,
      }),
    });

    const data = (await resp.json()) as {
      result?: GemmaResult;
      error?: string;
      ollamaDisconnected?: boolean;
      modelMissing?: boolean;
    };

    if (!resp.ok || data.error) {
      if (data.ollamaDisconnected) {
        patchTrail.innerHTML = renderOllamaDisconnectedCard(ollamaUrl);
      } else if (data.modelMissing) {
        patchTrail.innerHTML = renderModelMissingCard(ollamaModel);
      } else {
        patchTrail.innerHTML = renderErrorCard(data.error ?? 'Unknown error');
      }
      setExplaining(false);
      return;
    }

    if (!data.result || typeof data.result.overview !== 'string') {
      patchTrail.innerHTML = renderErrorCard('The AI returned an unexpected response. Please try again.');
      setExplaining(false);
      return;
    }

    currentResult = data.result;
    renderPatchTrail(currentResult, parsed);
    updateExportPreviewIfOpen();
    playRevealChime();
    hideStatus();
  } catch {
    patchTrail.innerHTML = renderErrorCard(
      'Could not reach the server. Make sure your dev server is running.'
    );
  } finally {
    setExplaining(false);
  }
}

// ── Render helpers ─────────────────────────────────────────────────────────

function renderFileList(parsed: ParsedDiff) {
  const badges = parsed.files
    .map((f: DiffFile) => {
      const tag = f.isNew ? 'new' : f.isDeleted ? 'deleted' : 'modified';
      const icon = f.isNew ? '✨' : f.isDeleted ? '🗑️' : '✏️';
      return `
        <div class="file-badge file-badge--${tag}" data-filename="${escHtml(f.filename)}" title="Click to view file diff">
          <span class="file-badge__icon">${icon}</span>
          <span class="file-badge__name">${escHtml(f.filename)}</span>
          <span class="file-badge__stats">
            <span class="add">+${f.additions}</span>
            <span class="del">-${f.deletions}</span>
          </span>
        </div>`;
    })
    .join('');
  fileList.innerHTML = `<div class="file-badges">${badges}</div>`;

  fileList.querySelectorAll('.file-badge').forEach((badge) => {
    badge.addEventListener('click', () => {
      playEtherealChime(600);
      const filename = badge.getAttribute('data-filename');
      if (filename) {
        const headers = Array.from(document.querySelectorAll('.diff-file-header'));
        const match = headers.find((h) => h.textContent?.includes(filename));
        if (match) {
          match.scrollIntoView({ behavior: 'smooth', block: 'center' });
          match.classList.add('header--highlight');
          setTimeout(() => match.classList.remove('header--highlight'), 1500);
        }
      }
    });
  });
}

function renderStats(parsed: ParsedDiff) {
  statsBar.innerHTML = `
    <div class="stat-chip stat-chip--files">
      <span class="stat-icon">📂</span>
      <strong>${parsed.totalFiles}</strong> file${parsed.totalFiles !== 1 ? 's' : ''} changed
    </div>
    <div class="stat-chip stat-chip--add">
      <span class="stat-icon">+</span>
      <strong>${parsed.totalAdditions}</strong> additions
    </div>
    <div class="stat-chip stat-chip--del">
      <span class="stat-icon">−</span>
      <strong>${parsed.totalDeletions}</strong> deletions
    </div>
    <div class="stat-chip stat-chip--hunks">
      <span class="stat-icon">🔍</span>
      <strong>${parsed.hunkIds.length}</strong> hunk${parsed.hunkIds.length !== 1 ? 's' : ''}
    </div>
  `;
}

function renderDiffHighlight(parsed: ParsedDiff) {
  let html = '<div class="diff-lines">';
  for (const file of parsed.files) {
    html += `<div class="diff-file-header">${escHtml(file.filename)}</div>`;
    for (const hunk of file.hunks) {
      html += `<div class="diff-hunk" id="anchor-${hunk.id}">`;
      html += `<div class="diff-hunk-header" title="Hunk ${hunk.id}">${escHtml(hunk.context)} <span class="hunk-badge">${hunk.id}</span></div>`;
      for (const line of hunk.lines.slice(1)) {
        const cls = line.startsWith('+') ? 'diff-add' : line.startsWith('-') ? 'diff-del' : 'diff-ctx';
        html += `<div class="diff-line ${cls}"><span class="diff-line-content">${escHtml(line)}</span></div>`;
      }
      html += '</div>';
    }
  }
  html += '</div>';
  diffHighlightArea.innerHTML = html;
}

function renderPatchTrail(result: GemmaResult, parsed: ParsedDiff) {
  const validHunkIds = new Set(parsed.hunkIds);

  let html = `
    <div class="overview-card">
      <div class="overview-card__ghost">👻</div>
      <div class="overview-card__content">
        <h2 class="overview-card__title">What's in this diff?</h2>
        <p class="overview-card__text">${escHtml(result.overview)}</p>
      </div>
    </div>
    <div class="trail-heading">
      <span class="trail-icon">🦇</span>
      <h2>Patch Trail</h2>
      <span class="trail-subtitle">Follow the moonlit cobblestones, step by step</span>
    </div>
    <ol class="trail-list">
  `;

  for (const change of result.changes) {
    const hunkId = change.hunkId && validHunkIds.has(change.hunkId) ? change.hunkId : null;
    const evidenceLink = hunkId
      ? `<a class="evidence-link" href="#anchor-${hunkId}" data-hunk="${hunkId}" title="Jump to this change in the diff">🔗 See in diff (${hunkId})</a>`
      : '';
    const contextNote = change.needsMoreContext
      ? '<span class="context-note">⚠️ More context needed to be certain</span>'
      : '';

    html += `
      <li class="trail-item" data-hunk="${hunkId ?? ''}">
        <div class="trail-item__number" title="Patch Trail Step ${change.hunkId ? escHtml(change.hunkId) : ''}">${change.hunkId ? escHtml(change.hunkId) : '🎃'}</div>
        <div class="trail-item__body">
          <div class="trail-item__header">
            <h3 class="trail-item__title">${escHtml(change.title)}</h3>
            <div class="trail-item__actions">${evidenceLink}</div>
          </div>
          ${contextNote}
          <div class="trail-cards">
            <div class="trail-card trail-card--what">
              <div class="trail-card__label">🔍 What changed</div>
              <p>${escHtml(change.whatChanged)}</p>
            </div>
            <div class="trail-card trail-card--why">
              <div class="trail-card__label">💡 Why it matters</div>
              <p>${escHtml(change.whyItMatters)}</p>
            </div>
            <div class="trail-card trail-card--ask">
              <div class="trail-card__label">🤔 A reviewer might ask</div>
              <p class="reviewer-q">${escHtml(change.reviewerQuestion)}</p>
            </div>
          </div>
          <details class="guess-reveal">
            <summary>🎃 Guess what this change does <span class="reveal-hint">(click to reveal)</span></summary>
            <p class="guess-text">${escHtml(change.guess)}</p>
          </details>
        </div>
      </li>
    `;
  }

  html += `</ol>`;

  if (result.generalTips && result.generalTips.length > 0) {
    html += `
      <div class="tips-section">
        <h3 class="tips-title">🕸️ General Review Tips</h3>
        <ul class="tips-list">
          ${result.generalTips.map((t: string) => `<li>${escHtml(t)}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  patchTrail.innerHTML = html;
  patchTrail.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Add click & hover listeners to evidence links
  document.querySelectorAll('.evidence-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      playEtherealChime(750);
      const href = link.getAttribute('href')!;
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('diff-hunk--spotlight');
        setTimeout(() => target.classList.remove('diff-hunk--spotlight'), 2000);
      }
    });

    link.addEventListener('mouseenter', () => {
      const hunk = link.getAttribute('data-hunk');
      if (hunk) {
        const target = document.getElementById(`anchor-${hunk}`);
        target?.classList.add('diff-hunk--peek');
      }
    });

    link.addEventListener('mouseleave', () => {
      const hunk = link.getAttribute('data-hunk');
      if (hunk) {
        const target = document.getElementById(`anchor-${hunk}`);
        target?.classList.remove('diff-hunk--peek');
      }
    });
  });
}

function renderOllamaDisconnectedCard(url: string) {
  return `
    <div class="info-card info-card--nokey">
      <div class="info-card__icon">🦙</div>
      <h3>Ollama Is Not Running</h3>
      <p>PR Phantom could not connect to your local Ollama server at <code>${escHtml(url)}</code>.</p>
      <ol>
        <li>Start Ollama on your computer (from the Start Menu, app icon, or tray).</li>
        <li>Or open Command Prompt and type: <code>ollama serve</code></li>
        <li>Once started, click <strong>"🔮 Explain this diff"</strong> again!</li>
      </ol>
      <p class="subtle">The diff analysis and breakdown above works completely offline without AI.</p>
    </div>
  `;
}

function renderModelMissingCard(model: string) {
  return `
    <div class="info-card info-card--nokey">
      <div class="info-card__icon">📥</div>
      <h3>Model Not Downloaded in Ollama</h3>
      <p>Ollama is running, but <code>${escHtml(model)}</code> has not been downloaded yet.</p>
      <ol>
        <li>Open Command Prompt or PowerShell.</li>
        <li>Run: <code>ollama pull ${escHtml(model)}</code></li>
        <li>When the download finishes, click <strong>"🔮 Explain this diff"</strong> again!</li>
      </ol>
      <p class="subtle">The diff analysis above still works right now.</p>
    </div>
  `;
}

function renderErrorCard(message: string) {
  return `
    <div class="info-card info-card--error">
      <div class="info-card__icon">⚠️</div>
      <h3>Something went wrong</h3>
      <p>${escHtml(message)}</p>
      <p class="subtle">The diff summary above still works. Try again or check the server logs.</p>
    </div>
  `;
}

// ── Status helpers ─────────────────────────────────────────────────

function showStatus(msg: string, type: 'info' | 'warn' | 'error') {
  statusBar.textContent = msg;
  statusBar.className = `status-bar status-bar--${type}`;
  statusBar.style.display = 'block';
}

function hideStatus() {
  statusBar.style.display = 'none';
}

function setExplaining(on: boolean) {
  explainBtn.disabled = on;
  const textEl = document.getElementById('explain-btn-text');
  const providerLabel = aiProvider === 'gemini' ? 'Gemini' : 'Ollama';
  if (textEl) {
    textEl.textContent = on ? '👻 Asking ' + providerLabel + ' (' + ollamaModel + ')…' : '🔮 Explain this diff';
  } else {
    explainBtn.textContent = on ? '👻 Asking ' + providerLabel + '…' : '🔮 Explain this diff';
  }
  if (on) {
    explainBtn.classList.add('btn--loading');
    startBubblingAudio();
  } else {
    explainBtn.classList.remove('btn--loading');
    stopBubblingAudio();
  }
}

function startBubblingAudio() {
  stopBubblingAudio();
  playBubbleSound();
  bubblingInterval = window.setInterval(() => {
    playBubbleSound();
  }, 650);
}

function stopBubblingAudio() {
  if (bubblingInterval !== null) {
    clearInterval(bubblingInterval);
    bubblingInterval = null;
  }
}

// ── Utilities ──────────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Boot ───────────────────────────────────────────────────────────────────

init();
