import React from 'react';
import { createRoot } from 'react-dom/client';
import './core/theme.css';
import { StoreProvider } from './core/store.jsx';
import App from './App.jsx';
import AuthGate from './core/AuthGate.jsx';

// Giao diện sáng/tối lưu theo từng thiết bị.
try { const t = localStorage.getItem('avenor-theme'); if (t === 'dark') document.documentElement.dataset.theme = 'dark'; } catch { /* mặc định sáng */ }

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthGate><StoreProvider><App /></StoreProvider></AuthGate>
  </React.StrictMode>,
);
