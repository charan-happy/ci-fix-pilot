export default function LoadingHomePage() {
  return (
    <section
      className="bg-background flex h-dvh w-full items-center justify-center"
      role="status"
      aria-label="Loading content">
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <div className="border-muted h-16 w-16 rounded-full border-4"></div>
          <div className="border-t-primary absolute top-0 h-16 w-16 animate-spin rounded-full border-4 border-transparent"></div>
        </div>
        <div className="flex gap-2">
          <div className="bg-primary h-3 w-3 animate-bounce rounded-full [animation-delay:-0.3s]"></div>
          <div className="bg-primary h-3 w-3 animate-bounce rounded-full [animation-delay:-0.15s]"></div>
          <div className="bg-primary h-3 w-3 animate-bounce rounded-full"></div>
        </div>
        <span className="sr-only">Loading, please wait...</span>
      </div>
    </section>
  );
}
