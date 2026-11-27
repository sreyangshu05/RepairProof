import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
  });
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Missing #root application element');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
