const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  // Document conversion API
  convertDocx: async (fileBuffer, fileName) => {
    return await ipcRenderer.invoke('convert-docx', fileBuffer, fileName);
  },
  // Document export API
  exportDocument: async (html, format, filename) => {
    return await ipcRenderer.invoke('export-document', html, format, filename);
  },
  // Native dialog APIs
  showErrorDialog: async (options) => {
    return await ipcRenderer.invoke('show-error-dialog', options);
  },
  showInfoDialog: async (options) => {
    return await ipcRenderer.invoke('show-info-dialog', options);
  },
  showWarningDialog: async (options) => {
    return await ipcRenderer.invoke('show-warning-dialog', options);
  },
});
