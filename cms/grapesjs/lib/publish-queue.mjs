/** Serialize an entire export/push transaction, including failure recovery. */
export function createPublishQueue() {
  let pending = Promise.resolve();
  return function enqueue(action) {
    const result = pending.then(action, action);
    pending = result.catch(() => {});
    return result;
  };
}
