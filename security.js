(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  let selectedFile = null;
  let busy = false;
  let toolkitPromise = null;

  function addUI() {
    if ($('panel-security')) return;

    const quick = [...document.querySelectorAll('.tool-section')].find(section =>
      section.querySelector('[data-panel="compress"]')
    );
    if (quick) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tool-btn';
      button.dataset.panel = 'security';
      button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15" r="1"/></svg>Password Protect';
      quick.insertBefore(button, quick.querySelector('[data-panel="compress"]'));
    }

    const mobile = $('mobile-tools-grid');
    if (mobile) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mobile-tool-card';
      button.dataset.panel = 'security';
      button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><span>Password Protect</span>';
      mobile.insertBefore(button, mobile.querySelector('[data-panel="compress"]'));
    }

    const panel = document.createElement('section');
    panel.className = 'panel';
    panel.id = 'panel-security';
    panel.innerHTML = [
      '<h2>Password Protect PDF</h2>',
      '<p class="subtitle">Encrypt a new copy with AES-256 so a password is required to open it. Your PDF and passwords stay in this browser; they are not uploaded.</p>',
      '<div class="drop-zone" id="security-drop"><div class="drop-icon">🔒</div><p><strong>Choose a PDF to protect</strong></p><p class="hint">Select a file from your device. The original will not be changed.</p><input type="file" accept=".pdf,application/pdf" hidden id="security-input"></div>',
      '<div id="security-file-card" class="file-item" style="display:none;margin-bottom:18px"><div class="file-icon">PDF</div><div class="file-info"><div class="file-name" id="security-file-name"></div><div class="file-meta" id="security-file-size"></div></div><button type="button" class="btn btn-secondary btn-sm" id="security-remove">Remove</button></div>',
      '<div class="controls" style="flex-direction:column;align-items:stretch;gap:14px">',
      '<div class="control-group"><label for="security-password">Password to open PDF</label><input id="security-password" type="password" autocomplete="new-password" minlength="8" placeholder="Use a strong password" style="min-width:100%"><span class="hint">Use at least 8 characters; a longer unique passphrase is better.</span></div>',
      '<div class="control-group"><label for="security-confirm">Confirm password</label><input id="security-confirm" type="password" autocomplete="new-password" minlength="8" placeholder="Re-enter the password" style="min-width:100%"></div>',
      '<details class="control-group" id="security-advanced"><summary style="cursor:pointer;font-weight:600">Optional access restrictions</summary>',
      '<p class="hint">These restrictions are advisory and depend on the PDF reader respecting them. The open password is the actual protection.</p>',
      '<label class="checkbox-label"><input type="checkbox" id="security-print" checked> Allow printing</label>',
      '<label class="checkbox-label"><input type="checkbox" id="security-copy" checked> Allow copying text and images</label>',
      '<label class="checkbox-label"><input type="checkbox" id="security-edit" checked> Allow editing</label>',
      '<div class="control-group" style="margin-top:12px"><label for="security-owner">Owner password (needed if you restrict access)</label><input id="security-owner" type="password" autocomplete="new-password" placeholder="Different from the opening password" style="min-width:100%"></div>',
      '<div class="control-group"><label for="security-owner-confirm">Confirm owner password</label><input id="security-owner-confirm" type="password" autocomplete="new-password" placeholder="Re-enter owner password" style="min-width:100%"></div>',
      '</details>',
      '<div class="note" style="margin:0">AES-256 encryption is used. If you lose the opening password, it cannot be recovered. Keep an unprotected backup. The first use downloads the encryption engine; PDF contents and passwords remain on your device.</div>',
      '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center"><button type="button" class="btn btn-primary" id="security-run" disabled>Encrypt &amp; Download</button><span id="security-status" role="status" aria-live="polite" style="color:var(--text-muted);font-size:.88rem"></span></div>',
      '</div>'
    ].join('');

    const before = $('panel-compress');
    if (before && before.parentNode) before.parentNode.insertBefore(panel, before);
    else document.querySelector('main')?.appendChild(panel);

    const drop = $('security-drop');
    const input = $('security-input');
    drop.addEventListener('click', () => { if (!busy) input.click(); });
    drop.addEventListener('dragover', event => { event.preventDefault(); drop.classList.add('dragover'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
    drop.addEventListener('drop', event => {
      event.preventDefault();
      drop.classList.remove('dragover');
      if (!busy) chooseFile(event.dataTransfer?.files?.[0]);
    });
    input.addEventListener('change', () => chooseFile(input.files?.[0]));
    $('security-remove').addEventListener('click', clearFile);
    $('security-run').addEventListener('click', protectPdf);

    document.querySelectorAll('[data-panel="security"]').forEach(button => {
      button.addEventListener('click', () => {
        document.querySelectorAll('.panel').forEach(item => item.classList.toggle('active', item.id === 'panel-security'));
        document.querySelectorAll('.tool-btn').forEach(item => item.classList.toggle('active', item.dataset.panel === 'security'));
        document.querySelectorAll('.mobile-tab').forEach(item => item.classList.toggle('active', item.dataset.tab === 'tools'));
        document.querySelector('.mobile-tools-sheet.open')?.classList.remove('open');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  function setStatus(message, error = false) {
    const el = $('security-status');
    if (!el) return;
    el.textContent = message;
    el.style.color = error ? 'var(--danger)' : 'var(--text-muted)';
  }

  function chooseFile(file) {
    if (!file) return;
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      setStatus('Please choose a PDF file.', true);
      return;
    }
    selectedFile = file;
    $('security-file-name').textContent = file.name;
    $('security-file-size').textContent = 'Size: ' + (file.size / 1048576).toFixed(2) + ' MB';
    $('security-file-card').style.display = 'flex';
    $('security-drop').style.display = 'none';
    $('security-run').disabled = busy;
    setStatus('PDF selected. Set and confirm the opening password.');
  }

  function clearFile() {
    if (busy) return;
    selectedFile = null;
    $('security-input').value = '';
    $('security-file-card').style.display = 'none';
    $('security-drop').style.display = '';
    $('security-run').disabled = true;
    setStatus('');
  }

  function setBusy(value) {
    busy = value;
    $('security-run').disabled = value || !selectedFile;
    $('security-remove').disabled = value;
    $('security-input').disabled = value;
  }

  function loadToolkit() {
    if (!toolkitPromise) {
      toolkitPromise = import('https://cdn.jsdelivr.net/npm/pdfstudio@0.4.0/dist/index.js')
        .then(module => module.createPdfToolkit({
          wasmUrl: 'https://cdn.jsdelivr.net/npm/pdfstudio@0.4.0/dist/wasm/qpdf.wasm'
        }))
        .catch(error => {
          toolkitPromise = null;
          throw new Error('Could not load the PDF encryption engine. Connect to the internet and try again. ' + error.message);
        });
    }
    return toolkitPromise;
  }

  function randomOwnerPassword() {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  }

  function downloadPdf(bytes, filename) {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function protectPdf() {
    if (!selectedFile || busy) return;
    const password = $('security-password').value;
    const confirm = $('security-confirm').value;
    const allowPrint = $('security-print').checked;
    const allowCopy = $('security-copy').checked;
    const allowEdit = $('security-edit').checked;
    const owner = $('security-owner').value;
    const ownerConfirm = $('security-owner-confirm').value;
    const restrictionsActive = !allowPrint || !allowCopy || !allowEdit;

    if (password.length < 8) return setStatus('Use an opening password with at least 8 characters.', true);
    if (password !== confirm) return setStatus('The opening passwords do not match.', true);
    if (restrictionsActive && !owner) return setStatus('Enter an owner password when restricting printing, copying, or editing.', true);
    if (owner && owner !== ownerConfirm) return setStatus('The owner passwords do not match.', true);
    if (owner && owner === password) return setStatus('Use a different owner password so permissions remain separate.', true);

    setBusy(true);
    try {
      setStatus('Loading AES-256 encryption engine…');
      const toolkit = await loadToolkit();
      setStatus('Encrypting PDF locally…');
      const bytes = new Uint8Array(await selectedFile.arrayBuffer());
      const ownerPassword = owner || randomOwnerPassword();
      const protectedBytes = await toolkit.lock(bytes, {
        userPassword: password,
        ownerPassword,
        keyLength: 256,
        permissions: {
          print: allowPrint ? 'full' : 'none',
          modify: allowEdit ? 'all' : 'none',
          extract: allowCopy,
          accessibility: true
        }
      });
      if (!(protectedBytes instanceof Uint8Array) || protectedBytes.length < 8) {
        throw new Error('The encryption engine returned an invalid PDF.');
      }
      const base = selectedFile.name.replace(/\.pdf$/i, '') || 'document';
      downloadPdf(protectedBytes, base + '_protected.pdf');
      setStatus('Encrypted copy downloaded. Keep your original and store the password safely.');
    } catch (error) {
      setStatus(error?.message || 'Could not encrypt this PDF. Check the file and try again.', true);
    } finally {
      setBusy(false);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addUI, { once: true });
  } else {
    addUI();
  }
})();
