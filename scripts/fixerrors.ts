/**
 * Fix Errors - Automated Error Analysis & Report Generator
 *
 * Fetches open rows from Neon `support_errors`, clusters identical/similar
 * issues (fingerprint / normalized message / route / status), writes
 * docs_private/error-analysis.md + error-fix-log.md, and optionally marks
 * analyzed IDs resolved after the agent has applied code fixes.
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
import {
  buildErrorFingerprint,
  normalizeErrorRoute,
} from '../src/lib/support/fingerprint';
import {
  entryFromDbRow,
  groupIntoPatterns as groupPatternsCore,
  type ErrorLogEntry,
  type ErrorPattern,
  type SourceFileRef,
} from '../src/lib/support/error-patterns';

export type { ErrorLogEntry, ErrorPattern, SourceFileRef };

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const ERROR_ANALYSIS_PATH = resolve(process.cwd(), 'docs_private', 'error-analysis.md');
const ERROR_FIX_LOG_PATH = resolve(process.cwd(), 'docs_private', 'error-fix-log.md');
const ERROR_ANALYSIS_META_PATH = resolve(
  process.cwd(),
  'docs_private',
  'error-analysis-meta.json'
);

const SAMPLE_IDS_PER_PATTERN = 12;
const MAX_RAW_ROWS_FOR_ENRICHMENT = 2000;

interface FixLogEntry {
  signature: string;
  firstSeen: string;
  lastSeen: string;
  occurrences: number;
  status: 'untriaged' | 'investigating' | 'fix_applied' | 'resolved' | 'wontfix' | 'stale';
  fixerId?: string;
  plan?: string;
  notes?: string;
}

interface FixLogData {
  version: string;
  entries: FixLogEntry[];
}

interface AnalysisMeta {
  generatedAt: string;
  errorIds: string[];
  excludeLocalhost: boolean;
  patternSummaries: Array<{
    fingerprint: string;
    classification: string;
    totalOccurrences: number;
    rowCount: number;
    message: string;
  }>;
}

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
  const path = normalizeErrorRoute(url);
  return path || url;
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

  return refs;
}

export function groupIntoPatterns(
  errors: ErrorLogEntry[],
  repoRoot = process.cwd()
): ErrorPattern[] {
  return groupPatternsCore(errors, (error) =>
    extractSourceFilesForError(error, repoRoot)
  );
}

function generateReport(
  patterns: ErrorPattern[],
  totalFetched: number,
  totalFiltered: number,
  errorIds: string[],
  consolidatedRows: number
): string {
  const now = new Date().toISOString();
  const lines: string[] = [];
  const unhandled = patterns.filter((p) => p.classification === 'unhandled');
  const handled = patterns.filter((p) => p.classification === 'handled');
  const totalHits = patterns.reduce((sum, p) => sum + p.totalOccurrences, 0);

  lines.push('# Error Analysis Report');
  lines.push('');
  lines.push(`> **Generated:** ${now}`);
  lines.push(
    `> **Raw open rows scanned:** ${totalFetched} | **After filtering:** ${totalFiltered} | **Distinct clusters:** ${patterns.length} | **Total hits (occurrence sum):** ${totalHits}`
  );
  lines.push(
    `> **Unhandled clusters:** ${unhandled.length} | **Handled/noise clusters:** ${handled.length}${consolidatedRows ? ` | **Legacy rows consolidated:** ${consolidatedRows}` : ''}`
  );
  lines.push('');
  lines.push('```error-ids');
  lines.push(JSON.stringify(errorIds));
  lines.push('```');
  lines.push('');
  lines.push('This file is overwritten each time `npm run fixerrors` runs.');
  lines.push('Source: Neon `support_errors` (unresolved rows), clustered by fingerprint.');
  lines.push('Duplicates are reported as one issue with an occurrence count — not listed row-by-row.');
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
    '| # | Class | Source | Occurrences | Rows | Pages | Actionable | First Seen | Last Seen |'
  );
  lines.push(
    '|---|-------|--------|-------------|------|-------|------------|------------|-----------|'
  );

  patterns.forEach((p, i) => {
    const first = new Date(p.firstSeen).toLocaleDateString('en-GB');
    const last = new Date(p.lastSeen).toLocaleDateString('en-GB');
    lines.push(
      `| ${i + 1} | ${p.classification} | ${p.component} | ${p.totalOccurrences} | ${p.rowCount} | ${p.affectedPages.length} | ${p.actionable ? 'yes' : 'no'} | ${first} | ${last} |`
    );
  });
  lines.push('');

  lines.push('## Error Clusters (unhandled first, then by frequency)');
  lines.push('');

  patterns.forEach((p, i) => {
    lines.push(
      `### ${i + 1}. [${p.classification}] ${p.errorType} in ${p.component} (${p.totalOccurrences} hits / ${p.rowCount} rows)`
    );
    lines.push('');
    lines.push(`**Fingerprint:** \`${p.fingerprint.substring(0, 160)}\``);
    lines.push('');
    lines.push(`**Normalized message:** \`${p.normalizedMessage}\``);
    lines.push('');
    if (p.noiseReason) {
      lines.push(`**Noise / non-actionable:** ${p.noiseReason}`);
      lines.push('');
    }

    const latest = [...p.occurrences].sort((a, b) =>
      (a.lastSeen || a.timestamp) < (b.lastSeen || b.timestamp) ? 1 : -1
    )[0];
    lines.push('**Latest full message:**');
    lines.push('```');
    lines.push((latest?.error_message || '').substring(0, 500));
    lines.push('```');
    lines.push('');
    const sampleIds = p.allErrorIds.slice(0, SAMPLE_IDS_PER_PATTERN);
    lines.push(
      `**Sample error IDs (${sampleIds.length} of ${p.allErrorIds.length}):** ${sampleIds.join(', ')}`
    );
    lines.push('');
    lines.push(`**Affected pages/routes:** ${p.affectedPages.join(', ')}`);
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

    if (latest?.error_stack) {
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
  const actionable = patterns.filter((p) => p.actionable);
  if (actionable.length === 0) {
    lines.push(
      'No actionable codebase issues in this batch. Remaining clusters are handled/expected noise (e.g. Spotify 429). Safe to resolve after confirming logging dedup is in place.'
    );
    lines.push('');
  } else {
    actionable.forEach((p, i) => {
      if (p.sourceFiles.length > 0) {
        const topFile = p.sourceFiles[0];
        const loc = topFile.line ? `${topFile.file}:${topFile.line}` : topFile.file;
        lines.push(
          `${i + 1}. **\`${loc}\`** - ${p.errorType}: ${p.normalizedMessage.substring(0, 100)} (${p.totalOccurrences}x)`
        );
      } else {
        lines.push(
          `${i + 1}. **${p.component}** - ${p.errorType}: ${p.normalizedMessage.substring(0, 100)} (${p.totalOccurrences}x)`
        );
      }
    });
    lines.push('');
  }

  if (handled.length > 0) {
    lines.push('## Handled / noise (informational)');
    lines.push('');
    handled.forEach((p) => {
      lines.push(
        `- ${p.component}: ${p.normalizedMessage.substring(0, 120)} (${p.totalOccurrences}x) — ${p.noiseReason || 'handled'}`
      );
    });
    lines.push('');
  }

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

function updateFixLog(patterns: ErrorPattern[]): void {
  const fixLog = loadFixLog();
  const seenSignatures = new Set<string>();

  for (const pattern of patterns) {
    const signature = pattern.fingerprint;
    seenSignatures.add(signature);
    const existing = fixLog.entries.find((e) => e.signature === signature);
    if (existing) {
      existing.lastSeen = pattern.lastSeen;
      existing.occurrences = pattern.totalOccurrences;
      if (existing.status === 'stale') existing.status = 'investigating';
      existing.notes = `Class: ${pattern.classification}\nSource: ${pattern.component}\nMessage: ${pattern.normalizedMessage}`;
    } else {
      fixLog.entries.push({
        signature,
        firstSeen: pattern.firstSeen,
        lastSeen: pattern.lastSeen,
        occurrences: pattern.totalOccurrences,
        status: pattern.actionable ? 'untriaged' : 'wontfix',
        plan: pattern.actionable
          ? 'Needs investigation'
          : pattern.noiseReason || 'Handled/expected',
        notes: `Class: ${pattern.classification}\nSource: ${pattern.component}\nMessage: ${pattern.normalizedMessage}`,
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

/**
 * Ensure schema columns exist + mark known expected failures as handled.
 * Collapse legacy duplicate open rows that share a fingerprint into one row.
 */
