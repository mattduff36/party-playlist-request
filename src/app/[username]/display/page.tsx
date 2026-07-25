'use client';

import { DisplayAuthGate, DisplayPage } from '@/components/display';

export default function UserDisplayPage() {
  return (
    <DisplayAuthGate>
      {(username) => <DisplayPage username={username} />}
    </DisplayAuthGate>
  );
}
