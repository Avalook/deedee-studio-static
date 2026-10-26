export function installLocalCommentComposer(root) {
  if (!root) return () => {};

  const openButton = root.querySelector('[data-comment-open]');
  const composer = root.querySelector('[data-comment-composer]');
  const editor = root.querySelector('[data-comment-editor]');
  const cancelButton = root.querySelector('[data-comment-cancel]');
  if (!openButton || !composer || !editor || !cancelButton) return () => {};

  const openComposer = () => {
    openButton.hidden = true;
    openButton.setAttribute?.('aria-expanded', 'true');
    composer.hidden = false;
    editor.focus();
  };
  const closeComposer = () => {
    composer.hidden = true;
    openButton.hidden = false;
    openButton.setAttribute?.('aria-expanded', 'false');
    editor.textContent = '';
  };

  openButton.addEventListener('click', openComposer);
  cancelButton.addEventListener('click', closeComposer);

  return () => {
    openButton.removeEventListener('click', openComposer);
    cancelButton.removeEventListener('click', closeComposer);
  };
}

if (typeof document !== 'undefined') {
  installLocalCommentComposer(document.querySelector('[data-deedee-local-comments]'));
}
