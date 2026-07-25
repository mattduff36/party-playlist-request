interface ErrorStateProps {
  error: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export default function ErrorState({
  error,
  onRetry,
  retryLabel = 'Retry',
}: ErrorStateProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4 text-bone">
      <div className="mx-auto max-w-lg text-center">
        <p className="font-display text-5xl font-bold text-error">!</p>
        <h1 className="mt-4 font-display text-2xl font-bold">Connection error</h1>
        <p className="mt-3 text-muted">{error}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-6 rounded-lg bg-accent px-5 py-2.5 font-semibold text-ink transition hover:bg-accent-hover"
          >
            {retryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
