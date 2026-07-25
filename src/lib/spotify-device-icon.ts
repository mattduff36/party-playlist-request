import { Monitor, Smartphone, Speaker, type LucideIcon } from 'lucide-react';

export function getSpotifyDeviceIcon(type?: string): LucideIcon {
  switch ((type || '').toLowerCase()) {
    case 'computer':
      return Monitor;
    case 'smartphone':
      return Smartphone;
    default:
      return Speaker;
  }
}
