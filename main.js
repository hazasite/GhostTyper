const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  nativeImage,
  dialog,
  globalShortcut,
  clipboard,
  shell,
} = require("electron");
const robot = require("@jitsi/robotjs");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const { uIOhook, UiohookKey } = require("uiohook-napi");
const { spawn, execSync } = require("child_process");

// Store setup
let store;
let cachedShortcuts = [];
let cachedSettings = {};

async function initStore() {
  const { default: Store } = await import("electron-store");
  store = new Store({
    defaults: {
      shortcuts: [],
      stats: {
        expansions: 0,
        charsSaved: 0,
      },
        settings: {
        startWithWindows: false,
        startMinimized: false,
        playSound: true,
        caseSensitive: false,
        useCustomAI: false,
        apiEndpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: '',
        apiModel: 'gpt-3.5-turbo'
      },
    },
  });
  
  // Initialize cache
  cachedShortcuts = store.get("shortcuts") || [];
  cachedSettings = store.get("settings") || {};
}

let mainWindow;
let searchWindow;

let tray;
// --- PowerShell Input Simulation ---
function sendKeys(keys) {
  try {
    // 1. Replace newlines with {ENTER} for SendKeys compatibility
    const finalKeys = keys.replace(/\r?\n/g, "{ENTER}");
    
    // 2. Escape single quotes for the PowerShell string literal
    // Note: We do NOT escape { } etc. here because they are already control codes
    const safeKeys = finalKeys.replace(/'/g, "''");
    
    // 3. Construct the script with progress silencing
    // [void] prevents the assembly load from outputting anything
    const psScript = `$ProgressPreference = 'SilentlyContinue'; [void][System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); [System.Windows.Forms.SendKeys]::SendWait('${safeKeys}')`;
    const encodedScript = Buffer.from(psScript, 'utf16le').toString('base64');
    
    const cmd = `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand ${encodedScript}`;
    execSync(cmd, { windowsHide: true, stdio: 'ignore' });
  } catch (err) {
    // Silent fail
  }
}

function escapeForSendKeys(text) {
  // SendKeys special chars: + ^ % ~ ( ) { } [ ]
  return text.replace(/([+\^%~(){}[\]])/g, "{$1}");
}

// --- Key Mapping ---
const keyMap = {
  [UiohookKey.Code0]: "0",
  [UiohookKey.Code1]: "1",
  [UiohookKey.Code2]: "2",
  [UiohookKey.Code3]: "3",
  [UiohookKey.Code4]: "4",
  [UiohookKey.Code5]: "5",
  [UiohookKey.Code6]: "6",
  [UiohookKey.Code7]: "7",
  [UiohookKey.Code8]: "8",
  [UiohookKey.Code9]: "9",
  [UiohookKey.A]: "a",
  [UiohookKey.B]: "b",
  [UiohookKey.C]: "c",
  [UiohookKey.D]: "d",
  [UiohookKey.E]: "e",
  [UiohookKey.F]: "f",
  [UiohookKey.G]: "g",
  [UiohookKey.H]: "h",
  [UiohookKey.I]: "i",
  [UiohookKey.J]: "j",
  [UiohookKey.K]: "k",
  [UiohookKey.L]: "l",
  [UiohookKey.M]: "m",
  [UiohookKey.N]: "n",
  [UiohookKey.O]: "o",
  [UiohookKey.P]: "p",
  [UiohookKey.Q]: "q",
  [UiohookKey.R]: "r",
  [UiohookKey.S]: "s",
  [UiohookKey.T]: "t",
  [UiohookKey.U]: "u",
  [UiohookKey.V]: "v",
  [UiohookKey.W]: "w",
  [UiohookKey.X]: "x",
  [UiohookKey.Y]: "y",
  [UiohookKey.Z]: "z",
  [UiohookKey.Semicolon]: ";",
  [UiohookKey.Space]: " ",
  [UiohookKey.Minus]: "-",
  [UiohookKey.Equal]: "=",
  [UiohookKey.BracketLeft]: "[",
  [UiohookKey.BracketRight]: "]",
  [UiohookKey.Backslash]: "\\",
  [UiohookKey.Quote]: "'",
  [UiohookKey.Comma]: ",",
  [UiohookKey.Period]: ".",
  [UiohookKey.Slash]: "/",
  [UiohookKey.Backcheck]: "`",
};
// Note: This map handles unshifted keys. For a simple ";mail" detector, likely fine.

// --- Helper for Dynamic Variables ---
function getFormattedDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}





function getFormattedTime() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}



// --- Buffer & Detection ---
let inputBuffer = [];
const MAX_BUFFER = 50;

