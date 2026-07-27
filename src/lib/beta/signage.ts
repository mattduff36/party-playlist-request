/**
 * Server-side printable QR signage (PRD-08).
 * Real PDF generation via pdfkit — not a webpage screenshot.
 */

import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

export type SignageFormat = 'a4' | 'a5' | 'table_card' | 'screen_16x9';

export interface SignageOptions {
  format: SignageFormat;
  eventTitle: string;
  joinUrl: string;
  accessCode?: string | null;
  /** Only include access code when organiser explicitly opts in */
  includeAccessCode: boolean;
  instructions?: string;
  brandColor?: string;
  accentColor?: string;
}

interface PageSize {
  width: number;
  height: number;
  margin: number;
  label: string;
}

const SIZES: Record<SignageFormat, PageSize> = {
  a4: { width: 595.28, height: 841.89, margin: 48, label: 'A4' },
  a5: { width: 419.53, height: 595.28, margin: 36, label: 'A5' },
  table_card: { width: 396.85, height: 280.63, margin: 28, label: 'Table card' },
  screen_16x9: { width: 842, height: 473.625, margin: 40, label: '16:9 screen' },
};

function assertGuestOrDisplayUrl(url: string): void {
  const lower = url.toLowerCase();
  if (lower.includes('/admin') || lower.includes('/superadmin')) {
    throw new Error('Signage URL must not point to admin or private routes');
  }
  if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) {
    throw new Error('Signage URL must be an http(s) or site-relative path');
  }
}

export async function generateSignagePdf(
  options: SignageOptions
): Promise<Buffer> {
  assertGuestOrDisplayUrl(options.joinUrl);

  const size = SIZES[options.format];
  const qrDataUrl = await QRCode.toDataURL(options.joinUrl, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 512,
    color: { dark: '#111111', light: '#FFFFFF' },
  });
  const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');
  const qrBuffer = Buffer.from(qrBase64, 'base64');

  const brand = options.brandColor || '#111111';
  const accent = options.accentColor || '#1DB954';
  const instructions =
    options.instructions ||
    'Scan the QR code to request a song. Keep requests friendly.';

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [size.width, size.height],
      margins: {
        top: size.margin,
        bottom: size.margin,
        left: size.margin,
        right: size.margin,
      },
      info: {
        Title: `${options.eventTitle} — PartyPlaylist signage`,
        Author: 'PartyPlaylist',
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header brand
    doc
      .fillColor(accent)
      .fontSize(12)
      .text('PartyPlaylist', { align: 'left' });

    doc.moveDown(0.5);
    doc
      .fillColor(brand)
      .fontSize(options.format === 'table_card' ? 22 : 28)
      .text(options.eventTitle || 'Party Playlist', {
        align: 'center',
      });

    doc.moveDown(0.75);

    const qrMax = Math.min(
      size.width - size.margin * 2,
      size.height * 0.45,
      320
    );
    const qrX = (size.width - qrMax) / 2;
    doc.image(qrBuffer, qrX, doc.y, { width: qrMax, height: qrMax });
    doc.y += qrMax + 16;

    doc
      .fillColor('#222222')
      .fontSize(options.format === 'table_card' ? 11 : 13)
      .text(instructions, { align: 'center' });

    if (options.includeAccessCode && options.accessCode) {
      doc.moveDown(0.75);
      doc
        .fillColor(brand)
        .fontSize(14)
        .text(`Access code: ${options.accessCode}`, { align: 'center' });
    }

    doc.moveDown(1);
    doc
      .fillColor('#666666')
      .fontSize(9)
      .text(`Join: ${options.joinUrl}`, { align: 'center' });

    doc
      .fillColor('#999999')
      .fontSize(8)
      .text(`${size.label} · Print-safe margins · High-contrast QR`, {
        align: 'center',
      });

    doc.end();
  });
}

export function signageFilename(format: SignageFormat, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `partyplaylist-${slug || 'event'}-${format}.pdf`;
}
