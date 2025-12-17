import "./electron.d.ts";

export function isElectron(): boolean {
  return typeof window !== "undefined" && !!window.electronAPI?.isElectron;
}

export function getElectronAPI() {
  if (!isElectron()) {
    throw new Error("Electron API not available");
  }
  return window.electronAPI!;
}
