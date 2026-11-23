const fs = require('fs');

const SKIP_PREFIXES = ['/admin', '/staff', '/api'];

function showNotice() {
  try {
    if (sessionStorage.getItem('demo-notice-seen')) return;
  } catch {
    // storage blocked, show the notice every time
  }

  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = '/fonts/big-shoulders/latin-800.css';
  document.head.append(fontLink);

  const style = document.createElement('style');
  style.textContent = `
    @keyframes dn-fade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes dn-rise {
      from { opacity: 0; transform: translateY(12px) scale(0.98); }
      to { opacity: 1; transform: none; }
    }
    .dn-overlay {
      position: fixed; inset: 0; z-index: 2147483647;
      display: flex; align-items: center; justify-content: center;
      padding: 16px; background: rgba(10, 10, 10, 0.85);
      backdrop-filter: blur(4px);
      animation: dn-fade 0.2s ease-out;
    }
    .dn-overlay.dn-out { opacity: 0; transition: opacity 0.15s ease-in; }
    .dn-card {
      position: relative; width: 100%; max-width: 440px;
      max-height: calc(100vh - 32px); overflow-y: auto;
      padding: 28px 24px 24px; border-radius: 16px;
      background: #111111; color: #f0f0f0;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 0 40px rgba(229, 53, 53, 0.25);
      font-family: 'DM Sans', system-ui, sans-serif;
      animation: dn-rise 0.25s ease-out;
    }
    .dn-card::before {
      content: ''; position: absolute; top: 0; left: 24px; right: 24px;
      height: 2px; background: #e53535; border-radius: 0 0 2px 2px;
    }
    .dn-label {
      display: inline-block; margin: 0 0 12px;
      font-size: 11px; font-weight: 600; letter-spacing: 0.2em;
      text-transform: uppercase; color: #e53535;
    }
    .dn-title {
      margin: 0 0 16px; color: #ffffff;
      font-family: 'Big Shoulders Display', 'Arial Narrow', sans-serif;
      font-weight: 800; font-size: 34px; line-height: 1.05;
      letter-spacing: 0.01em; text-transform: uppercase;
    }
    .dn-list { display: grid; gap: 12px; margin: 0 0 20px; padding: 0; list-style: none; }
    .dn-list li { position: relative; padding-left: 20px; font-size: 14px; line-height: 1.5; }
    .dn-list li::before {
      content: ''; position: absolute; left: 0; top: 8px;
      width: 8px; height: 8px; border-radius: 50%; background: #e53535;
    }
    .dn-list a { color: #e53535; text-decoration: underline; }
    .dn-foot { margin: 0 0 16px; font-size: 12px; color: #888888; }
    .dn-btn {
      width: 100%; padding: 12px; border: 0; border-radius: 10px;
      background: #e53535; color: #ffffff; cursor: pointer;
      font-family: inherit; font-size: 14px; font-weight: 600;
      box-shadow: 0 0 20px rgba(229, 53, 53, 0.3);
      transition: background 0.15s;
    }
    .dn-btn:hover, .dn-btn:focus-visible { background: #b91c1c; }
    .dn-btn:focus-visible { outline: 2px solid #f0f0f0; outline-offset: 2px; }
    @media (prefers-reduced-motion: reduce) {
      .dn-overlay, .dn-card { animation: none; }
      .dn-overlay.dn-out { transition: none; }
    }
  `;
  document.head.append(style);

  const overlay = document.createElement('div');
  overlay.className = 'dn-overlay';
  overlay.innerHTML = `
    <div class="dn-card" role="dialog" aria-modal="true" aria-labelledby="dn-title">
      <span class="dn-label">Academic demo</span>
      <h2 class="dn-title" id="dn-title">This is not a real booking site</h2>
      <ul class="dn-list">
        <li>Bookings made here are for demonstration only and will not be honored.</li>
        <li>No real payment is taken. Please do not enter real card or e-wallet details.</li>
        <li>To book with Herco Detailing Garage, please contact the shop directly through their <a href="https://www.facebook.com/profile.php?id=100085045826929" target="_blank" rel="noopener noreferrer">Facebook page</a>.</li>
      </ul>
      <p class="dn-foot">Capstone project demo, built for academic purposes.</p>
      <button type="button" class="dn-btn">I understand, continue</button>
    </div>
  `;

  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  const button = overlay.querySelector('.dn-btn');
  button.addEventListener('click', () => {
    try {
      sessionStorage.setItem('demo-notice-seen', '1');
    } catch {
      // storage blocked, the notice just shows again next page
    }
    overlay.classList.add('dn-out');
    setTimeout(() => {
      overlay.remove();
      document.body.style.overflow = previousOverflow;
    }, 150);
  });

  document.body.append(overlay);
  button.focus();
} 

const NOTICE_SCRIPT = `<script>(${showNotice.toString()})()</script>`;

const demoNotice = (req, res, next) => {
  if (process.env.DEMO_NOTICE !== 'true') return next();
  if (SKIP_PREFIXES.some((prefix) => req.path.startsWith(prefix)))
    return next();

  const originalSendFile = res.sendFile.bind(res);

  res.sendFile = (filePath, ...rest) => {
    if (!String(filePath).endsWith('.html')) {
      return originalSendFile(filePath, ...rest);
    }

    fs.readFile(filePath, 'utf8', (err, html) => {
      const end = html ? html.lastIndexOf('</body>') : -1;
      if (err || end === -1) return originalSendFile(filePath, ...rest);
      res
        .type('html')
        .send(html.slice(0, end) + NOTICE_SCRIPT + html.slice(end));
    });
  };

  next();
};

module.exports = demoNotice;
