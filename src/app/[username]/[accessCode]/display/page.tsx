'use client';

import { DisplayAuthGate, DisplayPage } from '@/components/display';

export default function AccessCodeDisplayPage() {
  return (
    <DisplayAuthGate>
      {(username, accessCode) => (
        <DisplayPage username={username} accessCode={accessCode} />
      )}
    </DisplayAuthGate>
  );
}
