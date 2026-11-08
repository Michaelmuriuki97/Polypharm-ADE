(() => {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).catch(() => {});
  }, { once: true });

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (isStandalone || sessionStorage.getItem('polypharm-pwa-dismissed') === '1') return;

  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
  });

  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = '/pwa.css';
  document.head.append(style);

  const control = document.createElement('aside');
  control.className = 'pwa-install-control';
  control.setAttribute('aria-label', 'Install Polypharm ADE');
  control.innerHTML = '<button class="pwa-install-button" type="button"><svg class="pwa-install-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 16v3h14v-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Install app</span></button><button class="pwa-install-close" type="button" aria-label="Hide install option">×</button>';
  document.body.append(control);

  const closeControl = () => {
    control.remove();
    sessionStorage.setItem('polypharm-pwa-dismissed', '1');
  };

  const showInstructions = () => {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const dialog = document.createElement('div');
    dialog.className = 'pwa-dialog-backdrop';
    dialog.innerHTML = `<section class="pwa-dialog" role="dialog" aria-modal="true" aria-labelledby="pwa-dialog-title"><button class="pwa-dialog-close" type="button" aria-label="Close">×</button><h2 id="pwa-dialog-title">Add Polypharm ADE to your home screen</h2>${isIOS
      ? '<ol><li>Open this site in <strong>Safari</strong>.</li><li>Tap the <strong>Share</strong> icon.</li><li>Choose <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.</li></ol>'
      : '<ol><li>Open the browser menu <strong>⋮</strong> at the top of the page.</li><li>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li><li>Confirm to add it to your device.</li></ol>'}<p class="pwa-dialog-note">Free to install. No app-store account or download fee is required.</p></section>`;
    const dismiss = () => dialog.remove();
    dialog.querySelector('.pwa-dialog-close').addEventListener('click', dismiss);
    dialog.addEventListener('click', event => { if (event.target === dialog) dismiss(); });
    document.addEventListener('keydown', function onEscape(event) {
      if (event.key === 'Escape') { dismiss(); document.removeEventListener('keydown', onEscape); }
    });
    document.body.append(dialog);
    dialog.querySelector('.pwa-dialog-close').focus();
  };

  control.querySelector('.pwa-install-close').addEventListener('click', closeControl);
  control.querySelector('.pwa-install-button').addEventListener('click', async () => {
    if (!installPrompt) return showInstructions();
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
  });

  window.addEventListener('appinstalled', () => control.remove());
})();
