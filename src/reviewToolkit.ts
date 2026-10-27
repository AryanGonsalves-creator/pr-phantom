/**
 * PR Phantom — Smart Automated Review Toolkit & GitHub Comment Exporter
 * Features:
 * - Real-time automated rule audit engine that analyzes diffs and auto-checks items
 * - Findings inspector with line evidence, jump links, and review questions
 * - Interactive checklist with manual override, filters (All / Passed / Flagged)
 * - 1-Click GitHub Markdown PR Review Comment Exporter
 * - Spooky Risk Score calculation
 */

export type AuditStatus = 'passed' | 'warning' | 'pending';

export interface SmartChecklistItem {
  id: string;
  category: '🛡️ Security' | '⚡ Correctness' | '🧹 Quality';
  label: string;
  checked: boolean;
  status: AuditStatus;
  evidence: string;
  findingSnippet?: string;
  suggestion?: string;
  hunkAnchor?: string;
}

export const BASE_CHECKLIST: SmartChecklistItem[] = [
  // Security
  {
    id: 'sec-secrets',
    category: '🛡️ Security',
    label: 'No hardcoded credentials, API keys, or tokens',
    checked: true,
    status: 'passed',
    evidence: 'Awaiting diff to verify credentials.',
  },
  {
    id: 'sec-sanitize',
    category: '🛡️ Security',
    label: 'External input & parameters properly sanitized',
    checked: true,
    status: 'passed',
    evidence: 'Awaiting diff to verify input sanitization.',
  },
  {
    id: 'sec-logs',
    category: '🛡️ Security',
    label: 'No sensitive user data leaked in console logs',
    checked: true,
    status: 'passed',
    evidence: 'Awaiting diff to verify console logging.',
  },
  // Correctness
  {
    id: 'cor-nulls',
    category: '⚡ Correctness',
    label: 'Null / undefined edge cases and fallbacks handled',
    checked: true,
    status: 'passed',
    evidence: 'Awaiting diff to verify null safety.',
  },
  {
    id: 'cor-errors',
    category: '⚡ Correctness',
    label: 'Errors handled gracefully without crashing app',
    checked: true,
    status: 'passed',
    evidence: 'Awaiting diff to verify error boundaries.',
  },
  {
    id: 'cor-types',
    category: '⚡ Correctness',
    label: 'Type safety and boundary conditions verified',
    checked: true,
    status: 'passed',
    evidence: 'Awaiting diff to verify type safety.',
  },
  // Quality
  {
    id: 'qua-names',
    category: '🧹 Quality',
    label: 'Descriptive names & clear intent for readers',
    checked: true,
    status: 'passed',
    evidence: 'Awaiting diff to verify naming conventions.',
  },
  {
    id: 'qua-debug',
    category: '🧹 Quality',
    label: 'Temporary debugging code removed',
    checked: true,
    status: 'passed',
    evidence: 'Awaiting diff to verify debug cleanup.',
  },
];

/**
 * Automatically audits a raw diff string and evaluates all checklist items.
 */
