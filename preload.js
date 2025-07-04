const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Example: Close the application
  closeApp: () => ipcRenderer.invoke('close-app'),
  
  // Example: Minimize to system tray
  minimizeApp: () => ipcRenderer.invoke('minimize-app'),
  
  // Example: Set window opacity
  setOpacity: (opacity) => ipcRenderer.invoke('set-opacity', opacity),
  
  // Example: Toggle always on top
  toggleAlwaysOnTop: () => ipcRenderer.invoke('toggle-always-on-top'),
  
  // Example: Make window draggable by any element
  startDrag: () => ipcRenderer.invoke('start-drag')
}) 