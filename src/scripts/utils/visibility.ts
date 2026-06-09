export interface Pauseable {
  destroy(): void;
  init(): void;
}

export function setupVisibility(modules: Pauseable[]): () => void {
  const handleVisibility = () => {
    if (document.hidden) {
      modules.forEach(m => m.destroy());
    } else {
      modules.forEach(m => m.init());
    }
  };

  document.addEventListener('visibilitychange', handleVisibility);
  return () => document.removeEventListener('visibilitychange', handleVisibility);
}
