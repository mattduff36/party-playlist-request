#!/usr/bin/env tsx
/**
 * Simple link crawler for internal pages.
 * Outputs link-crawl-report.csv with URL, status, error, and first paint timing placeholder.
 */

import { writeFileSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const MAX_PAGES = Number(process.env.CRAWL_LIMIT || 50);

function isInternalLink(href: string): boolean {
  if (!href) return false;
  if (href.startsWith('#')) return false;
  if (href.startsWith('mailto:') || href.startsWith('tel:')) return false;
  if (href.startsWith('http')) return href.startsWith(BASE_URL);
  return href.startsWith('/');
}

function normalizeUrl(href: string): string {
  if (href.startsWith('http')) return href;
  if (href.startsWith('/')) return `${BASE_URL}${href}`;
  return `${BASE_URL}/${href}`;
}

async function extractLinks(html: string): Promise<string[]> {
  const links = new Set<string>();
  const regex = /href=\"([^\"]+)\"/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html))) {
    const href = match[1];
    if (isInternalLink(href)) links.add(normalizeUrl(href));
  }
  return Array.from(links);
}

async function crawl(): Promise<void> {
  const visited = new Set<string>();
  const queue: string[] = [BASE_URL];
  const rows: string[] = ['url,status,error,first_paint_ms'];

  while (queue.length && visited.size < MAX_PAGES) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);

    const start = Date.now();
    try {
      const res = await fetch(url, { redirect: 'manual' });
      const elapsed = Date.now() - start;
      rows.push(`${url},${res.status},,${elapsed}`);
      if (res.ok || res.status === 200) {
        const html = await res.text();
        const links = await extractLinks(html);
        for (const link of links) {
          if (!visited.has(link)) queue.push(link);
        }
      }
    } catch (err) {
      const elapsed = Date.now() - start;
      rows.push(`${url},0,${JSON.stringify(String(err)).replaceAll(',', ';')},${elapsed}`);
    }
  }

  writeFileSync('link-crawl-report.csv', rows.join('\n'));
  console.log(`🗺️  Crawled ${visited.size} page(s). Report: link-crawl-report.csv`);
}

crawl().catch((e) => {
  console.error('crawl failed', e);
  process.exit(1);
});


