import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { AppRoutes } from './app/router';
import './styles.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root tidak ditemukan di index.html');

createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </StrictMode>,
);
