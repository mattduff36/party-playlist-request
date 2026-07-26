'use client';

import { Suspense } from 'react';
import { DisplayAuthGate, DisplayPage } from '@/components/display';
import PageLoader from '@/components/ui/PageLoader';

export default function AccessCodeDisplayPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading display..." />}>
      <DisplayAuthGate>
        {(ctx) => (
          <DisplayPage
            username={ctx.username}
            accessCode={ctx.accessCode}
            eventId={ctx.eventId}
            realtimeMode={ctx.realtimeMode}
          />
        )}
      </DisplayAuthGate>
    </Suspense>
  );
}