uIOhook.on("keydown", (e) => {
  if (!store) return; // Basic safety

  // Ignore shortcuts if Ghost Typer itself is focused
  if (BrowserWindow.getFocusedWindow()) {
    inputBuffer = []; // Clear buffer to prevent accidental triggers after switching away
    return;
  }

  if (e.keycode === UiohookKey.Backspace) {
    inputBuffer.pop();
    return;
  }

  const char = keyMap[e.keycode];
  if (char) {
    inputBuffer.push(char);
    if (inputBuffer.length > MAX_BUFFER) {
      inputBuffer.shift(); // Keep last N
    }
    checkShortcuts();
  }
});





function checkShortcuts() {
  const textInfo = inputBuffer.join("");
  const lowerText = textInfo.toLowerCase();

  // Check for dynamic built-in variables first
  if (lowerText.endsWith(";date")) {
    performExpansion({ trigger: ";date", expansion: getFormattedDate() });
    return;
  }
  if (lowerText.endsWith(";time")) {
    performExpansion({ trigger: ";time", expansion: getFormattedTime() });
    return;
  }
  if (lowerText.endsWith(";now")) {
    performExpansion({ trigger: ";now", expansion: `Today is ${getFormattedDate()} and time is ${getFormattedTime()}` });
    return;
  }
  if (lowerText.endsWith(";lorem")) {
    performExpansion({ 
      trigger: ";lorem", 
      expansion: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum." 
    });
    return;
  }

  // Communication shortcuts
  if (lowerText.endsWith(";do")) {
    performExpansion({ trigger: ";do", expansion: "How are you doing?" });
    return;
  }
  if (lowerText.endsWith(";gm")) {
    performExpansion({ trigger: ";gm", expansion: "Good Morning!" });
    return;
  }
  if (lowerText.endsWith(";gn")) {
    performExpansion({ trigger: ";gn", expansion: "Good Night!" });
    return;
  }
  if (lowerText.endsWith(";tnx")) {
    performExpansion({ trigger: ";tnx", expansion: "Thank you very much!" });
    return;
  }
  if (lowerText.endsWith(";br")) {
    performExpansion({ trigger: ";br", expansion: "Best Regards," });
    return;
  }
  if (lowerText.endsWith(";asap")) {
    performExpansion({ trigger: ";asap", expansion: "As soon as possible" });
    return;
  }
  if (lowerText.endsWith(";omg")) {
    performExpansion({ trigger: ";omg", expansion: "Oh My GOD!" });
    return;
  }











  for (const s of cachedShortcuts) {
    const isMatch = cachedSettings.caseSensitive
      ? textInfo.endsWith(s.trigger)
      : textInfo.toLowerCase().endsWith(s.trigger.toLowerCase());

    if (isMatch) {
      performExpansion(s);
      break;
    }
  }
}

function performExpansion(shortcut) {
  // 1. Clear buffer to prevent re-triggering
  inputBuffer = [];

  // 2. Clear previous trigger with instant backspaces using RobotJS
  for (let i = 0; i < shortcut.trigger.length; i++) {
    robot.keyTap("backspace");
  }

  // 3. Add expansion text
  let expansion = shortcut.expansion;
  // Replace placeholders if any
  expansion = expansion.replace(/{date}/g, getFormattedDate());
  expansion = expansion.replace(/{time}/g, getFormattedTime());


  // 4. Update stats
  const currentStats = store.get("stats");
  const charsSavedThisTime = Math.max(
    0,
    shortcut.expansion.length - shortcut.trigger.length,
  );
  const newStats = {
    expansions: currentStats.expansions + 1,
    charsSaved: currentStats.charsSaved + charsSavedThisTime,
  };
  store.set("stats", newStats);

  // 5. Notify renderer about stats update
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send("stats-updated", newStats);
    
    // 6. Play sound if enabled
    const settings = store.get("settings");
    if (settings && settings.playSound) {
      mainWindow.webContents.send("play-sound");
    }
  }

  // 6. Send keys - SUPER FAST HYBRID METHOD
  // Wait a tiny bit for the UI to catch up with backspaces if needed, though usually not
  setTimeout(() => {
    // Save current clipboard to restore later (optional, but polite)
    const originalClipboard = clipboard.readText();
    
    // Put expansion into clipboard and paste it
    clipboard.writeText(expansion);
    
    // Trigger Ctrl+V
    robot.keyTap("v", process.platform === "darwin" ? "command" : "control");
    
    // Restore clipboard after a short delay so the paste has time to complete
    setTimeout(() => {
      clipboard.writeText(originalClipboard);
    }, 500);
  }, 10);
}

