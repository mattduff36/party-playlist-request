import fs from 'fs';
import path from 'path';
import { CANONICAL_MIGRATIONS } from '@/lib/db/migrate/registry';

const ROOT = path.join(__dirname, '..', '..');

describe('PRD-05: canonical migrations', () => {
  it('registry is ordered Class A/B only with on-disk SQL files', () => {
    expect(CANONICAL_MIGRATIONS.length).toBeGreaterThanOrEqual(6);
    const ids = CANONICAL_MIGRATIONS.map((m) => m.id);
    expect(ids).toEqual([...ids].sort());

    for (const migration of CANONICAL_MIGRATIONS) {
      expect(['A', 'B']).toContain(migration.classification);
      const filePath = path.join(
        ROOT,
        'src/lib/db/migrations/canonical',
        migration.file
      );
      expect(fs.existsSync(filePath)).toBe(true);
      const sql = fs.readFileSync(filePath, 'utf8');
      expect(sql.length).toBeGreaterThan(20);
      // Guardrails: no Class D drops of credential plaintext in auto migrations
      expect(sql).not.toMatch(/DROP COLUMN\s+access_token\b/i);
      expect(sql).not.toMatch(/DROP COLUMN\s+refresh_token\b/i);
      expect(sql).not.toMatch(/DROP COLUMN\s+pin\b/i);
    }
  });

  it('quarantines conflicting Drizzle 7→4 migrator away from active migrations/', () => {
    const active = path.join(ROOT, 'src/lib/db/migrations/0001_migrate_7_to_4_tables.sql');
    const quarantined = path.join(
      ROOT,
      'src/lib/db/_quarantine/drizzle-legacy/0001_migrate_7_to_4_tables.sql'
    );
    expect(fs.existsSync(active)).toBe(false);
    expect(fs.existsSync(quarantined)).toBe(true);
  });
});

describe('PRD-05: no request-time DDL in hot paths', () => {
  it('spotify-sync lease no longer CREATE TABLE at runtime', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'src/lib/spotify-sync/lease.ts'),
      'utf8'
    );
    expect(source).not.toMatch(/CREATE TABLE IF NOT EXISTS\s+spotify_playback_sync/i);
    expect(source).toMatch(/information_schema\.tables/);
  });

  it('database-cache no longer CREATE TABLE at runtime', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'src/lib/cache/database-cache.ts'),
      'utf8'
    );
    expect(source).not.toMatch(/CREATE TABLE IF NOT EXISTS\s+cache_entries/i);
  });

  it('poll route uses getPool not drizzle spotify_tokens table', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'src/app/api/events/poll/route.ts'),
      'utf8'
    );
    expect(source).toMatch(/getPool/);
    expect(source).toMatch(/FROM spotify_auth/);
    expect(source).not.toMatch(/FROM spotify_tokens/);
    expect(source).not.toMatch(/@\/lib\/db\/index/);
    expect(source).not.toMatch(/from ['\"]drizzle-orm['\"]/);
  });

  it('API routes do not call initializeDefaults / initializeDatabase', () => {
    const apiRoot = path.join(ROOT, 'src/app/api');
    const offenders: string[] = [];

    function walk(dir: string): void {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!entry.name.endsWith('.ts')) continue;
        const text = fs.readFileSync(full, 'utf8');
        if (
          /\binitializeDefaults\s*\(/.test(text) ||
          /\binitializeDatabase\s*\(/.test(text)
        ) {
          offenders.push(path.relative(ROOT, full));
        }
      }
    }

    walk(apiRoot);
    expect(offenders).toEqual([]);
  });
});

describe('PRD-05: next.config ignore flags documented debt', () => {
  it('still records ignore flags until QUALITY_GATE_DEBT cleared', () => {
    const config = fs.readFileSync(path.join(ROOT, 'next.config.ts'), 'utf8');
    // Intentionally still true — see docs/database/QUALITY_GATE_DEBT.md
    expect(config).toMatch(/ignoreDuringBuilds:\s*true/);
    expect(config).toMatch(/ignoreBuildErrors:\s*true/);
    expect(
      fs.existsSync(path.join(ROOT, 'docs/database/QUALITY_GATE_DEBT.md'))
    ).toBe(true);
  });
});
