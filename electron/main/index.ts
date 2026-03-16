import { app, BrowserWindow } from "electron"
import path from "path"

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // In dev, always load the Vite dev server.
  // The renderer dev server is configured to run on port 5173.
  if (process.env.NODE_ENV === "development") {
    win.loadURL("http://localhost:5173")
  } else {
    // In production, load the built renderer HTML.
    win.loadFile(path.join(__dirname, "../renderer/index.html"))
  }
}

app.whenReady().then(() => {
  app.on("web-contents-created", (_event, contents) => {
    contents.session.setPermissionRequestHandler((_wc, permission, callback) => {
      if (permission === "media") callback(true)
      else callback(false)
    })
  })

  createWindow()
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})