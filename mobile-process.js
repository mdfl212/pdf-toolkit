(() => {
  const onReady = (fn) => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  };
  onReady(() => {
    const panel = document.getElementById('panel-chapters');
    const extractBtn = document.getElementById('bm-extract-btn');
    const zipBtn = document.getElementById('bm-zip-btn');
    const progress = document.getElementById('bm-progress');
    const fill = document.getElementById('bm-progress-fill');
    const status = document.getElementById('bm-extract-status');
    const input = document.getElementById('chapters-input');
    if (!panel || !extractBtn || !zipBtn || !progress || !fill || !status) return;

    const dock = document.createElement('section');
    dock.className = 'mobile-process-dock';
    dock.setAttribute('aria-live', 'polite');
    dock.setAttribute('aria-label', 'Chapter extraction progress');
    dock.innerHTML = `
      <div class="mobile-process-top">
        <div class="mobile-process-copy">
          <div class="mobile-process-title" id="mobile-process-title">Preparing chapters</div>
          <div class="mobile-process-status" id="mobile-process-status">Getting ready…</div>
        </div>
        <div class="mobile-process-percent" id="mobile-process-percent">0%</div>
      </div>
      <div class="mobile-process-track" role="progressbar" aria-label="Processing progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
        <div class="mobile-process-fill" id="mobile-process-fill"></div>
      </div>
      <div class="mobile-process-actions">
        <button type="button" class="btn btn-success" id="mobile-process-download" disabled>⬇ Download ZIP</button>
        <button type="button" class="btn btn-secondary mobile-process-back" id="mobile-process-view">View chapters</button>
      </div>`;
    document.body.appendChild(dock);

    const fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'mobile-process-fab';
    fab.setAttribute('aria-label', 'Show extraction progress');
    fab.setAttribute('aria-expanded', 'false');
    fab.innerHTML = '<span class="mobile-process-fab-inner"><span class="mobile-process-fab-icon" id="mobile-process-fab-icon">↗</span><span class="mobile-process-fab-percent" id="mobile-process-fab-percent">0%</span></span>';
    document.body.appendChild(fab);

    const titleEl = dock.querySelector('#mobile-process-title');
    const statusEl = dock.querySelector('#mobile-process-status');
    const percentEl = dock.querySelector('#mobile-process-percent');
    const fillEl = dock.querySelector('#mobile-process-fill');
    const trackEl = dock.querySelector('[role="progressbar"]');
    const downloadBtn = dock.querySelector('#mobile-process-download');
    const viewBtn = dock.querySelector('#mobile-process-view');
    const fabIcon = fab.querySelector('#mobile-process-fab-icon');
    const fabPercent = fab.querySelector('#mobile-process-fab-percent');
    const mobile = () => window.matchMedia('(max-width: 900px)').matches;
    let focusMode = false;
    let detailsOpen = false;
    let zipWasRunning = false;

    function setFocusMode(on) {
      focusMode = on;
      document.body.classList.toggle('mobile-process-focus', on && mobile());
      fab.classList.toggle('visible', on && mobile());
      if (!on) {
        detailsOpen = false;
        dock.classList.remove('visible');
        fab.setAttribute('aria-expanded', 'false');
      }
    }

    function updateDock() {
      if (!focusMode || !mobile()) {
        dock.classList.remove('visible');
        fab.classList.remove('visible');
        document.body.classList.remove('mobile-process-focus');
        return;
      }
      fab.classList.add('visible');
      const pct = Math.max(0, Math.min(100, parseFloat(fill.style.width) || 0));
      fillEl.style.width = pct + '%';
      percentEl.textContent = Math.round(pct) + '%';
      fabPercent.textContent = Math.round(pct) + '%';
      fab.style.setProperty('--process-progress', pct + '%');
      trackEl.setAttribute('aria-valuenow', String(Math.round(pct)));

      const message = (status.textContent || '').trim();
      const zipReady = zipBtn.style.display !== 'none' && !zipBtn.disabled;
      const zipRunning = zipBtn.disabled;
      downloadBtn.disabled = !zipReady || zipRunning;
      fab.classList.toggle('ready', zipReady && !zipRunning);
      fabIcon.textContent = zipReady && !zipRunning ? '↓' : (zipRunning ? '…' : '↗');
      fab.setAttribute('aria-label', zipReady && !zipRunning ? 'Download ZIP' : 'Show extraction progress');

      if (zipRunning) {
        zipWasRunning = true;
        titleEl.textContent = 'Compressing ZIP';
        statusEl.textContent = message || 'Building ZIP file…';
        downloadBtn.textContent = 'Compressing…';
      } else if (message.toLowerCase().includes('ready for zip') || zipReady) {
        titleEl.textContent = 'Chapters extracted';
        statusEl.textContent = message || 'Ready to download the ZIP';
        downloadBtn.textContent = '⬇ Download ZIP';
        if (pct === 0) {
          fillEl.style.width = '100%';
          percentEl.textContent = '100%';
          fabPercent.textContent = '';
          fab.style.setProperty('--process-progress', '100%');
          trackEl.setAttribute('aria-valuenow', '100');
        }
      } else if (message.toLowerCase().includes('zip download started') || message.toLowerCase().includes('done')) {
        titleEl.textContent = 'Download started';
        statusEl.textContent = message;
        downloadBtn.textContent = '⬇ Download ZIP again';
        fabPercent.textContent = 'ZIP';
        fab.style.setProperty('--process-progress', '100%');
      } else if (message.toLowerCase().includes('failed') || message.toLowerCase().includes('error')) {
        titleEl.textContent = 'Extraction issue';
        statusEl.textContent = message;
        downloadBtn.textContent = 'Try ZIP again';
      } else {
        titleEl.textContent = 'Splitting chapters';
        statusEl.textContent = message || 'Extracting selected chapters…';
        downloadBtn.textContent = 'Preparing ZIP…';
      }
      if (zipWasRunning && !zipRunning && message.toLowerCase().includes('download started')) {
        titleEl.textContent = 'Download started';
        statusEl.textContent = message;
        fillEl.style.width = '100%';
        percentEl.textContent = '100%';
        fabPercent.textContent = 'ZIP';
        fab.style.setProperty('--process-progress', '100%');
        trackEl.setAttribute('aria-valuenow', '100');
        downloadBtn.textContent = '⬇ Download ZIP again';
      }
      dock.classList.toggle('visible', detailsOpen);
      fab.setAttribute('aria-expanded', String(detailsOpen));
    }

    extractBtn.addEventListener('click', () => {
      if (!mobile()) return;
      detailsOpen = false;
      setFocusMode(true);
      titleEl.textContent = 'Splitting chapters';
      statusEl.textContent = 'Extracting selected chapters…';
      fillEl.style.width = '0%';
      percentEl.textContent = '0%';
      fabPercent.textContent = '0%';
      fab.style.setProperty('--process-progress', '0%');
      trackEl.setAttribute('aria-valuenow', '0');
      updateDock();
    });

    fab.addEventListener('click', () => {
      const zipReady = zipBtn.style.display !== 'none' && !zipBtn.disabled;
      if (zipReady) {
        zipBtn.click();
        return;
      }
      detailsOpen = !detailsOpen;
      updateDock();
    });
    downloadBtn.addEventListener('click', () => {
      if (!downloadBtn.disabled) zipBtn.click();
    });
    viewBtn.addEventListener('click', () => {
      setFocusMode(false);
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    document.addEventListener('click', (event) => {
      if (detailsOpen && !dock.contains(event.target) && !fab.contains(event.target)) {
        detailsOpen = false;
        updateDock();
      }
    });

    const observer = new MutationObserver(updateDock);
    observer.observe(fill, { attributes: true, attributeFilter: ['style'] });
    observer.observe(progress, { attributes: true, attributeFilter: ['style'] });
    observer.observe(status, { childList: true, subtree: true, characterData: true });
    observer.observe(zipBtn, { attributes: true, attributeFilter: ['style', 'disabled'] });

    if (input) input.addEventListener('change', () => {
      setFocusMode(false);
      zipWasRunning = false;
    });
    window.addEventListener('resize', updateDock, { passive: true });
    updateDock();
  });
})();
