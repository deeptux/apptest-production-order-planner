import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { setPlannerForceLocalOnly } from './lib/supabase';
import './index.css';

if (import.meta.env.DEV) {
  window.__plannerDev = {
    /** Disconnect Supabase immediately (reloads tab; stops stale Realtime after .env change without server restart). */
    forceLocalOnly: () => setPlannerForceLocalOnly(true),
    /** Clear override; reloads tab. */
    allowSupabase: () => setPlannerForceLocalOnly(false),
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
