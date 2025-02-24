// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
const { contextBridge, ipcRenderer } = require('electron')

// This goes to window.electronAPI in renderer.js
contextBridge.exposeInMainWorld('electronAPI', {
    onDataFromBackend: (callback) => ipcRenderer.on('onDataFromBackend', (_event, value) => callback(value)),
    sendToBackend: (action, params) => ipcRenderer.invoke('onDataFromFrontend', action, params),
})