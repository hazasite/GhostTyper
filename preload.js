const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ghostAPI', {
    addShortcut: (shortcut) => ipcRenderer.invoke('add-shortcut', shortcut),
    deleteShortcut: (trigger) => ipcRenderer.invoke('delete-shortcut', trigger),
    updateShortcut: (oldTrigger, newData) => ipcRenderer.invoke('update-shortcut', oldTrigger, newData),
    getShortcuts: () => ipcRenderer.invoke('get-shortcuts'),
    getStats: () => ipcRenderer.invoke('get-stats'),
    getSettings: () => ipcRenderer.invoke('get-settings'),
    updateSettings: (settings) => ipcRenderer.invoke('update-settings', settings),
    onShortcutsUpdated: (callback) => ipcRenderer.on('shortcuts-updated', (event, shortcuts) => callback(shortcuts)),
    onStatsUpdated: (callback) => ipcRenderer.on('stats-updated', (event, stats) => callback(stats)),
    onPlaySound: (callback) => ipcRenderer.on('play-sound', (event) => callback()),
    pasteShortcut: (shortcut) => ipcRenderer.invoke('paste-shortcut', shortcut),
    closeSearch: () => ipcRenderer.invoke('close-search'),
    openExternal: (url) => ipcRenderer.send('open-external', url)
});