async function prepareSupportErrorTable(pool: Pool): Promise<number> {
  await pool.query(`
    ALTER TABLE support_errors
      ADD COLUMN IF NOT EXISTS fingerprint TEXT,
      ADD COLUMN IF NOT EXISTS occurrence_count INTEGER NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS classification TEXT NOT NULL DEFAULT 'unhandled'
  `);

  await pool.query(`
    UPDATE support_errors
    SET classification = 'handled'
    WHERE resolved = FALSE
      AND (
        message ~* '429|rate limit|rate limited|backoff|too many requests'
        OR COALESCE(meta->>'status', '') = '429'
        OR COALESCE(meta->>'throttled', '') = 'true'
        OR COALESCE(meta->>'handled', '') = 'true'
        OR COALESCE(meta->>'expected', '') = 'true'
        OR COALESCE(meta->>'transient', '') = 'true'
        OR (
          source = 'spotify'
          AND (
            message ~* 'Spotify API (502|503|504)\\b'
            OR COALESCE(meta->>'status', '') IN ('502', '503', '504')
          )
        )
      )
  `);

  // Backfill fingerprints for open rows missing them (best-effort in SQL-ish JS below)
  const missing = await pool.query(
    `SELECT id, level, source, message, stack, route, method, meta, classification
     FROM support_errors
     WHERE resolved = FALSE AND (fingerprint IS NULL OR fingerprint = '')
     LIMIT 5000`
  );

  for (const row of missing.rows) {
    const fp = buildErrorFingerprint({
      source: row.source,
      message: row.message || '',
      stack: row.stack,
      route: row.route,
      method: row.method,
      meta: row.meta,
      classification: row.classification,
    });
    await pool.query(`UPDATE support_errors SET fingerprint = $2 WHERE id = $1`, [
      row.id,
      fp,
    ]);
  }

  // Collapse duplicate open fingerprints: keep newest, sum counts, delete rest
  const dupes = await pool.query(`
    SELECT fingerprint, array_agg(id::text ORDER BY COALESCE(last_seen_at, created_at) DESC) AS ids,
           SUM(COALESCE(occurrence_count, 1))::int AS total_hits,
           MIN(created_at) AS first_seen
    FROM support_errors
    WHERE resolved = FALSE
      AND fingerprint IS NOT NULL
      AND fingerprint <> ''
    GROUP BY fingerprint
    HAVING COUNT(*) > 1
  `);

  let consolidated = 0;
  for (const group of dupes.rows) {
    const ids = group.ids as string[];
    const keepId = ids[0];
    const dropIds = ids.slice(1);
    if (dropIds.length === 0) continue;

    await pool.query(
      `UPDATE support_errors
       SET occurrence_count = $2,
           created_at = LEAST(created_at, $3),
           last_seen_at = GREATEST(COALESCE(last_seen_at, created_at), NOW()),
           classification = CASE
             WHEN classification = 'unhandled' THEN 'unhandled'
             ELSE classification
           END
       WHERE id = $1::uuid`,
      [keepId, group.total_hits, group.first_seen]
    );
    await pool.query(
      `DELETE FROM support_errors WHERE id = ANY($1::uuid[])`,
      [dropIds]
    );
    consolidated += dropIds.length;
  }

  try {
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_support_errors_fp_open_unique
      ON support_errors(fingerprint)
      WHERE resolved = FALSE AND fingerprint IS NOT NULL
    `);
  } catch (err) {
    console.warn(
      '  Warning: could not ensure unique fingerprint index:',
      (err as Error).message
    );
  }

  return consolidated;
}

async function fetchOpenSupportErrors(pool: Pool): Promise<ErrorLogEntry[]> {
  const result = await pool.query(
    `SELECT id, created_at, last_seen_at, level, source, message, stack, route,
            method, user_id, username, user_agent, meta,
            fingerprint, occurrence_count, classification
     FROM support_errors
     WHERE resolved = FALSE
     ORDER BY COALESCE(last_seen_at, created_at) DESC
     LIMIT $1`,
    [MAX_RAW_ROWS_FOR_ENRICHMENT]
  );

  return result.rows.map((row) => entryFromDbRow(row));
}

function loadAnalysisMeta(): AnalysisMeta | null {
  if (!fs.existsSync(ERROR_ANALYSIS_META_PATH)) {
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
        patternSummaries: [],
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

  const fixLog = loadFixLog();
  for (const entry of fixLog.entries) {
    if (entry.status === 'untriaged' || entry.status === 'investigating' || entry.status === 'wontfix') {
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
    console.log('Preparing support_errors (classification + fingerprint consolidation)...');
    const consolidatedRows = await prepareSupportErrorTable(pool);
    if (consolidatedRows > 0) {
      console.log(`  Consolidated ${consolidatedRows} legacy duplicate row(s)`);
    }

    console.log('Fetching open support_errors...');
    const rawErrors = await fetchOpenSupportErrors(pool);
    console.log(`  Fetched ${rawErrors.length} unresolved row(s) (post-consolidation)`);

    const errors = filterErrors(rawErrors, excludeLocalhost);
    const filteredOut = rawErrors.length - errors.length;
    if (excludeLocalhost) {
      console.log(
        `  Filtered out ${filteredOut} (localhost) -> ${errors.length} remaining`
      );
    }

    const patterns = groupIntoPatterns(errors);
    const errorIds = patterns.flatMap((p) => p.allErrorIds);

    const report = generateReport(
      patterns,
      rawErrors.length,
      errors.length,
      errorIds,
      consolidatedRows
    );
    fs.writeFileSync(ERROR_ANALYSIS_PATH, report, 'utf-8');
    console.log(`  Wrote ${ERROR_ANALYSIS_PATH}`);

    const meta: AnalysisMeta = {
      generatedAt: new Date().toISOString(),
      errorIds,
      excludeLocalhost,
      patternSummaries: patterns.map((p) => ({
        fingerprint: p.fingerprint,
        classification: p.classification,
        totalOccurrences: p.totalOccurrences,
        rowCount: p.rowCount,
        message: p.normalizedMessage,
      })),
    };
    fs.writeFileSync(ERROR_ANALYSIS_META_PATH, JSON.stringify(meta, null, 2), 'utf-8');

    updateFixLog(patterns);
    console.log(`  Updated ${ERROR_FIX_LOG_PATH}`);

    console.log('');
    console.log('Summary:');
    console.log(
      `  Clusters: ${patterns.length} (${patterns.filter((p) => p.classification === 'unhandled').length} unhandled, ${patterns.filter((p) => p.classification === 'handled').length} handled)`
    );
    for (const pattern of patterns.slice(0, 10)) {
      console.log(
        `  - [${pattern.classification}/${pattern.component}] ${pattern.normalizedMessage.substring(0, 70)} (${pattern.totalOccurrences}x)`
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
