// Electron shell around the static web export (nix/web.nix).
const {
  app,
  BrowserWindow,
  net,
  protocol,
  session,
  shell,
} = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const webRoot = path.resolve(process.env.MOVA_WEB_ROOT);
const appOrigin = "app://mova";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);

async function isFile(file) {
  try {
    return (await fs.stat(file)).isFile();
  } catch {
    return false;
  }
}

// Mirror static-host routing: exact file, then "<route>.html", then
// "<route>/index.html", falling back to the root page for the client router.
async function resolveFile(pathname) {
  const base = path.join(webRoot, decodeURIComponent(pathname));
  if (base.startsWith(`${webRoot}${path.sep}`)) {
    for (const candidate of [
      base,
      `${base}.html`,
      path.join(base, "index.html"),
    ]) {
      if (await isFile(candidate)) return candidate;
    }
  }
  return path.join(webRoot, "index.html");
}

// The API is on another origin. Answer CORS for it here so any server works,
// including ones whose wildcard Allow-Headers doesn't cover Authorization.
function allowCrossOrigin() {
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ["http://*/*", "https://*/*"] },
    (details, callback) => {
      const responseHeaders = Object.fromEntries(
        Object.entries(details.responseHeaders ?? {}).filter(
          ([name]) => !name.toLowerCase().startsWith("access-control-"),
        ),
      );
      responseHeaders["Access-Control-Allow-Origin"] = [appOrigin];
      responseHeaders["Access-Control-Allow-Headers"] = [
        "Authorization, Content-Type, Cache-Control, Pragma",
      ];
      responseHeaders["Access-Control-Allow-Methods"] = [
        "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      ];
      const preflight = details.method === "OPTIONS";
      callback({
        responseHeaders,
        ...(preflight ? { statusLine: "HTTP/1.1 204 No Content" } : {}),
      });
    },
  );
}

function openExternally(url) {
  if (/^(https?|mailto):/.test(url)) shell.openExternal(url);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 850,
    title: "Mova",
    backgroundColor: "#FDF6E3",
    autoHideMenuBar: true,
    icon: process.env.MOVA_ICON,
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternally(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`${appOrigin}/`)) {
      event.preventDefault();
      openExternally(url);
    }
  });
  win.loadURL(`${appOrigin}/`);
  return win;
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let mainWindow;
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.whenReady().then(() => {
    protocol.handle("app", async (request) => {
      const file = await resolveFile(new URL(request.url).pathname);
      return net.fetch(pathToFileURL(file).toString());
    });
    allowCrossOrigin();
    mainWindow = createWindow();
  });
  app.on("window-all-closed", () => app.quit());
}
