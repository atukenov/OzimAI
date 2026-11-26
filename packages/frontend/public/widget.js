/*!
 * OzimAI web chat widget.
 * Paste before </body> on the clinic's site:
 *   <script src="https://YOUR-OZIMAI-HOST/widget.js" data-clinic="SLUG" async></script>
 * Optional: data-color="#0B9B6D" data-label="Записаться онлайн" data-position="left"
 */
(function () {
  if (window.__ozimaiWidget) return;
  window.__ozimaiWidget = true;

  var script = document.currentScript || document.querySelector('script[data-clinic][src*="widget.js"]');
  if (!script) return;
  var slug = script.getAttribute('data-clinic');
  if (!slug) return console.warn('[OzimAI] data-clinic attribute is missing');
  var origin = new URL(script.src).origin;
  var color = script.getAttribute('data-color') || '#0B9B6D';
  var label = script.getAttribute('data-label') || 'Записаться онлайн';
  var side = script.getAttribute('data-position') === 'left' ? 'left' : 'right';
  var chatUrl = origin + '/c/' + encodeURIComponent(slug);

  var css =
    '.ozimai-btn{position:fixed;bottom:20px;' + side + ':20px;z-index:2147483000;display:flex;align-items:center;gap:8px;' +
    'height:52px;padding:0 20px 0 16px;border:0;border-radius:26px;background:' + color + ';color:#fff;cursor:pointer;' +
    'font:600 15px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.2)}' +
    '.ozimai-btn svg{width:22px;height:22px}' +
    '.ozimai-frame{position:fixed;bottom:84px;' + side + ':20px;z-index:2147483001;width:380px;height:600px;max-height:calc(100vh - 104px);' +
    'border:0;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.25);background:#fff;display:none}' +
    '.ozimai-open .ozimai-frame{display:block}' +
    '@media (max-width:480px){.ozimai-frame{inset:0;width:100%;height:100%;max-height:none;border-radius:0}' +
    '.ozimai-open .ozimai-btn{display:none}}';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var root = document.createElement('div');
  root.className = 'ozimai-root';

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ozimai-btn';
  btn.setAttribute('aria-label', label);
  btn.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var text = document.createElement('span');
  text.textContent = label;
  btn.appendChild(text);

  var frame = null;
  function open() {
    if (!frame) {
      frame = document.createElement('iframe');
      frame.className = 'ozimai-frame';
      frame.title = label;
      frame.src = chatUrl + '?embed=1';
      frame.allow = 'clipboard-write';
      root.appendChild(frame);
    }
    root.classList.add('ozimai-open');
  }
  function close() {
    root.classList.remove('ozimai-open');
  }

  btn.addEventListener('click', function () {
    root.classList.contains('ozimai-open') ? close() : open();
  });
  window.addEventListener('message', function (e) {
    if (e.origin === origin && e.data && e.data.type === 'ozimai:close') close();
  });

  root.appendChild(btn);
  document.body.appendChild(root);

  window.OzimAI = { open: open, close: close, url: chatUrl };
})();
