/**
 * Fix Errors - Automated Error Analysis & Report Generator
 *
 * Fetches open rows from Neon `support_errors`, groups them into patterns,
 * writes docs_private/error-analysis.md + error-fix-log.md, and optionally
 * marks analyzed IDs resolved after the agent has applied code fixes.
 *
 * Usage:
 *   npm run fixerrors
 *   npm run fixerrors -- --exclude-localhost
 *   npm run fixerrors -- --resolve
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { relative, resolve } from 'path';
import * as fs from 'fs';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const ERROR_ANALYSIS_PATH = resolve(process.cwd(), 'docs_private', 'error-analysis.md');
const ERROR_FIX_LOG_PATH = resolve(process.cwd(), 'docs_private', 'error-fix-log.md');
const ERROR_ANALYSIS_META_PATH = resolve(
  process.cwd(),
  'docs_private',
  'error-analysis-meta.json'
);

export type ErrorLogEntry = {
  id: string;
  timestamp: string;
  error_message: string;
  error_stack: string | null;
  error_type: string;
  user_id: string | null;
  user_email: string | null;
  page_url: string;
  user_agent: string;
  component_name: string | null;
  additional_data: Record<string, unknown> | null;
};

type FixLogEntry = {
  signature: string;
  firstSeen: string;
  lastSeen: string;
  occurrences: number;
  status: 'untriaged' | 'investigating' | 'fix_applied' | 'resolved' | 'wontfix' | 'stale';
  fixerId?: string;
  plan?: string;
  notes?: string;
};

type FixLogData = {
  version: string;
  entries: FixLogEntry[];
};

export type SourceFileRef = {
  file: string;
  line?: number;
  column?: number;
};

export type ErrorPattern = {
  patternKey: string;
  errorType: string;
  component: string;
  normalizedMessage: string;
  occurrences: ErrorLogEntry[];
  sourceFiles: SourceFileRef[];
  affectedPages: string[];
  affectedUsers: string[];
  firstSeen: string;
  lastSeen: string;
};

type AnalysisMeta = {
  generatedAt: string;
  errorIds: string[];
  excludeLocalhost: boolean;
};

const SOURCE_SEARCH_DIRECTORIES = [
  'src',
  'src/app',
  'src/components',
  'src/lib',
  'src/hooks',
  'app',
  'components',
  'lib',
  'hooks',
];
const SOURCE_FILE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];
const IGNORED_SOURCE_DIRECTORIES = new Set([
  '.git',
  '.next',
  'node_modules',
  'docs_private',
  'plans',
  'coverage',
  'dist',
  'build',
  'test-results',
]);

function getDatabaseUrl(): string {
  const url =
    process.env.DATABASE_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.POSTGRES_URL;
  if (!url) {
    throw new Error('DATABASE_URL (or NEON_DATABASE_URL) is not set in .env.local');
  }
  return url;
}

function ensureDocsPrivateDir(): void {
  const dir = resolve(process.cwd(), 'docs_private');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function parseArgs(argv: string[]): { excludeLocalhost: boolean; resolveErrors: boolean } {
  return {
    excludeLocalhost: argv.includes('--exclude-localhost'),
    resolveErrors: argv.includes('--resolve'),
  };
}

function filterErrors(
  errors: ErrorLogEntry[],
  excludeLocalhost: boolean
): ErrorLogEntry[] {
  if (!excludeLocalhost) return errors;
  return errors.filter((error) => {
    if (error.page_url && error.page_url.toLowerCase().includes('localhost')) {
      return false;
    }
    return true;
  });
}

export function parseStackTrace(stack: string | null): SourceFileRef[] {
  if (!stack) return [];

  const refs: SourceFileRef[] = [];
  const seen = new Set<string>();

  const webpackPattern =
    /webpack-internal:\/\/\/[^)]*?\.\/([^:)]+?)(?::(\d+))?(?::(\d+))?(?:\)|$)/g;
  let match: RegExpExecArray | null;

  while ((match = webpackPattern.exec(stack)) !== null) {
    const file = match[1];
    const line = match[2] ? parseInt(match[2], 10) : undefined;
    const column = match[3] ? parseInt(match[3], 10) : undefined;
    if (file.includes('node_modules') || file.startsWith('__')) continue;
    const key = `${file}:${line || ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      refs.push({ file, line, column });
    }
  }

  const directPattern =
    /(?:\/app\/|\.\/)?((?:src\/)?(?:app|components|lib|hooks|utils|services)[^:)]*?)(?::(\d+))?(?::(\d+))?(?:\)|$)/g;

  while ((match = directPattern.exec(stack)) !== null) {
    const file = match[1];
    const line = match[2] ? parseInt(match[2], 10) : undefined;
    const column = match[3] ? parseInt(match[3], 10) : undefined;
    if (file.includes('node_modules')) continue;
    const key = `${file}:${line || ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      refs.push({ file, line, column });
    }
  }

  return refs;
}

function normalizeSourceFilePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\.\/+/, '');
}

function sourceRefKey(ref: SourceFileRef): string {
  return `${normalizeSourceFilePath(ref.file)}:${ref.line || ''}`;
}

function addSourceRef(refs: SourceFileRef[], seen: Set<string>, ref: SourceFileRef): void {
  const normalizedRef = {
    ...ref,
    file: normalizeSourceFilePath(ref.file),
  };
  const key = sourceRefKey(normalizedRef);
  if (!seen.has(key)) {
    seen.add(key);
    refs.push(normalizedRef);
  }
}

function collectSourceFiles(repoRoot: string): string[] {
  const files: string[] = [];

  const walk = (absoluteDirectory: string) => {
    if (!fs.existsSync(absoluteDirectory)) return;
    for (const entry of fs.readdirSync(absoluteDirectory, { withFileTypes: true })) {
      if (IGNORED_SOURCE_DIRECTORIES.has(entry.name)) continue;
      const absolutePath = resolve(absoluteDirectory, entry.name);
      if (entry.isDirectory()) {
        walk(absolutePath);
        continue;
      }
      if (!SOURCE_FILE_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) {
        continue;
      }
      files.push(normalizeSourceFilePath(relative(repoRoot, absolutePath)));
    }
  };

  for (const directory of SOURCE_SEARCH_DIRECTORIES) {
    walk(resolve(repoRoot, directory));
  }

  return files;
}

function findExistingSourceFile(preferredFile: string, repoRoot: string): string {
  const normalizedPreferred = normalizeSourceFilePath(preferredFile);
  const candidates = [
    normalizedPreferred,
    normalizedPreferred.startsWith('src/')
      ? normalizedPreferred
      : `src/${normalizedPreferred}`,
  ];

  for (const candidateBase of candidates) {
    const extensionless = candidateBase.replace(/\.[^.]+$/, '');
    for (const extension of SOURCE_FILE_EXTENSIONS) {
      const candidate = `${extensionless}${extension}`;
      if (fs.existsSync(resolve(repoRoot, candidate))) {
        return candidate;
      }
    }
  }

  return normalizedPreferred;
}

function normalizePath(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return pathname
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/<ID>')
      .replace(/\/\d+(?=\/|$)/g, '/<N>');
  } catch {
    return url;
  }
}

function getPagePath(pageUrl: string | null | undefined): string | null {
  if (!pageUrl) return null;
  const path = normalizePath(pageUrl);
  return path.startsWith('/') ? path : null;
}

function routePathFromAppPageFile(file: string): string | null {
  const normalized = normalizeSourceFilePath(file);
  const match = normalized.match(
    /^(?:src\/)?app\/(.+)\/(?:page|layout)\.(?:tsx|ts|jsx|js)$/
  );
  if (!match) return null;

  const routeSegments = match[1]
    .split('/')
    .filter((segment) => !segment.startsWith('(') && !segment.startsWith('@'));

  return `/${routeSegments.join('/')}`.replace(/\/+/g, '/') || '/';
}

function extractNextAppChunkSourceRefs(text: string, repoRoot: string): SourceFileRef[] {
  const refs: SourceFileRef[] = [];
  const seen = new Set<string>();
  const nextAppChunkPattern =
    /\/_next\/static\/chunks\/app\/(.+?)\/(page|layout|route)-[A-Za-z0-9_-]+\.js/g;
  let match: RegExpExecArray | null;

  while ((match = nextAppChunkPattern.exec(text)) !== null) {
    const routePath = decodeURIComponent(match[1]);
    const sourceFile = findExistingSourceFile(
      `src/app/${routePath}/${match[2]}.tsx`,
      repoRoot
    );
    addSourceRef(refs, seen, { file: sourceFile });
  }

  return refs;
}

function inferSourceRefsFromPageRoute(pageUrl: string, repoRoot: string): SourceFileRef[] {
  const pagePath = getPagePath(pageUrl);
  if (!pagePath) return [];

  return collectSourceFiles(repoRoot)
    .filter((file) => routePathFromAppPageFile(file) === pagePath)
    .map((file) => ({ file }));
}

function buildSourceSearchText(error: ErrorLogEntry): string {
  const parts = [error.error_stack || '', error.error_message || ''];
  if (error.additional_data) {
    try {
      parts.push(JSON.stringify(error.additional_data));
    } catch {
      // ignore
    }
  }
  return parts.join('\n');
}

export function extractSourceFilesForError(
  error: ErrorLogEntry,
  repoRoot = process.cwd()
): SourceFileRef[] {
  const refs: SourceFileRef[] = [];
  const seen = new Set<string>();
  const searchText = buildSourceSearchText(error);

  for (const ref of parseStackTrace(error.error_stack)) {
    addSourceRef(refs, seen, {
      ...ref,
      file: findExistingSourceFile(ref.file, repoRoot),
    });
  }

  if (refs.length === 0) {
    for (const ref of extractNextAppChunkSourceRefs(searchText, repoRoot)) {
      addSourceRef(refs, seen, ref);
    }
  }

  if (refs.length === 0) {
    for (const ref of inferSourceRefsFromPageRoute(error.page_url || '', repoRoot)) {
      addSourceRef(refs, seen, ref);
    }
  }

  // Message-based hint for common ReferenceErrors
  if (refs.length === 0 && /is not defined/i.test(error.error_message || '')) {
    const msgMatch = (error.error_message || '').match(/([A-Za-z_$][\w$]*) is not defined/);
    if (msgMatch) {
      const symbol = msgMatch[1];
      for (const file of collectSourceFiles(repoRoot)) {
        if (file.includes('SidebarSpotify') || file.includes('spotify')) {
          const content = fs.readFileSync(resolve(repoRoot, file), 'utf-8');
          if (content.includes(symbol) || content.includes('getSpotifyDeviceIcon')) {
            addSourceRef(refs, seen, { file });
          }
        }
      }
    }
  }

  return refs;
}

function normalizeMessage(message: string): string {
  return message
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      '<UUID>'
    )
    .replace(/\b[0-9a-f]{24,}\b/gi, '<ID>')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^\s]*/g, '<TIMESTAMP>')
    .replace(/https?:\/\/[^\s)]+/g, '<URL>')
    .trim()
    .substring(0, 200);
}

