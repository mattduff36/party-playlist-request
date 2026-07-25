interface LoadingStateProps {
  message?: string;
  showSpinner?: boolean;
}

export default function LoadingState({
  message = 'Loading...',
  showSpinner = true,
}: LoadingStateProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink text-bone">
      <div className="text-center">
        {showSpinner && (
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        )}
        <p className="font-display text-lg text-muted">{message}</p>
      </div>
    </div>
  );
}
