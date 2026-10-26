/* DeeDee CMS spike — GrapesJS editor UI. Local demo only. */
(function () {
  'use strict';

  const state = {
    csrf: '',
    user: null,
    revisionId: null,
    dirty: false,
    saving: false,
    ready: false,
    freeMove: false,
    loadGeneration: 0,
  };

  const els = {
    role: document.getElementById('role-badge'),
    status: document.getElementById('state-badge'),
    undo: document.getElementById('undo'),
    redo: document.getElementById('redo'),
    save: document.getElementById('save'),
    preview: document.getElementById('preview'),
    publish: document.getElementById('publish'),
    versions: document.getElementById('versions'),
    logout: document.getElementById('logout'),
    blocks: document.getElementById('blocks'),
    uploadButton: document.getElementById('upload-button'),
    uploadInput: document.getElementById('upload-input'),
    assetList: document.getElementById('asset-list'),
    deviceButtons: Array.from(document.querySelectorAll('.device')),
    freeMove: document.getElementById('free-move'),
    dragMode: document.getElementById('drag-mode'),
    toast: document.getElementById('toast'),
    versionsDialog: document.getElementById('versions-dialog'),
    versionsList: document.getElementById('versions-list'),
    versionsClose: document.getElementById('versions-close'),
    conflictDialog: document.getElementById('conflict-dialog'),
    conflictMessage: document.getElementById('conflict-message'),
    conflictReload: document.getElementById('conflict-reload'),
    conflictCancel: document.getElementById('conflict-cancel'),
  };

  const BUILTIN_ASSETS = [
    { id: 'demo-art', name: 'demo-art.svg', src: '/demo-art.svg' },
  ];

  let editor = null;
  let toastTimer = null;

  function escapeAttr(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }

  function toast(message, tone) {
    els.toast.textContent = message;
    els.toast.className = `toast${tone ? ` toast--${tone}` : ''}`;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.hidden = true;
    }, 4200);
  }

  async function api(path, options) {
    const opts = options || {};
    const headers = {};
    let body;
    if (opts.json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.json);
    } else if (opts.form) {
      body = opts.form;
    }
    if (opts.csrf) headers['X-CSRF-Token'] = state.csrf;

    const res = await fetch(path, {
      method: opts.method || 'GET',
      headers,
      body,
      credentials: 'same-origin',
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (res.status === 401) {
      window.location.href = '/admin/login';
      throw new Error('Login required');
    }

    if (!res.ok) {
      const error = new Error((data && data.error && data.error.message) || `Request failed (${res.status})`);
      error.status = res.status;
      error.code = data && data.error && data.error.code;
      error.data = data;
      throw error;
    }
    return data;
  }

  function updateStatus() {
    if (!state.ready) return;
    els.status.className = 'badge';
    if (state.dirty) {
      els.status.textContent = 'Unsaved changes';
      els.status.classList.add('badge--dirty');
    } else {
      els.status.textContent = `Saved · ${state.revisionId ? state.revisionId.slice(4, 12) : '—'}`;
      els.status.classList.add('badge--saved');
    }
    els.save.disabled = !state.dirty || state.saving;
  }

  function setBusy(busy) {
    for (const el of [els.save, els.preview, els.publish, els.versions, els.undo, els.redo]) {
      if (el === els.publish && state.user && state.user.role !== 'publisher') continue;
      el.disabled = busy;
    }
    els.logout.disabled = busy;
  }

  function markDirty() {
    if (!state.ready) return;
    state.dirty = true;
    updateStatus();
  }

  function setDevice(id) {
    if (!editor) return;
    editor.Devices.select(id);
    for (const button of els.deviceButtons) {
      button.classList.toggle('is-active', button.dataset.device === id);
    }
    editor.refresh();
  }

  function setDragMode(enabled) {
    if (!editor) return;
    state.freeMove = enabled;
    editor.setDragMode(enabled ? 'absolute' : 'translate');
    els.dragMode.textContent = enabled
      ? 'Free positioning: dragged elements can overlap'
      : 'Flow layout: elements stay in document order';
  }

  function initEditor(draft) {
    editor = window.grapesjs.init({
      container: '#canvas',
      height: '100%',
      width: 'auto',
      fromElement: false,
      storageManager: false,
      telemetry: false,
      cssIcons: '',
      panels: { defaults: [] },
      undoManager: { trackSelection: false },
      deviceManager: {
        devices: [
          { id: 'desktop', name: 'Desktop', width: '' },
          { id: 'laptop', name: 'Laptop', width: '1024px' },
          { id: 'tablet', name: 'Tablet', width: '768px' },
          { id: 'mobile', name: 'Mobile', width: '390px' },
        ],
      },
      blockManager: { appendTo: '#blocks' },
      styleManager: {
        appendTo: '#style-panel',
        sectors: [
          {
            name: 'Layout',
            open: true,
            buildProps: ['display', 'flex-direction', 'justify-content', 'align-items', 'gap', 'width', 'max-width', 'min-height', 'margin', 'padding'],
          },
          {
            name: 'Typography',
            open: false,
            buildProps: ['font-size', 'font-weight', 'line-height', 'letter-spacing', 'color', 'text-align'],
          },
          {
            name: 'Decoration',
            open: false,
            buildProps: ['background-color', 'border', 'border-radius', 'box-shadow', 'opacity'],
          },
        ],
      },
      layerManager: { appendTo: '#layers-panel' },
      traitManager: { appendTo: '#traits-panel' },
      assetManager: {
        assets: BUILTIN_ASSETS,
        uploadFile: (event) => {
          const files = event && event.dataTransfer ? event.dataTransfer.files : event && event.target ? event.target.files : null;
          if (files && files.length) uploadFiles(files);
        },
      },
    });

    window.__pocEditor = editor;
    editor.on('update', markDirty);
    editor.on('component:add', markDirty);
    editor.on('component:update', markDirty);
    editor.on('canvas:drop', markDirty);

    editor.BlockManager.add('section', {
      label: 'Section',
      content: '<section class="poc-section"><h2 class="poc-section-title">New section</h2><p class="poc-section-body">Write the supporting copy here.</p></section>',
    });
    editor.BlockManager.add('heading', {
      label: 'Heading',
      content: '<h1 class="poc-title">New heading</h1>',
    });
    editor.BlockManager.add('paragraph', {
      label: 'Paragraph',
      content: '<p class="poc-lede">Write a short paragraph of demo copy.</p>',
    });
    editor.BlockManager.add('button', {
      label: 'Button',
      content: '<a class="poc-button" href="#contact">Button</a>',
    });
    editor.BlockManager.add('image', {
      label: 'Image',
      content: '<figure class="poc-hero__art"><img src="/demo-art.svg" alt="Abstract demo artwork"><figcaption>Demo artwork caption.</figcaption></figure>',
    });
    editor.BlockManager.add('cards', {
      label: 'Cards',
      content:
        '<div class="poc-cards">' +
        '<article class="poc-card"><h3>Card one</h3><p>Short card copy.</p></article>' +
        '<article class="poc-card"><h3>Card two</h3><p>Short card copy.</p></article>' +
        '<article class="poc-card"><h3>Card three</h3><p>Short card copy.</p></article>' +
        '</div>',
    });
    editor.BlockManager.add('divider', {
      label: 'Divider',
      content: '<hr>',
    });
    editor.BlockManager.add('spacer', {
      label: 'Spacer',
      content: '<div style="height:48px"></div>',
    });
    editor.BlockManager.add('footer', {
      label: 'Footer',
      content: '<footer class="poc-footer"><p>DeeDee Studio CMS spike · demo data only</p></footer>',
    });

    if (draft.projectData) {
      editor.loadProjectData(draft.projectData);
    } else {
      editor.setComponents(draft.html);
      editor.setStyle(draft.css);
    }

    setDevice('desktop');
    setDragMode(false);
    settleLoad();
  }

  function settleLoad() {
    // GrapesJS emits late update events while it re-renders a loaded project.
    // Keep change tracking off briefly so a freshly loaded draft is not marked dirty.
    const generation = ++state.loadGeneration;
    state.ready = false;
    state.dirty = false;
    editor.clearDirtyCount();
    setTimeout(() => {
      if (generation !== state.loadGeneration) return;
      editor.clearDirtyCount();
      state.dirty = false;
      state.ready = true;
      updateStatus();
    }, 250);
  }

  function loadDraftIntoEditor(draft) {
    state.ready = false;
    state.revisionId = draft.revision.id;
    if (draft.projectData) {
      editor.loadProjectData(draft.projectData);
    } else {
      editor.setComponents('');
      editor.setStyle('');
      editor.setComponents(draft.html);
      editor.setStyle(draft.css);
    }
    editor.UndoManager.clear();
    settleLoad();
  }

  async function saveDraft(options) {
    const opts = options || {};
    if (state.saving) return null;
    if (!state.ready) return null;

    state.saving = true;
    setBusy(true);
    updateStatus();

    try {
      const data = await api('/api/draft', {
        method: 'PUT',
        csrf: true,
        json: {
          html: editor.getHtml(),
          css: editor.getCss(),
          projectData: editor.getProjectData(),
          baseRevisionId: state.revisionId,
        },
      });
      state.revisionId = data.revision.id;
      state.dirty = false;
      editor.clearDirtyCount();
      updateStatus();
      if (!opts.silent) toast('Draft saved', 'good');
      return data.revision;
    } catch (error) {
      if (error.status === 409) {
        showConflict(error.data && error.data.currentRevision);
        return null;
      }
      toast(error.message, 'error');
      return null;
    } finally {
      state.saving = false;
      setBusy(false);
      updateStatus();
    }
  }

  function showConflict(currentRevision) {
    const detail = currentRevision
      ? ` Latest draft: ${currentRevision.label} (${new Date(currentRevision.createdAt).toLocaleString()}).`
      : '';
    els.conflictMessage.textContent =
      `Another session saved a newer draft.${detail} Reload the latest draft to continue. Your unsaved canvas changes will be discarded.`;
    if (typeof els.conflictDialog.showModal === 'function') els.conflictDialog.showModal();
  }

  async function reloadLatestDraft() {
    try {
      const draft = await api('/api/draft');
      loadDraftIntoEditor(draft);
      els.conflictDialog.close();
      toast('Loaded the latest draft', 'good');
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function previewCurrent() {
    if (state.dirty) {
      const saved = await saveDraft({ silent: true });
      if (!saved) return;
    }
    const tab = window.open('about:blank', '_blank');
    try {
      const data = await api(`/api/versions/${state.revisionId}/preview-token`, {
        method: 'POST',
        csrf: true,
      });
      if (tab) {
        tab.location.replace(data.url);
      } else {
        window.location.href = data.url;
      }
      toast('Preview link opened. It expires in 15 minutes.', 'good');
    } catch (error) {
      if (tab) tab.close();
      toast(error.message, 'error');
    }
  }

  async function publishCurrent() {
    if (state.user.role !== 'publisher') {
      toast('Only the publisher role can publish in this POC.', 'error');
      return;
    }
    if (state.dirty) {
      const saved = await saveDraft({ silent: true });
      if (!saved) return;
    }
    if (!window.confirm('Publish this draft to the public demo page?')) return;
    try {
      await api(`/api/versions/${state.revisionId}/publish`, { method: 'POST', csrf: true });
      toast('Published. The public demo page now serves this revision.', 'good');
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  function formatDate(value) {
    try {
      return new Date(value).toLocaleString();
    } catch {
      return String(value);
    }
  }

  async function openVersions() {
    els.versionsDialog.showModal();
    els.versionsList.textContent = 'Loading…';
    try {
      const data = await api('/api/versions');
      renderVersions(data.versions || []);
    } catch (error) {
      els.versionsList.textContent = error.message;
    }
  }

  function renderVersions(versions) {
    els.versionsList.textContent = '';
    if (!versions.length) {
      els.versionsList.textContent = 'No revisions yet.';
      return;
    }

    for (const version of versions) {
      const row = document.createElement('article');
      row.className = 'version';

      const info = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'version__title';
      title.textContent = version.label || 'Untitled revision';

      if (version.isDraft) {
        const chip = document.createElement('span');
        chip.className = 'badge badge--saved';
        chip.textContent = 'Draft';
        title.appendChild(chip);
      }
      if (version.isPublished) {
        const chip = document.createElement('span');
        chip.className = 'badge';
        chip.textContent = 'Published';
        title.appendChild(chip);
      }

      const meta = document.createElement('div');
      meta.className = 'version__meta';
      meta.textContent = `${formatDate(version.createdAt)} · ${version.createdBy} · ${version.id}`;

      info.append(title, meta);

      const actions = document.createElement('div');
      actions.className = 'version__actions';

      const previewButton = document.createElement('button');
      previewButton.type = 'button';
      previewButton.className = 'button button--small';
      previewButton.textContent = 'Preview';
      previewButton.addEventListener('click', () => previewVersion(version.id));
      actions.appendChild(previewButton);

      const restoreButton = document.createElement('button');
      restoreButton.type = 'button';
      restoreButton.className = 'button button--small';
      restoreButton.textContent = 'Restore';
      restoreButton.disabled = version.isDraft;
      restoreButton.addEventListener('click', () => restoreVersion(version));
      actions.appendChild(restoreButton);

      const publishButton = document.createElement('button');
      publishButton.type = 'button';
      publishButton.className = 'button button--small button--primary';
      publishButton.textContent = 'Publish';
      publishButton.disabled = version.isPublished || (state.user && state.user.role !== 'publisher');
      publishButton.addEventListener('click', () => publishVersion(version));
      actions.appendChild(publishButton);

      row.append(info, actions);
      els.versionsList.appendChild(row);
    }
  }

  async function previewVersion(revisionId) {
    const tab = window.open('about:blank', '_blank');
    try {
      const data = await api(`/api/versions/${revisionId}/preview-token`, { method: 'POST', csrf: true });
      if (tab) tab.location.replace(data.url);
      else window.location.href = data.url;
    } catch (error) {
      if (tab) tab.close();
      toast(error.message, 'error');
    }
  }

  async function restoreVersion(version) {
    if (!window.confirm(`Restore "${version.label}" as a new draft? The current draft stays in history.`)) return;
    try {
      await api(`/api/versions/${version.id}/restore`, { method: 'POST', csrf: true });
      const draft = await api('/api/draft');
      loadDraftIntoEditor(draft);
      els.versionsDialog.close();
      toast('Revision copied into a new draft', 'good');
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function publishVersion(version) {
    if (!window.confirm(`Publish "${version.label}"?`)) return;
    try {
      await api(`/api/versions/${version.id}/publish`, { method: 'POST', csrf: true });
      toast('Release published', 'good');
      await openVersions();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function uploadFiles(files) {
    const uploaded = [];
    for (const file of Array.from(files)) {
      if (!file.type || !file.type.startsWith('image/')) {
        toast(`${file.name}: only image files are allowed`, 'error');
        continue;
      }
      const form = new FormData();
      form.append('files', file);
      try {
        const data = await api('/api/uploads', { method: 'POST', csrf: true, form });
        for (const asset of data.data || []) uploaded.push(asset);
      } catch (error) {
        toast(`${file.name}: ${error.message}`, 'error');
      }
    }

    if (uploaded.length) {
      if (editor) {
        editor.AssetManager.add(uploaded.map((asset) => ({ src: asset.src, name: asset.name, type: 'image' })));
      }
      await refreshAssets();
      toast(`${uploaded.length} image${uploaded.length === 1 ? '' : 's'} uploaded`, 'good');
    }
    return uploaded;
  }

  async function refreshAssets() {
    let assets = [];
    try {
      const data = await api('/api/assets');
      assets = data.data || [];
    } catch (error) {
      toast(error.message, 'error');
    }
    renderAssets([...BUILTIN_ASSETS, ...assets]);
  }

  function renderAssets(assets) {
    els.assetList.textContent = '';
    for (const asset of assets) {
      const card = document.createElement('div');
      card.className = 'asset';

      const img = document.createElement('img');
      img.src = asset.src;
      img.alt = '';
      img.loading = 'lazy';

      const meta = document.createElement('div');
      meta.className = 'asset__meta';

      const name = document.createElement('div');
      name.className = 'asset__name';
      name.textContent = asset.name || asset.file || 'image';
      name.title = name.textContent;

      const actions = document.createElement('div');
      actions.className = 'asset__actions';

      const useButton = document.createElement('button');
      useButton.type = 'button';
      useButton.className = 'button button--small';
      useButton.textContent = 'Use';
      useButton.addEventListener('click', () => useAsset(asset));

      actions.appendChild(useButton);
      meta.append(name, actions);
      card.append(img, meta);
      els.assetList.appendChild(card);
    }
  }

  function useAsset(asset) {
    if (!editor) return;
    const selected = editor.getSelected();
    const isImage = selected && (selected.is('image') || selected.get('tagName') === 'IMG');
    if (isImage) {
      selected.addAttributes({ src: asset.src });
      selected.set('src', asset.src);
      toast('Image replaced on the selected component', 'good');
      return;
    }
    const target = selected && selected.components ? selected : editor.getWrapper();
    target.append(
      `<figure class="poc-hero__art"><img src="${escapeAttr(asset.src)}" alt="${escapeAttr(asset.name || 'Uploaded image')}"></figure>`,
    );
    toast('Image inserted', 'good');
  }

  function bindUi() {
    els.save.addEventListener('click', () => saveDraft());
    els.preview.addEventListener('click', previewCurrent);
    els.publish.addEventListener('click', publishCurrent);
    els.versions.addEventListener('click', openVersions);
    els.versionsClose.addEventListener('click', () => els.versionsDialog.close());
    els.conflictReload.addEventListener('click', reloadLatestDraft);
    els.conflictCancel.addEventListener('click', () => els.conflictDialog.close());
    els.undo.addEventListener('click', () => editor && editor.UndoManager.undo());
    els.redo.addEventListener('click', () => editor && editor.UndoManager.redo());
    els.logout.addEventListener('click', logout);

    for (const button of els.deviceButtons) {
      button.addEventListener('click', () => setDevice(button.dataset.device));
    }

    els.freeMove.addEventListener('change', () => setDragMode(els.freeMove.checked));

    els.uploadButton.addEventListener('click', () => els.uploadInput.click());
    els.uploadInput.addEventListener('change', async () => {
      if (els.uploadInput.files && els.uploadInput.files.length) {
        await uploadFiles(els.uploadInput.files);
      }
      els.uploadInput.value = '';
    });

    for (const tab of Array.from(document.querySelectorAll('.tab'))) {
      tab.addEventListener('click', () => {
        for (const other of Array.from(document.querySelectorAll('.tab'))) {
          other.classList.toggle('tab--active', other === tab);
        }
        for (const panel of ['style', 'layers', 'traits']) {
          document.getElementById(`${panel}-panel`).hidden = panel !== tab.dataset.tab;
        }
        if (editor) editor.refresh();
      });
    }

    document.addEventListener('keydown', (event) => {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (state.dirty) saveDraft();
      }
    });

    window.addEventListener('beforeunload', (event) => {
      if (!state.dirty) return;
      event.preventDefault();
      event.returnValue = '';
    });
  }

  async function logout() {
    try {
      await api('/api/logout', { method: 'POST', csrf: true });
    } catch {
      // Session may already be gone.
    }
    window.location.href = '/admin/login';
  }

  async function boot() {
    bindUi();
    try {
      const session = await api('/api/session');
      state.user = session.user;
      state.csrf = session.csrf;
      state.revisionId = session.state.draftRevisionId;
      els.role.textContent = `${session.user.username} · ${session.user.role}`;

      if (session.user.role !== 'publisher') {
        els.publish.disabled = true;
        els.publish.title = 'The publisher role is required. The server rejects editor publishes.';
      }

      const draft = await api('/api/draft');
      initEditor(draft);
      await refreshAssets();
      updateStatus();
    } catch (error) {
      toast(error.message, 'error');
      els.status.textContent = 'Failed to load';
    }
  }

  boot();
})();