function createPatternKey(error: ErrorLogEntry): string {
  const type = error.error_type || 'Unknown';
  const component = error.component_name || 'NoComponent';
  const normalizedMsg = normalizeMessage(error.error_message || '');
  return `${type}::${component}::${normalizedMsg}`;
}

export function groupIntoPatterns(
  errors: ErrorLogEntry[],
  repoRoot = process.cwd()
): ErrorPattern[] {
  const patternMap = new Map<string, ErrorPattern>();

  for (const error of errors) {
    const key = createPatternKey(error);

    if (!patternMap.has(key)) {
      patternMap.set(key, {
        patternKey: key,
        errorType: error.error_type || 'Unknown',
        component: error.component_name || 'Unknown',
        normalizedMessage: normalizeMessage(error.error_message || ''),
        occurrences: [],
        sourceFiles: [],
        affectedPages: [],
        affectedUsers: [],
        firstSeen: error.timestamp,
        lastSeen: error.timestamp,
      });
    }

    const pattern = patternMap.get(key)!;
    pattern.occurrences.push(error);

    if (error.timestamp < pattern.firstSeen) pattern.firstSeen = error.timestamp;
    if (error.timestamp > pattern.lastSeen) pattern.lastSeen = error.timestamp;

    const pagePath = error.page_url ? normalizePath(error.page_url) : 'Unknown';
    if (!pattern.affectedPages.includes(pagePath)) {
      pattern.affectedPages.push(pagePath);
    }

    const userLabel = error.user_email || error.user_id || 'anonymous';
    if (!pattern.affectedUsers.includes(userLabel)) {
      pattern.affectedUsers.push(userLabel);
    }

    const refs = extractSourceFilesForError(error, repoRoot);
    for (const ref of refs) {
      const exists = pattern.sourceFiles.some(
        (s) => s.file === ref.file && s.line === ref.line
      );
      if (!exists) {
        pattern.sourceFiles.push(ref);
      }
    }
  }

  return Array.from(patternMap.values()).sort(
    (a, b) => b.occurrences.length - a.occurrences.length
  );
}

