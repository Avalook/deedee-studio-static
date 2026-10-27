/** Delete one component without mutating the undo snapshot. */
export function deleteComponent(document, selection) {
  if (!selection?.deletable || typeof selection.selector !== 'string') return document;
  const insertionId = selection.insertionId;
  if (insertionId && document.insertions.some((item) => item.id === insertionId)) {
    return { ...document, insertions: document.insertions.filter((item) => item.id !== insertionId),
      operations: document.operations.filter((operation) => operation.selector !== selection.selector) };
  }
  const existing = document.operations.find((operation) => operation.selector === selection.selector) || { selector: selection.selector };
  return { ...document, operations: [...document.operations.filter((operation) => operation.selector !== selection.selector), { ...existing, deleted: true }] };
}

/** Keyboard deletion must never consume text editing, controls, or modified shortcuts. */
export function shouldDeleteComponent(event, selection) {
  if (!selection?.deletable || !['Delete', 'Backspace'].includes(event.key) || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return false;
  return !event.target?.closest?.('input,textarea,select,button,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="dialog"],dialog');
}
