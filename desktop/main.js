const { app, BrowserWindow, shell } = require("electron");
const path = require("path");

const APP_URL = "https://keirio-hub.com";
const APP_ORIGIN = new URL(APP_URL).origin;

function isAppUrl(url) {
  try {
    return new URL(url).origin === APP_ORIGIN;
  } catch {
    return false;
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 600,
    title: "Kaikei",
    backgroundColor: "#f9fafb",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.setMenuBarVisibility(false);
  win.loadURL(APP_URL);

  // 外部リンク(Stripeなど)はOSのデフォルトブラウザで開く。
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!isAppUrl(url)) {
      if (url.startsWith("https://") || url.startsWith("http://")) {
        shell.openExternal(url);
      }
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  // 同じウィンドウを外部サイトへ遷移させない。
  win.webContents.on("will-navigate", (event, url) => {
    if (!isAppUrl(url)) {
      event.preventDefault();
      if (url.startsWith("https://") || url.startsWith("http://")) {
        shell.openExternal(url);
      }
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
