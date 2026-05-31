export function Spinner({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-[3px]',
    lg: 'h-12 w-12 border-4'
  };

  return (
    <span
      className={`inline-block animate-spin rounded-full border-current border-r-transparent text-brand-red ${sizes[size]} ${className}`}
      aria-hidden="true"
    />
  );
}

export function LoadingState({ label = 'Loading...', fullScreen = false }) {
  const content = (
    <div className="grid place-items-center py-10 text-center">
      <div>
        <Spinner size="lg" />
        <p className="mt-4 text-sm font-medium text-slate-500">{label}</p>
      </div>
    </div>
  );

  if (fullScreen) {
    return <div className="min-h-screen bg-slate-50 grid place-items-center">{content}</div>;
  }

  return content;
}

export function ButtonSpinner() {
  return <Spinner size="sm" className="text-white" />;
}