// --- App Lifecycle ---
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    show: false, // Wait until ready
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
    icon: path.join(__dirname, "assets/icon.ico"),
  });

  mainWindow.loadFile("index.html");

  // Force links to open in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.once("ready-to-show", () => {
    const settings = store.get("settings");
    if (settings && settings.startMinimized) {
      // Keep hidden
      console.log("Starting minimized to tray...");
    } else {
      mainWindow.show();
    }
  });

  // Minimize to tray
  mainWindow.on("close", (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
}

function createSearchWindow() {
  if (searchWindow) {
    searchWindow.show();
    return;
  }

  searchWindow = new BrowserWindow({
    width: 600,
    height: 500,
    frame: false,
    transparent: true,
    show: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  searchWindow.loadFile("search.html");

  // Force links to open in the default browser
  searchWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  searchWindow.on("blur", () => {
    searchWindow.hide();
  });
}

// Generate tray icon
function createTrayIcon() {
  const iconPath = path.join(__dirname, "assets/tray-icon.ico");
  const icon = nativeImage.createFromPath(iconPath);
  return icon.isEmpty()
    ? nativeImage.createFromDataURL(
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==",
      )
    : icon;
}

app.whenReady().then(async () => {
  await initStore();

  // Sync "Start with Windows" setting on startup
  const settings = store.get("settings");
  if (settings) {
    const options = {
      openAtLogin: settings.startWithWindows,
      path: app.getPath("exe"),
    };
    if (!app.isPackaged) {
      options.args = [path.resolve(app.getAppPath())];
    }
    app.setLoginItemSettings(options);
  }

  createWindow();

  tray = new Tray(createTrayIcon());
  const contextMenu = Menu.buildFromTemplate([
    { label: "Show Dashboard", click: () => mainWindow.show() },
    { label: "Check for Updates", click: () => checkForUpdatesManual() },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.isQuiting = true;
        uIOhook.stop();
        app.quit();
      },
    },
  ]);
  tray.setToolTip("Ghost Typer");
  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });

  // Start Hook
  uIOhook.start();

  // Register Global Shortcut for Spotlight Search
  globalShortcut.register("Control+Space", () => {
    if (!searchWindow) {
      createSearchWindow();
    }
    searchWindow.show();
  });

  // Auto Update Setup
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", () => {
    console.log("Update available.");
  });

  autoUpdater.on("update-downloaded", (info) => {
    dialog
      .showMessageBox({
        type: "info",
        title: "Update Ready",
        message:
          "A new version has been downloaded. Restart the application to apply the update?",
        buttons: ["Restart", "Later"],
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
  });

  autoUpdater.on("error", (err) => {
    console.error("Update error:", err);
  });

  // Check for updates every 2 hours
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 2 * 60 * 60 * 1000);

  // Initial check
  autoUpdater.checkForUpdatesAndNotify();
});

// Tray update check
function checkForUpdatesManual() {
  autoUpdater
    .checkForUpdatesAndNotify()
    .then((result) => {
      // If result is null or no update info, it might mean we are current
      // Note: checkForUpdatesAndNotify handles the update available case
    })
    .catch((err) => {
      dialog.showErrorBox(
        "Update Error",
        "Could not check for updates: " + err.message,
      );
    });
}

// IPC Handlers
ipcMain.handle("add-shortcut", (event, s) => {
  cachedShortcuts.push(s);
  store.set("shortcuts", cachedShortcuts);
  mainWindow.webContents.send("shortcuts-updated", cachedShortcuts);
  return cachedShortcuts;
});

ipcMain.handle("delete-shortcut", (event, trigger) => {
  cachedShortcuts = cachedShortcuts.filter((s) => s.trigger !== trigger);
  store.set("shortcuts", cachedShortcuts);
  mainWindow.webContents.send("shortcuts-updated", cachedShortcuts);
  return cachedShortcuts;
});

ipcMain.handle("update-shortcut", (event, oldTrigger, newData) => {
  const index = cachedShortcuts.findIndex((s) => s.trigger === oldTrigger);
  if (index !== -1) {
    cachedShortcuts[index] = newData;
    store.set("shortcuts", cachedShortcuts);
    mainWindow.webContents.send("shortcuts-updated", cachedShortcuts);
  }
  return cachedShortcuts;
});

ipcMain.handle("get-shortcuts", () => {
  return cachedShortcuts;
});

ipcMain.handle("get-stats", () => {
  return store.get("stats");
});

ipcMain.handle("get-settings", () => {
  return cachedSettings;
});

ipcMain.handle("update-settings", (event, newSettings) => {
  cachedSettings = newSettings;
  store.set("settings", cachedSettings);

  // Apply "Start with Windows"
  const options = {
    openAtLogin: cachedSettings.startWithWindows,
    path: app.getPath("exe"),
  };

  // If in development, we need to pass the app path as an argument
  if (!app.isPackaged) {
    options.args = [path.resolve(app.getAppPath())];
  }

  app.setLoginItemSettings(options);

  return cachedSettings;
});

ipcMain.handle("close-search", () => {
  if (searchWindow) searchWindow.hide();
});

ipcMain.handle("paste-shortcut", (event, shortcut) => {
  if (searchWindow) searchWindow.hide();
  
  // Give focus back to the previous app
  // Using a small delay to ensure focus has shifted
  setTimeout(() => {
    performExpansion(shortcut);
  }, 100);
});

ipcMain.on("open-external", (event, url) => {
  shell.openExternal(url);
});
