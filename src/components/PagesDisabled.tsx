interface PagesDisabledProps {
  variant: 'requests' | 'display';
  eventConfig?: {
    event_title?: string;
    welcome_message?: string;
    secondary_message?: string;
    tertiary_message?: string;
  };
}

export default function PagesDisabled({ variant, eventConfig }: PagesDisabledProps) {
  const isRequests = variant === 'requests';
  const title = isRequests ? 'Requests disabled' : 'Display disabled';
  const message = isRequests
    ? 'The DJ has temporarily disabled song requests. Check back later!'
    : 'The DJ has temporarily disabled the display. Check back later!';

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4 text-bone">
      <div className="mx-auto max-w-lg text-center">
        <p className="font-display text-sm font-bold uppercase tracking-[0.2em] text-accent">Paused</p>
        <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">{title}</h1>
        <p className="mt-3 text-muted sm:text-lg">{message}</p>
        {eventConfig?.event_title ? (
          <p className="mt-8 font-display text-xl font-semibold">{eventConfig.event_title}</p>
        ) : null}
        {eventConfig?.welcome_message ? (
          <p className="mt-2 text-sm text-faint">{eventConfig.welcome_message}</p>
        ) : null}
      </div>
    </div>
  );
}
