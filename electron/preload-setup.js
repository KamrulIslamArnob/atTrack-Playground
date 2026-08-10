// Bridge for setup.html only — hands the typed (or empty, if skipped) Gemini key back
// to the main process via IPC. Not used by the main app window at all.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("attrackSetup", {
  submit: (geminiApiKey) => ipcRenderer.send("setup:submit", geminiApiKey),
});
