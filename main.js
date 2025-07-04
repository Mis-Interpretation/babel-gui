const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

let mainWindow;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 180,
    // Remove window frame/borders
    frame: false,
    // Make window transparent
    transparent: true,
    // Prevent Windows from adding any frame elements
    thickFrame: false,
    // Remove window shadow that might cause artifacts
    hasShadow: false,
    // Keep window on top of other applications
    alwaysOnTop: true,
    // Prevent window from losing focus (this should stop the header!)
    focusable: false,
    // Allow window to be resized
    resizable: true,
    // Allow window to be moved by dragging
    movable: true,
    // Hide from taskbar (optional - comment out if you want it in taskbar)
    skipTaskbar: true,
    // Start hidden to prevent flash
    show: false,
    // Additional Windows-specific fixes for transparency
    ...(process.platform === 'win32' && {
      titleBarOverlay: false,
      autoHideMenuBar: true,
    }),
    webPreferences: {
      // Add preload script for secure IPC
      preload: path.join(__dirname, 'preload.js'),
      // Disable node integration in renderer for security
      nodeIntegration: false,
      // Enable context isolation for security
      contextIsolation: true
    }
  })

  mainWindow.loadFile('index.html')
  
  // Show window after it's fully loaded to prevent flash and ensure proper setup
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    
    // Ensure the window can still receive mouse events even though it's not focusable
    mainWindow.setIgnoreMouseEvents(false)
    
    // Ensure Windows-specific properties are set correctly
    if (process.platform === 'win32') {
      mainWindow.setSkipTaskbar(true)
      // Force a refresh of window properties to prevent ghost header
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          const bounds = mainWindow.getBounds()
          mainWindow.setBounds({ ...bounds, width: bounds.width + 1 })
          mainWindow.setBounds(bounds)
        }
      }, 100)
    }
  })
  
  // Ensure window stays non-focusable to prevent header appearance
  mainWindow.on('focus', () => {
    if (process.platform === 'win32') {
      // If somehow it gains focus, immediately blur it to maintain the non-focusable state
      mainWindow.blur()
    }
  })
  
  // Optional: Open DevTools for debugging
  // mainWindow.webContents.openDevTools()
}

// IPC handlers for widget controls
ipcMain.handle('close-app', () => {
  app.quit()
})

ipcMain.handle('minimize-app', () => {
  if (mainWindow) {
    mainWindow.minimize()
  }
})



ipcMain.handle('toggle-always-on-top', () => {
  if (mainWindow) {
    const isAlwaysOnTop = mainWindow.isAlwaysOnTop()
    mainWindow.setAlwaysOnTop(!isAlwaysOnTop)
    return !isAlwaysOnTop
  }
})

ipcMain.handle('start-drag', () => {
  if (mainWindow) {
    mainWindow.webContents.startDrag({
      file: '',
      icon: ''
    })
  }
})

app.whenReady().then(() => {
  createWindow()
})

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})