function generateReport(
  patterns: ErrorPattern[],
  totalFetched: number,
  totalFiltered: number,
  errorIds: string[]
): string {
  const now = new Date().toISOString();
  const lines: string[] = [];

  lines.push('# Error Analysis Report');
  lines.push('');
  lines.push(`> **Generated:** ${now}`);
  lines.push(
    `> **Errors fetched from DB:** ${totalFetched} | **After filtering:** ${totalFiltered} | **Patterns found:** ${patterns.length}`
  );
  lines.push('');
  lines.push('```error-ids');
  lines.push(JSON.stringify(errorIds));
  lines.push('```');
  lines.push('');
  lines.push('This file is overwritten each time `npm run fixerrors` runs.');
  lines.push('Source: Neon `support_errors` (unresolved rows).');
  lines.push('After applying code fixes, run `npm run fixerrors -- --resolve`.');
  lines.push('');

  if (patterns.length === 0) {
    lines.push('## No errors found');
    lines.push('');
    lines.push('No unresolved support errors match the current filters.');
    lines.push('');
    return lines.join('\n');
  }

  lines.push('## Summary');
  lines.push('');
  lines.push(
    '| # | Error Type | Component | Occurrences | Affected Pages | Source Files | First Seen | Last Seen |'
  );
  lines.push(
    '|---|-----------|-----------|-------------|----------------|-------------|------------|-----------|'
  );

  patterns.forEach((p, i) => {
    const first = new Date(p.firstSeen).toLocaleDateString('en-GB');
    const last = new Date(p.lastSeen).toLocaleDateString('en-GB');
    lines.push(
      `| ${i + 1} | ${p.errorType} | ${p.component} | ${p.occurrences.length} | ${p.affectedPages.length} | ${p.sourceFiles.length} | ${first} | ${last} |`
    );
  });
  lines.push('');

  lines.push('## Error Patterns (by frequency)');
  lines.push('');

  patterns.forEach((p, i) => {
    lines.push(
      `### ${i + 1}. ${p.errorType} in ${p.component} (${p.occurrences.length} occurrences)`
    );
    lines.push('');
    lines.push(`**Normalized message:** \`${p.normalizedMessage}\``);
    lines.push('');

    const latest = [...p.occurrences].sort((a, b) =>
      a.timestamp < b.timestamp ? 1 : -1
    )[0];
    lines.push('**Latest full message:**');
    lines.push('```');
    lines.push((latest.error_message || '').substring(0, 500));
    lines.push('```');
    lines.push('');
    lines.push(`**Error IDs:** ${p.occurrences.map((o) => o.id).join(', ')}`);
    lines.push('');
    lines.push(`**Affected pages:** ${p.affectedPages.join(', ')}`);
    lines.push('');
    lines.push(
      `**Affected users:** ${p.affectedUsers.length} unique (${p.affectedUsers.slice(0, 5).join(', ')}${p.affectedUsers.length > 5 ? '...' : ''})`
    );
    lines.push('');

    if (p.sourceFiles.length > 0) {
      lines.push('**Source files (from stack trace or inference):**');
      for (const ref of p.sourceFiles.slice(0, 10)) {
        const loc = ref.line
          ? `${ref.file}:${ref.line}${ref.column ? ':' + ref.column : ''}`
          : ref.file;
        lines.push(`- \`${loc}\``);
      }
      lines.push('');
    } else {
      lines.push('**Source files:** No source file references found in stack trace');
      lines.push('');
    }

    if (latest.error_stack) {
      const stackExcerpt = latest.error_stack.split('\n').slice(0, 8).join('\n');
      lines.push('**Stack trace excerpt:**');
      lines.push('```');
      lines.push(stackExcerpt);
      lines.push('```');
      lines.push('');
    }

    lines.push(`**First seen:** ${p.firstSeen} | **Last seen:** ${p.lastSeen}`);
    lines.push('');
    lines.push('---');
    lines.push('');
  });

  lines.push('## Actionable Items');
  lines.push('');
  patterns.forEach((p, i) => {
    if (p.sourceFiles.length > 0) {
      const topFile = p.sourceFiles[0];
      const loc = topFile.line ? `${topFile.file}:${topFile.line}` : topFile.file;
      lines.push(
        `${i + 1}. **\`${loc}\`** - ${p.errorType}: ${p.normalizedMessage.substring(0, 100)} (${p.occurrences.length}x)`
      );
    } else {
      lines.push(
        `${i + 1}. **${p.component}** - ${p.errorType}: ${p.normalizedMessage.substring(0, 100)} (${p.occurrences.length}x)`
      );
    }
  });
  lines.push('');

  return lines.join('\n');
}

