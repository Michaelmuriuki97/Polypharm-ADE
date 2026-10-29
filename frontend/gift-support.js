import './gift-support.css';

const giftWidgetId = 'polypharm-gift-support';

export function mountGiftSupport() {
  if (document.getElementById(giftWidgetId)) return () => {};

  const widget = document.createElement('aside');
  widget.id = giftWidgetId;
  widget.className = 'gift-support-widget';
  widget.setAttribute('aria-label', 'Support Polypharm ADE');
  widget.innerHTML = `
    <div class="gift-support-popover" id="gift-support-message" role="region" aria-label="Appreciation message" hidden>
      <button class="gift-support-close" type="button" aria-label="Close message">×</button>
      <strong>Thank you for your support!</strong>
      <p>If you’d like to send a little support, you can use M-Pesa:</p>
      <div class="gift-support-number-row">
        <span class="gift-support-number">+254 797 746 839</span>
        <button class="gift-support-copy" type="button">Copy number</button>
      </div>
      <span class="gift-support-feedback" aria-live="polite"></span>
    </div>
    <button class="gift-support-trigger" type="button" aria-label="Open appreciation message" aria-expanded="false" aria-controls="gift-support-message" title="A small thank you">
      <span aria-hidden="true">🎁</span>
    </button>`;
  document.body.appendChild(widget);

  const trigger = widget.querySelector('.gift-support-trigger');
  const popover = widget.querySelector('.gift-support-popover');
  const closeButton = widget.querySelector('.gift-support-close');
  const copyButton = widget.querySelector('.gift-support-copy');
  const feedback = widget.querySelector('.gift-support-feedback');
  const number = '+254797746839';
  let x = window.innerWidth - 76;
  let y = window.innerHeight - 96;
  let pointerStart = null;
  let dragOffset = null;
  let suppressClick = false;

  try {
    const saved = JSON.parse(localStorage.getItem('polypharm-gift-position') || 'null');
    if (saved && Number.isFinite(saved.y)) y = saved.y;
    if (saved?.edge === 'left') x = 12;
  } catch { /* Use the default edge position when storage is unavailable. */ }

  const clamp = () => {
    x = Math.max(12, Math.min(x, window.innerWidth - 66));
    y = Math.max(12, Math.min(y, window.innerHeight - 66));
    widget.style.left = `${x}px`;
    widget.style.top = `${y}px`;
    widget.classList.toggle('is-left', x + 33 < window.innerWidth / 2);
  };
  const close = () => {
    popover.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  };

  clamp();
  trigger.addEventListener('click', () => {
    if (suppressClick) { suppressClick = false; return; }
    popover.hidden = !popover.hidden;
    trigger.setAttribute('aria-expanded', String(!popover.hidden));
    if (!popover.hidden) closeButton.focus();
  });
  closeButton.addEventListener('click', () => { close(); trigger.focus(); });
  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(number);
      feedback.textContent = 'Number copied.';
    } catch {
      const field = document.createElement('textarea');
      field.value = number;
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      const copied = document.execCommand('copy');
      field.remove();
      feedback.textContent = copied ? 'Number copied.' : 'Please copy the number above.';
    }
  });

  trigger.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    pointerStart = { x: event.clientX, y: event.clientY };
    dragOffset = { x: event.clientX - x, y: event.clientY - y };
    suppressClick = false;
    trigger.setPointerCapture(event.pointerId);
  });
  trigger.addEventListener('pointermove', event => {
    if (!dragOffset) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    if (!suppressClick && Math.hypot(dx, dy) > 8) suppressClick = true;
    if (!suppressClick) return;
    x = event.clientX - dragOffset.x;
    y = event.clientY - dragOffset.y;
    clamp();
  });
  const finishDrag = () => {
    if (!dragOffset) return;
    if (suppressClick) {
      x = x + 33 < window.innerWidth / 2 ? 12 : window.innerWidth - 45;
      clamp();
      try { localStorage.setItem('polypharm-gift-position', JSON.stringify({ edge: x < window.innerWidth / 2 ? 'left' : 'right', y })); } catch { /* Position persistence is optional. */ }
      close();
    }
    dragOffset = null;
  };
  trigger.addEventListener('pointerup', finishDrag);
  trigger.addEventListener('pointercancel', finishDrag);
  window.addEventListener('resize', clamp);

  return () => {
    window.removeEventListener('resize', clamp);
    widget.remove();
  };
}
