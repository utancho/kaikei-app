const { contextBridge } = require("electron");
// UI mode only. No filesystem, credentials or privileged operations exposed.
contextBridge.exposeInMainWorld("keirioDesktop", Object.freeze({ isDesktop: true, platform: process.platform }));
