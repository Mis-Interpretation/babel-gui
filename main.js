const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron')
const path = require('path')
const fs = require('fs')

let mainWindow;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 450,
    height: 350,
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
    // Set window level to stay above most other windows
    level: 'floating',
    // Allow window to be focusable so input fields work
    focusable: true,
    // Allow window to be resized
    resizable: true,
    // Set minimum window size to prevent layout issues
    minWidth: 300,
    minHeight: 200,
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
    
    // Force always-on-top after window is shown
    mainWindow.setAlwaysOnTop(true, 'screen-saver')
    
    // Ensure Windows-specific properties are set correctly
    if (process.platform === 'win32') {
      mainWindow.setSkipTaskbar(true)
      // Force a refresh of window properties to prevent ghost header
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          const bounds = mainWindow.getBounds()
          mainWindow.setBounds({ ...bounds, width: bounds.width + 1 })
          mainWindow.setBounds(bounds)
          // Re-enforce always-on-top after window manipulation
          mainWindow.setAlwaysOnTop(true, 'screen-saver')
        }
      }, 100)
    }
  })
  
  // Ensure window stays always on top
  mainWindow.on('focus', () => {
    // Re-enforce always-on-top when window gains focus
    mainWindow.setAlwaysOnTop(true, 'screen-saver')
  })
  
  mainWindow.on('blur', () => {
    // Keep it on top even when losing focus
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setAlwaysOnTop(true, 'screen-saver')
      }
    }, 100)
  })
  
  // Periodic check to ensure always-on-top (every 5 seconds)
  setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (!mainWindow.isAlwaysOnTop()) {
        console.log('🔧 Re-enforcing always-on-top')
        mainWindow.setAlwaysOnTop(true, 'screen-saver')
      }
    }
  }, 5000)
  
  // Open DevTools if in dev mode
  const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development'
  if (isDev) {
    mainWindow.webContents.openDevTools()
    console.log('🔧 Dev mode enabled - DevTools opened')
    console.log('🐛 Dev mode: Screenshots will be saved to debug_screenshots/ folder')
  }
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
    if (isAlwaysOnTop) {
      mainWindow.setAlwaysOnTop(false)
    } else {
      mainWindow.setAlwaysOnTop(true, 'screen-saver')
    }
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

// Screenshot capture functionality
ipcMain.handle('capture-screenshot', async () => {
  try {
    // Remember if window was visible before hiding
    const wasVisible = mainWindow && mainWindow.isVisible()
    
    // Hide the window temporarily to exclude it from screenshot
    if (mainWindow && wasVisible) {
      mainWindow.hide()
      // Wait a bit to ensure window is fully hidden
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    // Get all available sources (screens)
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 }
    })
    
    if (sources.length === 0) {
      throw new Error('No screen sources available')
    }
    
    // Use the first (primary) screen
    const primaryScreen = sources[0]
    
    // Convert the thumbnail to base64
    const screenshot = primaryScreen.thumbnail.toDataURL()
    
    // Remove the data:image/png;base64, prefix to get just the base64 data
    const base64Data = screenshot.replace(/^data:image\/png;base64,/, '')
    
    // Save screenshot to folder if in dev mode
    const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development'
    if (isDev) {
      try {
        const screenshotsDir = path.join(__dirname, 'debug_screenshots')
        
        // Create screenshots directory if it doesn't exist
        if (!fs.existsSync(screenshotsDir)) {
          fs.mkdirSync(screenshotsDir, { recursive: true })
        }
        
        // Create filename with timestamp
        const now = new Date()
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5) // Remove milliseconds and replace : with -
        const filename = `screenshot_${timestamp}.png`
        const filepath = path.join(screenshotsDir, filename)
        
        // Convert base64 to buffer and save
        const buffer = Buffer.from(base64Data, 'base64')
        fs.writeFileSync(filepath, buffer)
        
        console.log(`🐛 Dev mode: Screenshot saved to ${filepath}`)
      } catch (saveError) {
        console.error('Failed to save screenshot in dev mode:', saveError)
      }
    }
    
    // Show the window again if it was visible before
    if (mainWindow && wasVisible) {
      mainWindow.show()
      // Re-enforce always-on-top after showing
      mainWindow.setAlwaysOnTop(true, 'screen-saver')
    }
    
    return base64Data
  } catch (error) {
    console.error('Screenshot capture failed:', error)
    
    // Make sure to show the window again even if screenshot failed
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show()
      mainWindow.setAlwaysOnTop(true, 'screen-saver')
    }
    
    throw error
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