import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  net,
  protocol,
  session,
  shell,
  type SerialPort,
} from "electron";
import { existsSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const APP_SCHEME = "app";
const APP_HOST = "vox";
const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
const DEV_ORIGIN = "http://localhost:3000";
const isDevelopment = !app.isPackaged && process.env.ELECTRON_DEV === "1";
const allowedOrigin = isDevelopment ? DEV_ORIGIN : APP_ORIGIN;
const commonEspVendors = new Set(["4292", "6790", "1027"]);
let mainWindow: BrowserWindow | null = null;
let serialPorts: SerialPort[] = [];
let serialSelectionChanged = false;

app.setName("br.vox.app");
app.setPath("userData", join(app.getPath("appData"), "br.vox.app"));

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

const hasSingleInstance = app.requestSingleInstanceLock();
if (!hasSingleInstance) app.quit();

app.on("second-instance", () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

function manufacturerName(port: SerialPort) {
  switch (port.vendorId) {
    case "4292":
      return "Silicon Labs (CP210x)";
    case "6790":
      return "CH340";
    case "1027":
      return "FTDI";
    default:
      return port.vendorId ? `Fabricante ${port.vendorId}` : "Fabricante desconhecido";
  }
}

function portLabel(port: SerialPort) {
  const name = port.portName || port.displayName || "Porta serial";
  return `${name} — ${manufacturerName(port)}`;
}

function preferredPorts(ports: SerialPort[]) {
  const preferred = ports.filter((port) => commonEspVendors.has(port.vendorId ?? ""));
  return preferred.length ? preferred : ports;
}

async function chooseSerialPort(ports: SerialPort[]): Promise<string> {
  if (ports.length === 1) return ports[0]?.portId ?? "";
  const candidates = preferredPorts(ports);
  if (candidates.length === 1) return candidates[0]?.portId ?? "";
  if (!candidates.length || !mainWindow || mainWindow.isDestroyed()) return "";

  const labels = candidates.map(portLabel);
  const cancelIndex = labels.length;
  serialSelectionChanged = false;
  const result = await dialog.showMessageBox(mainWindow, {
    type: "question",
    title: "Escolher porta serial",
    message: "Selecione a porta conectada ao ESP32.",
    buttons: [...labels, "Cancelar"],
    defaultId: 0,
    cancelId: cancelIndex,
    noLink: true,
  });
  if (serialSelectionChanged) {
    serialSelectionChanged = false;
    return serialPorts.length ? chooseSerialPort(serialPorts) : "";
  }
  if (result.response === cancelIndex) return "";

  const selected = candidates[result.response];
  if (!selected) return "";
  if (serialPorts.some((port) => port.portId === selected.portId)) {
    return selected.portId;
  }
  return serialPorts.length ? chooseSerialPort(serialPorts) : "";
}

function configureSerialPermissions() {
  const appSession = session.defaultSession;
  appSession.on("will-download", (_event, item) => {
    if (item.getInitiatorOrigin() !== allowedOrigin) return;
    const filename = item.getFilename();
    const extension = filename.toLowerCase().endsWith(".csv") ? "csv" : "json";
    item.setSaveDialogOptions({
      title: "Salvar arquivo do VOX",
      defaultPath: filename,
      filters: [{ name: extension === "csv" ? "Planilha CSV" : "Backup JSON", extensions: [extension] }],
    });
  });
  appSession.setPermissionCheckHandler((_contents, permission, requestingOrigin) =>
    permission === "serial" && requestingOrigin === allowedOrigin,
  );
  appSession.setDevicePermissionHandler(({ deviceType, origin }) =>
    deviceType === "serial" && origin === allowedOrigin,
  );
  appSession.on("select-serial-port", (event, ports, _contents, callback) => {
    event.preventDefault();
    serialPorts = ports;
    if (!ports.length) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        void dialog.showMessageBox(mainWindow, {
          type: "warning",
          title: "Nenhuma porta serial encontrada",
          message: "Conecte o ESP32 e tente novamente.",
          buttons: ["OK"],
        });
      }
      callback("");
      return;
    }
    void chooseSerialPort(ports).then(callback).catch(() => callback(""));
  });
  appSession.on("serial-port-added", (_event, port) => {
    serialSelectionChanged = true;
    serialPorts = [
      ...serialPorts.filter((item) => item.portId !== port.portId),
      port,
    ];
  });
  appSession.on("serial-port-removed", (_event, port) => {
    serialSelectionChanged = true;
    serialPorts = serialPorts.filter((item) => item.portId !== port.portId);
  });
}

async function serveAppProtocol() {
  const exportRoot = resolve(app.getAppPath(), "out");
  await protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url);
    if (url.hostname !== APP_HOST) return new Response("Not found", { status: 404 });

    let pathname: string;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return new Response("Bad request", { status: 400 });
    }
    const filePath = resolve(exportRoot, `.${pathname}`);
    if (filePath !== exportRoot && !filePath.startsWith(`${exportRoot}${sep}`)) {
      return new Response("Forbidden", { status: 403 });
    }

    const target = existsSync(filePath) && statSync(filePath).isDirectory()
      ? join(filePath, "index.html")
      : filePath;
    if (!existsSync(target)) return new Response("Not found", { status: 404 });
    return net.fetch(pathToFileURL(target).toString());
  });
}

function configureContentSecurityPolicy() {
  if (isDevelopment) return;
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
        ],
      },
    });
  });
}

function createWindow() {
  const iconPath = isDevelopment
    ? join(app.getAppPath(), "build", "vox.ico")
    : join(app.getAppPath(), "runtime", "vox.ico");
  mainWindow = new BrowserWindow({
    title: "VOX",
    width: 1280,
    height: 800,
    minWidth: 360,
    minHeight: 600,
    backgroundColor: "#081321",
    autoHideMenuBar: true,
    ...(existsSync(iconPath) ? { icon: iconPath } : {}),
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.setMenu(null);

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown" && input.key === "F11") {
      event.preventDefault();
      mainWindow?.setFullScreen(!mainWindow.isFullScreen());
    }
  });
  mainWindow.webContents.on("will-navigate", (event, navigationUrl) => {
    if (new URL(navigationUrl).origin === allowedOrigin) return;
    event.preventDefault();
    void shell.openExternal(navigationUrl);
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (new URL(url).origin !== allowedOrigin) void shell.openExternal(url);
    return { action: "deny" };
  });
  if (!isDevelopment) {
    mainWindow.webContents.on("devtools-opened", () => {
      mainWindow?.webContents.closeDevTools();
    });
  }

  void mainWindow.loadURL(isDevelopment ? DEV_ORIGIN : APP_ORIGIN);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

if (hasSingleInstance) {
  Menu.setApplicationMenu(null);
  app.whenReady().then(async () => {
    if (!isDevelopment) await serveAppProtocol();
    configureSerialPermissions();
    configureContentSecurityPolicy();
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
