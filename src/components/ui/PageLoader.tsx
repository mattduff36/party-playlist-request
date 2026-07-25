interface PageLoaderProps {
  label?: string;
  fullScreen?: boolean;
}

export default function PageLoader({
  label = 'Loading...',
  fullScreen = true,
}: PageLoaderProps) {
  return (
    <div
      className={`flex items-center justify-center bg-ink text-bone ${
        fullScreen ? 'min-h-screen' : 'min-h-[40vh] w-full py-16'
      }`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="text-center ss-reveal">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-accent border-t-transparent ss-pulse-accent" />
        <p className="font-display text-sm font-medium tracking-wide text-muted">{label}</p>
      </div>
    </div>
  );
}
