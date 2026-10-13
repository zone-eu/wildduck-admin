import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { IconButton } from './ui';

export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const sync = () => setDark(document.documentElement.classList.contains('dark'));
    const media = matchMedia('(prefers-color-scheme: dark)');
    const systemChanged = () => {
      try {
        if (localStorage.getItem('admin-theme')) {
          return;
        }
      } catch {
        return;
      }
      document.documentElement.classList.toggle('dark', media.matches);
      sync();
    };
    const storageChanged = (event: StorageEvent) => {
      if (event.key !== 'admin-theme') {
        return;
      }
      document.documentElement.classList.toggle(
        'dark',
        event.newValue ? event.newValue === 'dark' : media.matches
      );
      sync();
    };
    window.addEventListener('admin-theme-changed', sync);
    window.addEventListener('storage', storageChanged);
    media.addEventListener('change', systemChanged);
    return () => {
      window.removeEventListener('admin-theme-changed', sync);
      window.removeEventListener('storage', storageChanged);
      media.removeEventListener('change', systemChanged);
    };
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('admin-theme', next ? 'dark' : 'light');
    } catch {
      /* Theme still works when storage is unavailable. */
    }
    window.dispatchEvent(new Event('admin-theme-changed'));
  }

  return (
    <IconButton title={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggle}>
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </IconButton>
  );
}
