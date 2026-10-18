import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export default function BackToTop() {
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => setVisible(window.scrollY > 300 && Boolean(document.querySelector('main table')));
    update();
    window.addEventListener('scroll', update, { passive: true });
    const observer = new MutationObserver(update);
    const main = document.querySelector('main');
    if (main) observer.observe(main, { childList: true, subtree: true });
    return () => {
      window.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [pathname]);

  if (!visible) return null;
  return <button type="button" aria-label="Back to top" title="Back to top"
    onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}
    className="no-print fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-brand-red text-white shadow-lg hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red">
    <ArrowUp size={22} />
  </button>;
}
