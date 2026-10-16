import React from 'react';
import ReactDOM from 'react-dom/client';
import { IconContext } from '@phosphor-icons/react';
import App from './App';
import './styles.css';

try {
  const saved = localStorage.getItem('admin-theme');
  document.documentElement.dataset.theme =
    saved === 'dark' || saved === 'light'
      ? saved
      : matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
} catch {
  document.documentElement.dataset.theme = matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <IconContext.Provider value={{ weight: 'regular' }}>
      <App />
    </IconContext.Provider>
  </React.StrictMode>
);
