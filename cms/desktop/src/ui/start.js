const byId = (id) => document.getElementById(id);

window.deedee.onStatus(({ message, error = '', needsCode = false }) => {
  byId('status').textContent = message;
  byId('error').textContent = error;
  byId('activate').hidden = !needsCode;
  byId('submit').disabled = false;
});

byId('activate').addEventListener('submit', async (event) => {
  event.preventDefault();
  byId('submit').disabled = true;
  await window.deedee.activate(byId('code').value, byId('form-key').value);
});
