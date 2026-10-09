const { app, BrowserWindow, shell } = require("electron");
const path = require("path");

const APP_URL = "https://keirio-hub.com";
const APP_ORIGIN = new URL(APP_URL).origin;

function isAppUrl(url) {
  try {
    const target = new URL(url);
    return target.origin === APP_ORIGIN && !target.pathname.startsWith("/blog") && !target.pathname.startsWith("/legal");
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
    title: "keirio",
    titleBarStyle: "hidden",
    titleBarOverlay: { color: "#ffffff", symbolColor: "#27533d", height: 40 },
    icon: path.join(__dirname, "build", "icon.png"),
    backgroundColor: "#f9fafb",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.setMenuBarVisibility(false);
  const offline = () => win.loadFile(path.join(__dirname, "offline.html"));
  win.webContents.on("did-fail-load", (_event, code, _description, url, isMainFrame) => {
    if (isMainFrame && code !== -3 && isAppUrl(url)) offline();
  });
  win.loadURL(APP_URL + "/app").catch(() => { /* did-fail-load renders the local recovery screen */ });

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