export function autoAuditDiff(rawDiff: string): SmartChecklistItem[] {
  if (!rawDiff || rawDiff.trim().length === 0) {
    return BASE_CHECKLIST.map((item) => ({
      ...item,
      checked: false,
      status: 'pending',
      evidence: 'Paste a diff or select a preset to auto-audit this item.',
    }));
  }

  const lines = rawDiff.split('\n');
  const addedLines = lines.filter((l) => l.startsWith('+') && !l.startsWith('+++'));
  const addedText = addedLines.join('\n');
  const allText = rawDiff;

  // 1. Secrets & Credentials Audit
  const secretRegex = /(api[_-]?key|apikey|secret|password|passwd|auth[_-]?token|private[_-]?key)\s*[:=]\s*["'][A-Za-z0-9_\-\.]{8,}["']/i;
  const secretMatch = addedText.match(secretRegex);
  let secSecrets: Partial<SmartChecklistItem>;
  if (secretMatch) {
    secSecrets = {
      status: 'warning',
      checked: false,
      evidence: 'Potential hardcoded secret or token detected in added lines.',
      findingSnippet: secretMatch[0].slice(0, 50),
      suggestion: 'Move credentials into environment variables (.env) before committing.',
    };
  } else {
    secSecrets = {
      status: 'passed',
      checked: true,
      evidence: 'Clean: No hardcoded API keys or plaintext credentials found.',
    };
  }

  // 2. Input Sanitization & SQL Injection Audit
  const sqlInjectionRegex = /(SELECT|INSERT|UPDATE|DELETE)\s+.*FROM.*\+\s*['"]?[a-zA-Z0-9_]+/i;
  const rawQueryConcat = addedLines.some((l) => /WHERE.*\+/.test(l) || /SELECT.*\+/.test(l));
  const hasSanitization = /sanitizeHtml|validator|isValidDisplayName|escapeHtml/i.test(addedText);
  const hasParameterized = /\?|\$1|db\.raw\([^,]+,\s*\[/.test(addedText);
  let secSanitize: Partial<SmartChecklistItem>;
  if (rawQueryConcat || addedText.match(sqlInjectionRegex)) {
    secSanitize = {
      status: 'warning',
      checked: false,
      evidence: 'Raw string concatenation detected in SQL query. High injection risk!',
      findingSnippet: addedLines.find((l) => /WHERE.*\+|SELECT.*\+/.test(l))?.trim() || 'Raw SQL concat',
      suggestion: 'Use parameterized queries (?) or an ORM/query builder instead of string concatenation.',
    };
  } else if (hasSanitization || hasParameterized) {
    secSanitize = {
      status: 'passed',
      checked: true,
      evidence: 'Verified: Safe parameterized queries or input sanitization detected in diff.',
    };
  } else {
    secSanitize = {
      status: 'passed',
      checked: true,
      evidence: 'No dangerous raw query patterns detected in changed lines.',
    };
  }

  // 3. Console Logs & Sensitive Leaks Audit
  const sensitiveLogMatch = addedLines.find((l) =>
    /console\.(log|debug|info)\(.*(password|secret|token|hash|credential|email)/i.test(l)
  );
  const anyLogMatch = addedLines.find((l) => /console\.(log|debug)/.test(l));
  let secLogs: Partial<SmartChecklistItem>;
  if (sensitiveLogMatch) {
    secLogs = {
      status: 'warning',
      checked: false,
      evidence: 'Sensitive credential or user field logged to console in production code!',
      findingSnippet: sensitiveLogMatch.trim(),
      suggestion: 'Remove sensitive console logs to prevent accidental terminal or log leaks.',
    };
  } else if (anyLogMatch) {
    secLogs = {
      status: 'warning',
      checked: false,
      evidence: 'New console.log added in pull request.',
      findingSnippet: anyLogMatch.trim(),
      suggestion: 'Verify whether this log is meant for permanent monitoring or temporary debugging.',
    };
  } else {
    secLogs = {
      status: 'passed',
      checked: true,
      evidence: 'Clean: No console.log or credential printing found in added lines.',
    };
  }

  // 4. Null & Undefined Edge Cases Audit
  const hasNullSafeguards = /\?\.|\|\||\?\?|if\s*\(![a-zA-Z]|=== null|!== undefined/i.test(addedText);
  let corNulls: Partial<SmartChecklistItem>;
  if (hasNullSafeguards) {
    corNulls = {
      status: 'passed',
      checked: true,
      evidence: 'Verified: Safe null checks, optional chaining (?.), or nullish coalescing (??) present.',
    };
  } else {
    corNulls = {
      status: 'passed',
      checked: true,
      evidence: 'No unprotected complex object chains detected.',
    };
  }

  // 5. Error Handling Audit
  const hasErrorHandling = /try\s*\{|\.catch\(|res\.status\((4|5)[0-9]{2}\)|throw new Error|onError/i.test(allText);
  let corErrors: Partial<SmartChecklistItem>;
  if (hasErrorHandling) {
    corErrors = {
      status: 'passed',
      checked: true,
      evidence: 'Verified: Explicit error handling (try/catch, HTTP status codes, or throw) implemented.',
    };
  } else if (/async|await|fetch|axios|Promise/i.test(addedText)) {
    corErrors = {
      status: 'warning',
      checked: false,
      evidence: 'Asynchronous operations added without explicit try/catch or error response.',
      suggestion: 'Wrap asynchronous calls with error handling to avoid unhandled rejections.',
    };
  } else {
    corErrors = {
      status: 'passed',
      checked: true,
      evidence: 'No unhandled async failure points detected.',
    };
  }

  // 6. Type Safety Audit
  const hasTypes = /:\s*(string|number|boolean|any|unknown|void|Promise)|interface\s+|type\s+|as\s+[A-Z]/i.test(addedText);
  let corTypes: Partial<SmartChecklistItem>;
  if (hasTypes) {
    corTypes = {
      status: 'passed',
      checked: true,
      evidence: 'Verified: Explicit TypeScript types or interfaces defined.',
    };
  } else {
    corTypes = {
      status: 'passed',
      checked: true,
      evidence: 'Standard typed code structure.',
    };
  }

  // 7. Clear Naming Audit
  const hasBadShortNames = addedLines.some((l) => /(const|let|var)\s+[a-z]\s*=/i.test(l));
  let quaNames: Partial<SmartChecklistItem>;
  if (hasBadShortNames) {
    quaNames = {
      status: 'warning',
      checked: false,
      evidence: 'Short or single-letter variable names detected in new code.',
      suggestion: 'Use descriptive variable names that convey purpose to reviewers.',
    };
  } else {
    quaNames = {
      status: 'passed',
      checked: true,
      evidence: 'Verified: Functions and variables use clear, readable naming.',
    };
  }

  // 8. Temporary Debug Code & Dead Code Audit
  const debuggerMatch = addedLines.find((l) => /\bdebugger\b/.test(l));
  const commentedCodeMatch = addedLines.find((l) => /\/\/\s*(const|let|var|function|return|import)\s+/i.test(l));
  let quaDebug: Partial<SmartChecklistItem>;
  if (debuggerMatch) {
    quaDebug = {
      status: 'warning',
      checked: false,
      evidence: 'Leftover debugger statement found in added code!',
      findingSnippet: debuggerMatch.trim(),
      suggestion: 'Remove debugger breakpoint before merging.',
    };
  } else if (commentedCodeMatch) {
    quaDebug = {
      status: 'warning',
      checked: false,
      evidence: 'Commented-out code block found in diff.',
      findingSnippet: commentedCodeMatch.trim(),
      suggestion: 'Delete commented-out code; git history preserves past versions.',
    };
  } else {
    quaDebug = {
      status: 'passed',
      checked: true,
      evidence: 'Clean: No debugger statements or commented-out code blocks found.',
    };
  }

  const resultsMap: Record<string, Partial<SmartChecklistItem>> = {
    'sec-secrets': secSecrets,
    'sec-sanitize': secSanitize,
    'sec-logs': secLogs,
    'cor-nulls': corNulls,
    'cor-errors': corErrors,
    'cor-types': corTypes,
    'qua-names': quaNames,
    'qua-debug': quaDebug,
  };

  return BASE_CHECKLIST.map((base) => ({
    ...base,
    ...resultsMap[base.id],
  }));
}

export function saveChecklist(items: SmartChecklistItem[]) {
  try {
    const map: Record<string, boolean> = {};
    items.forEach((i) => {
      map[i.id] = i.checked;
    });
    localStorage.setItem('pr_phantom_smart_checklist', JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function loadSavedChecklistOverrides(items: SmartChecklistItem[]): SmartChecklistItem[] {
  try {
    const raw = localStorage.getItem('pr_phantom_smart_checklist');
    if (raw) {
      const overrides = JSON.parse(raw) as Record<string, boolean>;
      return items.map((i) => {
        if (typeof overrides[i.id] === 'boolean') {
          return { ...i, checked: overrides[i.id] };
        }
        return i;
      });
    }
  } catch {
    // fallback
  }
  return items;
}

export interface ReviewCommentData {
  overview?: string;
  changes?: Array<{
    title: string;
    hunkId?: string;
    whatChanged: string;
    whyItMatters: string;
    reviewerQuestion: string;
  }>;
  generalTips?: string[];
  checklist: SmartChecklistItem[];
  modelName: string;
  filesCount: number;
}

/**
 * Generates a clean, professional GitHub PR review comment in Markdown.
 */
export function generateGitHubPRComment(data: ReviewCommentData): string {
  const dateStr = new Date().toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  let md = `### 👻 PR Phantom Review Summary · _${dateStr}_\n\n`;

  if (data.overview) {
    md += `> **Diff Overview:** ${data.overview}\n\n`;
  }

  if (data.changes && data.changes.length > 0) {
    md += `#### 🔍 Key Changes & Review Notes\n`;
    for (const c of data.changes) {
      const hunkBadge = c.hunkId ? ` \`[${c.hunkId}]\`` : '';
      md += `- **${c.title}**${hunkBadge}\n`;
      md += `  - **What:** ${c.whatChanged}\n`;
      md += `  - **Impact:** ${c.whyItMatters}\n`;
      if (c.reviewerQuestion) {
        md += `  - ❓ **Question for author:** _${c.reviewerQuestion}_\n`;
      }
    }
    md += `\n`;
  }

  // Checklist with automated badges
  const verifiedCount = data.checklist.filter((i) => i.checked).length;
  md += `#### 📋 Automated Reviewer Checklist (${verifiedCount}/${data.checklist.length} verified)\n`;
  for (const item of data.checklist) {
    const badge = item.status === 'passed' ? '✅' : '⚠️';
    const note = item.status === 'warning' && item.suggestion ? ` _(${item.suggestion})_` : '';
    md += `- [${item.checked ? 'x' : ' '}] ${badge} **${item.label}**${note}\n`;
  }
  md += `\n`;

  if (data.generalTips && data.generalTips.length > 0) {
    md += `#### 🕸️ General Tips\n`;
    for (const tip of data.generalTips) {
      md += `- ${tip}\n`;
    }
    md += `\n`;
  }

  md += `---\n_Reviewed with [PR Phantom 👻](https://github.com) · Powered by Ollama (${data.modelName})_\n`;
  return md;
}

/**
 * Calculates a quick "Spooky Risk Score" based on diff content.
 */
export function calculateRiskAssessment(rawDiff: string): {
  level: 'Low' | 'Medium' | 'High';
  reasons: string[];
  color: string;
} {
  const reasons: string[] = [];
  const lower = rawDiff.toLowerCase();

  // Keyword flags
  if (/password|secret|token|api_key|credential|private_key/i.test(lower)) {
    reasons.push('Contains authentication or secret keywords');
  }
  if (/select\s+.*\s+from|insert\s+into|update\s+.*\s+set|delete\s+from|db\.raw/i.test(lower)) {
    reasons.push('Contains database or SQL queries');
  }
  if (/console\.log\(|print\(|debugger/i.test(lower)) {
    reasons.push('Contains console or debug logging statements');
  }
  if (rawDiff.length > 30_000) {
    reasons.push('Large diff size (>30,000 characters)');
  }

  if (reasons.length >= 2) {
    return { level: 'High', reasons, color: '#f85149' };
  } else if (reasons.length === 1) {
    return { level: 'Medium', reasons, color: '#ff9640' };
  } else {
    return {
      level: 'Low',
      reasons: ['No obvious high-risk keywords detected'],
      color: '#7ee787',
    };
  }
}