function loadFixLog(): FixLogData {
  if (!fs.existsSync(ERROR_FIX_LOG_PATH)) {
    return { version: '1.0.0', entries: [] };
  }
  const content = fs.readFileSync(ERROR_FIX_LOG_PATH, 'utf-8');
  const jsonMatch = content.match(/```json[\r\n]+([\s\S]*?)[\r\n]+```/);
  if (!jsonMatch) return { version: '1.0.0', entries: [] };
  try {
    return JSON.parse(jsonMatch[1]);
  } catch {
    return { version: '1.0.0', entries: [] };
  }
}

function saveFixLog(data: FixLogData): void {
  const block = `\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
  const content = [
    '# Error Fix Log',
    '',
    '**Last Updated:** *Auto-updated by fixerrors script*',
    '',
    'This file tracks known errors historically. See `error-analysis.md` for the latest analysis.',
    '',
    '## Machine-Readable Data',
    '',
    block,
    '',
  ].join('\n');
  fs.writeFileSync(ERROR_FIX_LOG_PATH, content, 'utf-8');
}

function createLegacySignature(error: ErrorLogEntry): string {
  const type = error.error_type || 'Unknown';
  const message = (error.error_message || '').trim().substring(0, 200);
  const component = error.component_name || 'NoComponent';
  let page = 'NoPage';
  try {
    page = new URL(error.page_url).pathname;
  } catch {
    page = error.page_url || 'NoPage';
  }
  return `${type}::${component}::${page}::${message}`;
}

function updateFixLog(errors: ErrorLogEntry[]): void {
  const fixLog = loadFixLog();
  const seenSignatures = new Set<string>();

  for (const error of errors) {
    const signature = createLegacySignature(error);
    seenSignatures.add(signature);
    const existing = fixLog.entries.find((e) => e.signature === signature);
    if (existing) {
      existing.lastSeen = error.timestamp;
      existing.occurrences++;
      if (existing.status === 'stale') existing.status = 'investigating';
    } else {
      fixLog.entries.push({
        signature,
        firstSeen: error.timestamp,
        lastSeen: error.timestamp,
        occurrences: 1,
        status: 'untriaged',
        plan: 'Needs investigation',
        notes: `Type: ${error.error_type}\nComponent: ${error.component_name || 'N/A'}\nPage: ${error.page_url}`,
      });
    }
  }

  for (const entry of fixLog.entries) {
    if (
      !seenSignatures.has(entry.signature) &&
      entry.status !== 'resolved' &&
      entry.status !== 'wontfix'
    ) {
      entry.status = 'stale';
    }
  }

  saveFixLog(fixLog);
}

async function fetchOpenSupportErrors(pool: Pool): Promise<ErrorLogEntry[]> {
  const result = await pool.query(
    `SELECT id, created_at, level, source, message, stack, route,
            user_id, username, user_agent, meta
     FROM support_errors
     WHERE resolved = FALSE
     ORDER BY created_at DESC
     LIMIT 500`
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    timestamp: new Date(row.created_at).toISOString(),
    error_message: row.message || '',
    error_stack: row.stack || null,
    error_type: row.level || 'error',
    user_id: row.user_id ? String(row.user_id) : null,
    user_email: row.username || null,
    page_url: row.route || '',
    user_agent: row.user_agent || '',
    component_name: row.source || 'unknown',
    additional_data:
      row.meta && typeof row.meta === 'object'
        ? (row.meta as Record<string, unknown>)
        : null,
  }));
}

function loadAnalysisMeta(): AnalysisMeta | null {
  if (!fs.existsSync(ERROR_ANALYSIS_META_PATH)) {
    // Fallback: parse IDs from markdown report
    if (!fs.existsSync(ERROR_ANALYSIS_PATH)) return null;
    const content = fs.readFileSync(ERROR_ANALYSIS_PATH, 'utf-8');
    const match = content.match(/```error-ids\s*([\s\S]*?)```/);
    if (!match) return null;
    try {
      const errorIds = JSON.parse(match[1].trim()) as string[];
      return {
        generatedAt: new Date().toISOString(),
        errorIds,
        excludeLocalhost: false,
      };
    } catch {
      return null;
    }
  }
  try {
    return JSON.parse(fs.readFileSync(ERROR_ANALYSIS_META_PATH, 'utf-8')) as AnalysisMeta;
  } catch {
    return null;
  }
}

async function resolveReportedErrors(pool: Pool): Promise<number> {
  const meta = loadAnalysisMeta();
  if (!meta || meta.errorIds.length === 0) {
    console.log('No analysis meta / error IDs found. Run `npm run fixerrors` first.');
    return 0;
  }

  const result = await pool.query(
    `UPDATE support_errors
     SET resolved = TRUE, resolved_at = NOW(), resolved_by = 'fixerrors'
     WHERE id = ANY($1::uuid[])
       AND resolved = FALSE
     RETURNING id`,
    [meta.errorIds]
  );

  // Update fix log statuses for signatures covered by this resolve
  const fixLog = loadFixLog();
  for (const entry of fixLog.entries) {
    if (entry.status === 'untriaged' || entry.status === 'investigating') {
      entry.status = 'fix_applied';
    }
  }
  saveFixLog(fixLog);

  return result.rowCount ?? 0;
}

async function analyze(excludeLocalhost: boolean): Promise<void> {
  ensureDocsPrivateDir();
  const pool = new Pool({ connectionString: getDatabaseUrl() });

  try {
    console.log('Fetching open support_errors...');
    const rawErrors = await fetchOpenSupportErrors(pool);
    console.log(`  Fetched ${rawErrors.length} unresolved error(s)`);

    const errors = filterErrors(rawErrors, excludeLocalhost);
    const filteredOut = rawErrors.length - errors.length;
    if (excludeLocalhost) {
      console.log(
        `  Filtered out ${filteredOut} (localhost) -> ${errors.length} remaining`
      );
    }

    const patterns = groupIntoPatterns(errors);
    const errorIds = errors.map((e) => e.id);

    const report = generateReport(
      patterns,
      rawErrors.length,
      errors.length,
      errorIds
    );
    fs.writeFileSync(ERROR_ANALYSIS_PATH, report, 'utf-8');
    console.log(`  Wrote ${ERROR_ANALYSIS_PATH}`);

    const meta: AnalysisMeta = {
      generatedAt: new Date().toISOString(),
      errorIds,
      excludeLocalhost,
    };
    fs.writeFileSync(ERROR_ANALYSIS_META_PATH, JSON.stringify(meta, null, 2), 'utf-8');

    updateFixLog(errors);
    console.log(`  Updated ${ERROR_FIX_LOG_PATH}`);

    console.log('');
    console.log('Summary:');
    console.log(`  Patterns: ${patterns.length}`);
    for (const pattern of patterns.slice(0, 10)) {
      console.log(
        `  - [${pattern.errorType}/${pattern.component}] ${pattern.normalizedMessage.substring(0, 80)} (${pattern.occurrences.length}x)`
      );
    }
    if (patterns.length === 0) {
      console.log('  No unresolved errors to fix.');
    } else {
      console.log('');
      console.log('Next: read docs_private/error-analysis.md, apply code fixes, then:');
      console.log('  npm run fixerrors -- --resolve');
    }
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  const { excludeLocalhost, resolveErrors } = parseArgs(process.argv.slice(2));

  if (resolveErrors) {
    ensureDocsPrivateDir();
    const pool = new Pool({ connectionString: getDatabaseUrl() });
    try {
      console.log('Resolving analyzed support_errors...');
      const count = await resolveReportedErrors(pool);
      console.log(`  Marked ${count} error(s) as resolved (resolved_by=fixerrors).`);
    } finally {
      await pool.end();
    }
    return;
  }

  await analyze(excludeLocalhost);
}

main().catch((error) => {
  console.error('fixerrors failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
