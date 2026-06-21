// ============================================================
// TOAST
// ============================================================

const toastContainer = document.getElementById('toast-container');

function showToast(message, duration = 3000) {
  const toast = document.createElement('div');
  toast.className = 'ty-toast';
  toast.textContent = message;
  toastContainer.appendChild(toast);

  const dismiss = () => {
    toast.classList.add('toast-out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };

  toast.addEventListener('click', dismiss);
  setTimeout(dismiss, duration);
}

// ============================================================
// ROUTER
// ============================================================

const views = {
  editor: document.getElementById('view-editor'),
  samples: document.getElementById('view-samples'),
};

function switchView(name) {
  Object.entries(views).forEach(([key, el]) => {
    const isActive = key === name;
    el.classList.toggle('active', isActive);
    el.hidden = !isActive;
  });

  document.querySelectorAll('[data-view]').forEach((btn) => {
    const isActive = btn.dataset.view === name;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-current', isActive ? 'page' : 'false');
  });
}

document.querySelectorAll('[data-view]').forEach((btn) => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

// ============================================================
// SAMPLES API
// ============================================================

async function listSamples() {
  const res = await fetch('/api/samples');
  if (!res.ok) throw new Error('Failed to load samples');
  const data = await res.json();
  return data.samples;
}

async function uploadSample(filename, content, mimeType = 'text/plain') {
  const res = await fetch('/api/samples', {
    method: 'POST',
    headers: {
      'Content-Type': mimeType,
      'x-filename': filename,
    },
    body: content,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Upload failed');
  }
  return res.json();
}

async function deleteSample(pathname) {
  const res = await fetch(`/api/samples?pathname=${encodeURIComponent(pathname)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Delete failed');
  return res.json();
}

// ============================================================
// SAMPLE LIST UI
// ============================================================

const sampleList = document.getElementById('sample-list');
const sampleListEmpty = document.getElementById('sample-list-empty');
const noSamplesWarning = document.getElementById('no-samples-warning');

let samplesCache = [];

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderSampleList(samples) {
  samplesCache = samples;

  const rows = sampleList.querySelectorAll('.sample-row');
  rows.forEach((r) => r.remove());

  if (samples.length === 0) {
    sampleListEmpty.hidden = false;
    noSamplesWarning.classList.remove('visible');
    return;
  }

  sampleListEmpty.hidden = true;
  noSamplesWarning.classList.remove('visible');

  samples.forEach((sample) => {
    const row = document.createElement('div');
    row.className = 'sample-row';
    row.dataset.pathname = sample.pathname;
    row.setAttribute('role', 'listitem');

    const name = document.createElement('span');
    name.className = 'sample-name';
    name.textContent = sample.name;

    const badge = document.createElement('span');
    badge.className = 'ty-badge';
    badge.textContent = formatSize(sample.size);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'ty-btn ty-btn--danger ty-btn--sm';
    deleteBtn.setAttribute('aria-label', `Delete ${sample.name}`);
    deleteBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;

    deleteBtn.addEventListener('click', async () => {
      row.classList.add('removing');
      try {
        await deleteSample(sample.pathname);
        row.addEventListener('transitionend', () => row.remove(), { once: true });
        samplesCache = samplesCache.filter((s) => s.pathname !== sample.pathname);
        if (samplesCache.length === 0) {
          sampleListEmpty.hidden = false;
          noSamplesWarning.classList.remove('visible');
        }
        showToast('Sample removed.');
      } catch {
        row.classList.remove('removing');
        showToast('Could not delete sample. Try again.');
      }
    });

    row.appendChild(name);
    row.appendChild(badge);
    row.appendChild(deleteBtn);
    sampleList.appendChild(row);
  });
}

async function refreshSamples() {
  try {
    const samples = await listSamples();
    renderSampleList(samples);
    if (samples.length === 0) {
      noSamplesWarning.classList.add('visible');
    }
  } catch {
    showToast('Could not load samples.');
  }
}

// ============================================================
// FILE UPLOAD
// ============================================================

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const dropZoneLabel = document.getElementById('drop-zone-label');

async function handleFiles(files) {
  const allowed = Array.from(files).filter(
    (f) => f.type === 'text/plain' || f.type === 'text/markdown' || f.name.endsWith('.md') || f.name.endsWith('.txt')
  );

  if (allowed.length === 0) {
    showToast('Only .txt and .md files are accepted.');
    return;
  }

  for (const file of allowed) {
    try {
      const content = await file.arrayBuffer();
      await uploadSample(file.name, content, file.type || 'text/plain');
      showToast(`Sample added.`);
    } catch (err) {
      showToast(err.message || 'Upload failed. Try again.');
    }
  }

  await refreshSamples();
}

dropZone.addEventListener('click', (e) => {
  if (e.target.closest('button') || e.target === fileInput) return;
  fileInput.click();
});

dropZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});

fileInput.addEventListener('change', () => {
  if (fileInput.files.length) {
    handleFiles(fileInput.files);
    fileInput.value = '';
  }
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
  dropZoneLabel.textContent = 'Drop to upload';
});

dropZone.addEventListener('dragleave', (e) => {
  if (!dropZone.contains(e.relatedTarget)) {
    dropZone.classList.remove('drag-over');
    dropZoneLabel.textContent = 'Drop files here';
  }
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  dropZoneLabel.textContent = 'Drop files here';
  if (e.dataTransfer.files.length) {
    handleFiles(e.dataTransfer.files);
  }
});

// ============================================================
// PASTE UPLOAD
// ============================================================

const pasteInput = document.getElementById('paste-input');
const pasteFilename = document.getElementById('paste-filename');
const pasteUploadBtn = document.getElementById('paste-upload-btn');

pasteUploadBtn.addEventListener('click', async () => {
  const text = pasteInput.value.trim();
  if (!text) {
    showToast('Paste some text first.');
    return;
  }

  let filename = pasteFilename.value.trim();
  if (!filename) {
    filename = `sample-${Date.now()}.txt`;
  }
  if (!filename.endsWith('.txt') && !filename.endsWith('.md')) {
    filename += '.txt';
  }

  pasteUploadBtn.disabled = true;
  try {
    await uploadSample(filename, new TextEncoder().encode(text), 'text/plain');
    pasteInput.value = '';
    pasteFilename.value = '';
    showToast('Sample added.');
    await refreshSamples();
  } catch (err) {
    showToast(err.message || 'Upload failed. Try again.');
  } finally {
    pasteUploadBtn.disabled = false;
  }
});

// ============================================================
// GENERATE
// ============================================================

const promptInput = document.getElementById('prompt-input');
const generateBtn = document.getElementById('generate-btn');
const outputArea = document.getElementById('output-area');
const outputEmpty = document.getElementById('output-empty');
const copyBtn = document.getElementById('copy-btn');
const wordCountEl = document.getElementById('word-count');

let isGenerating = false;
let outputText = '';

function updateWordCount() {
  const text = promptInput.value.trim();
  const count = text ? text.split(/\s+/).length : 0;
  wordCountEl.textContent = count > 0 ? `~${count} words` : '';
}

promptInput.addEventListener('input', updateWordCount);

function setGenerating(state) {
  isGenerating = state;
  generateBtn.disabled = state;
  generateBtn.innerHTML = state
    ? `<span class="ty-spinner" aria-hidden="true"></span>Generating...`
    : 'Generate';
}

function setGeneratingLabel(label) {
  generateBtn.innerHTML = `<span class="ty-spinner" aria-hidden="true"></span>${label}`;
}

function appendOutput(text) {
  outputEmpty.hidden = true;

  const cursor = outputArea.querySelector('.output-cursor');
  if (cursor) cursor.remove();

  outputText += text;
  const textNode = document.createTextNode(text);
  outputArea.appendChild(textNode);

  const newCursor = document.createElement('span');
  newCursor.className = 'output-cursor';
  newCursor.setAttribute('aria-hidden', 'true');
  outputArea.appendChild(newCursor);
  outputArea.scrollTop = outputArea.scrollHeight;
}

function finalizeOutput() {
  const cursor = outputArea.querySelector('.output-cursor');
  if (cursor) cursor.remove();

  copyBtn.hidden = false;
  outputArea.scrollTop = outputArea.scrollHeight;
}

function clearOutput() {
  outputArea.innerHTML = '';
  outputArea.appendChild(outputEmpty);
  outputEmpty.hidden = false;
  outputText = '';
  copyBtn.hidden = true;
}

generateBtn.addEventListener('click', async () => {
  const prompt = promptInput.value.trim();
  if (!prompt) {
    promptInput.focus();
    return;
  }
  if (isGenerating) return;

  clearOutput();
  setGenerating(true);

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || 'Generation failed. Try again.');
      setGenerating(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6);

        if (payload === '[DONE]') {
          finalizeOutput();
          setGenerating(false);
          return;
        }

        if (payload === '[ANALYZING]') {
          setGeneratingLabel('Analyzing...');
          continue;
        }

        if (payload === '[REWRITING]') {
          setGeneratingLabel('Rewriting...');
          continue;
        }

        if (payload.startsWith('[ERROR]')) {
          showToast('Generation error. Try again.');
          finalizeOutput();
          setGenerating(false);
          return;
        }

        const text = payload.replace(/\\n/g, '\n');
        appendOutput(text);
      }
    }
  } catch (err) {
    showToast('Network error. Check your connection.');
  } finally {
    setGenerating(false);
    finalizeOutput();
  }
});

// ============================================================
// COPY
// ============================================================

copyBtn.addEventListener('click', async () => {
  if (!outputText) return;
  try {
    await navigator.clipboard.writeText(outputText);
    const original = copyBtn.innerHTML;
    copyBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
    copyBtn.disabled = true;
    setTimeout(() => {
      copyBtn.innerHTML = original;
      copyBtn.disabled = false;
    }, 2000);
  } catch {
    showToast('Could not copy. Select and copy manually.');
  }
});

// ============================================================
// INIT
// ============================================================

(async function init() {
  await refreshSamples();
})();
