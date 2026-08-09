/* ════════════════════════════════════════════════════════════════
   MetricMech PDF Tools — shared runtime (mm-pdf.js)
   Vanilla JS. Everything runs IN THE BROWSER — files never upload.

   API (window.mmPdf):
     ensureLibs({pdfjs})            lazy-load /assets/vendor libs → Promise
     dropzone(sel, opts)            drag-drop + browse + file chips
       opts: accept, multiple, reorder, onChange(files)
       returns { getFiles, clear, addFiles }
     readBuf(file)                  File → Promise<ArrayBuffer>
     download(data, filename, mime) trigger a download (Uint8Array/Blob)
     status(sel, msg, kind)         inline status line (kind: info|ok|err|busy)
     fmtSize(bytes)
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.mmPdf) return;

  var VENDOR = (document.querySelector('script[src*="mm-pdf.js"]') || {}).src || '';
  var ROOT = VENDOR.replace(/assets\/mm-pdf\.js.*$/, '');

  function loadScript(src) {
    return new Promise(function (res, rej) {
      if (document.querySelector('script[data-mm-vendor="' + src + '"]')) { res(); return; }
      var s = document.createElement('script');
      s.src = ROOT + src;
      s.dataset.mmVendor = src;
      s.onload = res;
      s.onerror = function () { rej(new Error('Failed to load ' + src)); };
      document.head.appendChild(s);
    });
  }

  var libsReady = null;
  function ensureLibs(opts) {
    opts = opts || {};
    if (!libsReady) libsReady = loadScript('assets/vendor/pdf-lib.min.js');
    var chain = libsReady;
    if (opts.pdfjs) {
      chain = chain.then(function () { return loadScript('assets/vendor/pdfjs.min.js'); })
        .then(function () {
          if (window.pdfjsLib && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = ROOT + 'assets/vendor/pdfjs.worker.min.js';
          }
        });
    }
    return chain;
  }

  function readBuf(file) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
      r.readAsArrayBuffer(file);
    });
  }

  function fmtSize(b) {
    if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB';
    if (b >= 1024) return (b / 1024).toFixed(0) + ' KB';
    return b + ' B';
  }

  function download(data, filename, mime) {
    var blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/pdf' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function status(sel, msg, kind) {
    var el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (!el) return;
    kind = kind || 'info';
    var icon = { info: 'ℹ', ok: '✓', err: '✕', busy: '⏳' }[kind];
    el.className = 'mm-pdf-status ' + kind;
    el.innerHTML = msg ? '<span aria-hidden="true">' + icon + '</span> ' + msg : '';
    el.style.display = msg ? '' : 'none';
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* Drag-drop zone with file-chip list (optional reorder for merge). */
  function dropzone(sel, opts) {
    opts = opts || {};
    var mount = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (!mount) return null;
    var files = [];
    var accept = opts.accept || 'application/pdf';
    var multiple = opts.multiple !== false;

    mount.innerHTML =
      '<div class="mm-drop" tabindex="0" role="button" aria-label="Choose or drop files">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' +
        '<div class="mm-drop__title">' + (opts.title || (multiple ? 'Drop files here' : 'Drop a file here')) + '</div>' +
        '<div class="mm-drop__sub">or <span class="mm-drop__browse">browse</span> — processed locally, never uploaded</div>' +
        '<input type="file" hidden ' + (multiple ? 'multiple ' : '') + 'accept="' + accept + '">' +
      '</div>' +
      '<div class="mm-filelist"></div>';

    var zone = mount.querySelector('.mm-drop');
    var input = mount.querySelector('input[type=file]');
    var list = mount.querySelector('.mm-filelist');

    function accepts(f) {
      if (accept === 'application/pdf') return f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
      if (accept.indexOf('image/') === 0) return /^image\//.test(f.type);
      return true;
    }

    function render() {
      list.innerHTML = files.map(function (f, i) {
        return '<div class="mm-filechip" data-i="' + i + '">' +
          '<span class="mm-filechip__name">' + esc(f.name) + '</span>' +
          '<span class="mm-filechip__size">' + fmtSize(f.size) + '</span>' +
          (opts.reorder && files.length > 1 ?
            '<button type="button" class="mm-filechip__btn" data-act="up" aria-label="Move up" ' + (i === 0 ? 'disabled' : '') + '>↑</button>' +
            '<button type="button" class="mm-filechip__btn" data-act="down" aria-label="Move down" ' + (i === files.length - 1 ? 'disabled' : '') + '>↓</button>' : '') +
          '<button type="button" class="mm-filechip__btn" data-act="rm" aria-label="Remove">✕</button>' +
        '</div>';
      }).join('');
      if (opts.onChange) opts.onChange(files.slice());
    }

    function addFiles(fl) {
      var ok = Array.prototype.filter.call(fl, accepts);
      if (!multiple) files = ok.slice(0, 1);
      else files = files.concat(ok);
      render();
    }

    zone.addEventListener('click', function () { input.click(); });
    zone.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    input.addEventListener('change', function () { addFiles(input.files); input.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.remove('over'); });
    });
    zone.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
    });
    list.addEventListener('click', function (e) {
      var btn = e.target.closest('.mm-filechip__btn');
      if (!btn) return;
      var chip = btn.closest('.mm-filechip');
      var i = +chip.dataset.i, act = btn.dataset.act;
      if (act === 'rm') files.splice(i, 1);
      else if (act === 'up' && i > 0) { var t = files[i - 1]; files[i - 1] = files[i]; files[i] = t; }
      else if (act === 'down' && i < files.length - 1) { var t2 = files[i + 1]; files[i + 1] = files[i]; files[i] = t2; }
      render();
    });

    return {
      getFiles: function () { return files.slice(); },
      clear: function () { files = []; render(); },
      addFiles: addFiles
    };
  }

  window.mmPdf = {
    ensureLibs: ensureLibs,
    dropzone: dropzone,
    readBuf: readBuf,
    download: download,
    status: status,
    fmtSize: fmtSize
  };
})();
