import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

const removeSplash = () => {
  const splash = document.getElementById('app-splash');
  if (!splash) return;
  splash.style.opacity = '0';
  window.setTimeout(() => splash.remove(), 260);
};
// Keep splash briefly so the app opens with a logo/loading moment, then reveal the app.
window.setTimeout(() => {
  window.requestAnimationFrame(() => window.requestAnimationFrame(removeSplash));
}, 700);

// Register the service worker for PWA installability (works over HTTPS / localhost).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .catch((error) => console.error('Service worker registration failed.', error));
  });
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
