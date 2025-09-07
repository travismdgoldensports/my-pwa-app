// app.js
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  console.log('PWA can be installed (non-iOS). Show your Install button.');
  // document.getElementById('installBtn').style.display = 'block';
});

async function installApp() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  console.log('Install outcome:', outcome);
  deferredPrompt = null;
}
window.installApp = installApp;

// iOS tip: show instructions for "Share → Add to Home Screen" if on Safari iOS.
