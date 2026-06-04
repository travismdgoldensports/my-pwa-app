// app.js
let deferredPrompt;

const installBtn = () => document.getElementById('installBtn');
const installTip = () => document.getElementById('installTip');

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIosSafari() {
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

function setInstallMessage(message) {
  const tip = installTip();
  if (tip && message) tip.innerHTML = message;
}

function updateInstallUi() {
  const btn = installBtn();
  if (btn) btn.style.display = deferredPrompt && !isStandalone() ? 'inline-flex' : 'none';

  if (isStandalone()) {
    setInstallMessage('Installed for offline play.');
  } else if (isIosSafari()) {
    setInstallMessage('iOS: tap Share, then <b>Add to Home Screen</b> to install for offline play.');
  } else {
    setInstallMessage('Install this app for faster startup and offline play.');
  }
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  updateInstallUi();
});

async function installApp() {
  if (!deferredPrompt) {
    updateInstallUi();
    return;
  }
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  console.log('Install outcome:', outcome);
  deferredPrompt = null;
  updateInstallUi();
}
window.installApp = installApp;

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  updateInstallUi();
});

window.addEventListener('DOMContentLoaded', () => {
  const btn = installBtn();
  if (btn) btn.addEventListener('click', installApp);
  updateInstallUi();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').then(registration => {
      if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }).catch(err => {
      console.error('SW registration failed:', err);
    });
  });
}
