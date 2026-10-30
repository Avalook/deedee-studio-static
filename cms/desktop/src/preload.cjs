const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('deedee', {
  activate: (code, formKey) => ipcRenderer.invoke('activate', { code, formKey }),
  onStatus: (listener) => ipcRenderer.on('status', (_event, status) => listener(status)),
});
