import { MoonIcon as Moon, SunIcon as Sun } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark');

  useEffect(() => {
    const sync = () => setDark(document.documentElement.dataset.theme === 'dark');
    const media = matchMedia('(prefers-color-scheme: dark)');
    const systemChanged = () => {
      try {
        if (localStorage.getItem('admin-theme')) {
          return;
        }
      } catch {
        return;
      }
      document.documentElement.dataset.theme = media.matches ? 'dark' : 'light';
      sync();
    };
    const storageChanged = (event: StorageEvent) => {
      if (event.key !== 'admin-theme') {
        return;
      }
      document.documentElement.dataset.theme =
        event.newValue === 'dark' || event.newValue === 'light'
          ? event.newValue
          : media.matches
            ? 'dark'
            : 'light';
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
    const next = document.documentElement.dataset.theme !== 'dark';
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    try {
      localStorage.setItem('admin-theme', next ? 'dark' : 'light');
    } catch {
      /* Theme still works when storage is unavailable. */
    }
    window.dispatchEvent(new Event('admin-theme-changed'));
  }

  return (
    <button
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      type="button"
      className="btn btn-square btn-sm btn-ghost"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
