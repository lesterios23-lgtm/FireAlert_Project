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

// Remove the preview service worker so old frontend bundles are not served.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
        return caches.keys();
      })
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((name) => name.startsWith('firealert-'))
          .map((name) => caches.delete(name))
      ))
      .catch((error) => console.error('Unable to clear the old FireAlert cache.', error));
  });
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
