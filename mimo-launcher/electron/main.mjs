import { app, BrowserWindow, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "../server/index.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let mainWindow = null;
let httpServer = null;
let serverPort = 3847;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

async function createWindow() {
  const { server, port, alreadyRunning } = await startServer(3847);
  if (!alreadyRunning) {
    httpServer = server;
  }
  serverPort = port;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: "MiMo Code — Панель управления",
    backgroundColor: "#0a0a0f",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}`);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow).catch((err) => {
  console.error(err);
  app.quit();
});

app.on("window-all-closed", () => {
  if (httpServer) {
    httpServer.close();
    httpServer = null;
  }
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});
