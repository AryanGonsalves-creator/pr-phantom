/**
 * PR Phantom — Diff Parser
 * Parses unified diff format into structured data the UI and server prompt use.
 * This is the source-of-truth for filenames, line numbers, and change counts —
 * so the AI never needs to invent them.
 */

export interface DiffHunk {
  id: string; // e.g. "H1", "H2"
  fromLine: number;
  toLine: number;
  context: string; // the @@ header line
  lines: string[]; // all lines in this hunk
  additions: number;
  deletions: number;
}

export interface DiffFile {
  filename: string;
  isNew: boolean;
  isDeleted: boolean;
  isBinary: boolean;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

export interface ParsedDiff {
  files: DiffFile[];
  totalAdditions: number;
  totalDeletions: number;
  totalFiles: number;
  hunkIds: string[]; // all IDs in order for the prompt
  parsedSummary: string; // human-readable summary for the prompt
  isValid: boolean;
  errorMessage?: string;
}

export function parseDiff(raw: string): ParsedDiff {
  if (!raw || raw.trim().length === 0) {
    return invalid('The diff is empty. Please paste a unified diff.');
  }

  if (raw.length > 200_000) {
    return invalid(
      'This diff is very large (over 200 000 characters). Try pasting a smaller section.'
    );
  }

  const lines = raw.split('\n');

  // Basic validation: must have at least one diff header line
  const hasFileHeader = lines.some(
    (l) => l.startsWith('diff --git') || l.startsWith('--- ') || l.startsWith('+++ ')
  );
  if (!hasFileHeader) {
    return invalid(
      'This does not look like a standard unified diff. Make sure to copy the full diff output, starting with "diff --git" or "--- a/".'
    );
  }

  const files: DiffFile[] = [];
  let currentFile: DiffFile | null = null;
  let currentHunk: DiffHunk | null = null;
  let hunkCounter = 0;
  const allHunkIds: string[] = [];

  const pushHunk = () => {
    if (currentFile && currentHunk) {
      currentFile.hunks.push(currentHunk);
      currentFile.additions += currentHunk.additions;
      currentFile.deletions += currentHunk.deletions;
      currentHunk = null;
    }
  };

  const pushFile = () => {
    pushHunk();
    if (currentFile) files.push(currentFile);
    currentFile = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // New file in diff
    if (line.startsWith('diff --git ')) {
      pushFile();
      const match = line.match(/diff --git a\/(.*?) b\/(.*)/);
      const filename = match ? match[2] : line.replace('diff --git ', '');
      currentFile = emptyFile(filename);
      continue;
    }

    // Fallback: old-style diff (no git header)
    if (line.startsWith('--- ') && !currentFile) {
      pushFile();
      const filename = line.replace('--- a/', '').replace('--- ', '').trim();
      currentFile = emptyFile(filename === '/dev/null' ? '(new file)' : filename);
      continue;
    }

    if (!currentFile) continue;

    if (line.startsWith('new file mode')) {
      currentFile.isNew = true;
    } else if (line.startsWith('deleted file mode')) {
      currentFile.isDeleted = true;
    } else if (line.startsWith('Binary files')) {
      currentFile.isBinary = true;
    } else if (line.startsWith('+++ b/')) {
      // Prefer the b/ filename as the canonical name
      const name = line.replace('+++ b/', '').trim();
      if (name && name !== '/dev/null') currentFile.filename = name;
    } else if (line.startsWith('@@ ')) {
      pushHunk();
      hunkCounter++;
      const id = `H${hunkCounter}`;
      allHunkIds.push(id);
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      currentHunk = {
        id,
        fromLine: match ? parseInt(match[1], 10) : 0,
        toLine: match ? parseInt(match[2], 10) : 0,
        context: line,
        lines: [line],
        additions: 0,
        deletions: 0,
      };
    } else if (currentHunk) {
      currentHunk.lines.push(line);
      if (line.startsWith('+') && !line.startsWith('+++')) currentHunk.additions++;
      if (line.startsWith('-') && !line.startsWith('---')) currentHunk.deletions++;
    }
  }

  pushFile();

  if (files.length === 0) {
    return invalid('Could not detect any changed files in this diff. Please check the format.');
  }

  const totalAdditions = files.reduce((s, f) => s + f.additions, 0);
  const totalDeletions = files.reduce((s, f) => s + f.deletions, 0);

  // Build a summary string for the AI prompt (trusted data)
  const fileSummaries = files
    .map((f) => {
      const label = f.isNew ? ' [NEW FILE]' : f.isDeleted ? ' [DELETED]' : '';
      const hunkList = f.hunks
        .map((h) => `  ${h.id}: lines ~${h.toLine}–${h.toLine + h.additions + h.deletions} (+${h.additions}/-${h.deletions})`)
        .join('\n');
      return `File: ${f.filename}${label} (+${f.additions}/-${f.deletions})\n${hunkList}`;
    })
    .join('\n\n');

  const parsedSummary = `${files.length} file(s) changed. +${totalAdditions} additions, -${totalDeletions} deletions.\n\n${fileSummaries}`;

  return {
    files,
    totalAdditions,
    totalDeletions,
    totalFiles: files.length,
    hunkIds: allHunkIds,
    parsedSummary,
    isValid: true,
  };
}

function emptyFile(filename: string): DiffFile {
  return {
    filename,
    isNew: false,
    isDeleted: false,
    isBinary: false,
    additions: 0,
    deletions: 0,
    hunks: [],
  };
}

function invalid(errorMessage: string): ParsedDiff {
  return {
    files: [],
    totalAdditions: 0,
    totalDeletions: 0,
    totalFiles: 0,
    hunkIds: [],
    parsedSummary: '',
    isValid: false,
    errorMessage,
  };
}
