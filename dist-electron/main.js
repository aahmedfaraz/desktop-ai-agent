import { shell, app, BrowserWindow, ipcMain } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
function resolveUserPath(rawPath) {
  if (!rawPath) return null;
  let resolved = rawPath.replace(/\\/g, "/");
  const homeDir = os.homedir().replace(/\\/g, "/");
  const username = os.userInfo().username;
  resolved = resolved.replace(/C:\/Users\/USERNAME/gi, `C:/Users/${username}`);
  if (resolved.startsWith("~/") || resolved === "~") {
    resolved = resolved.replace(/^~(?=\/|$)/, homeDir);
  }
  const lower = resolved.toLowerCase();
  if (lower === "downloads") {
    resolved = path.join(homeDir, "Downloads");
  } else if (lower === "documents" || lower === "docs") {
    resolved = path.join(homeDir, "Documents");
  } else if (lower === "desktop") {
    resolved = path.join(homeDir, "Desktop");
  }
  return resolved;
}
function ensurePathExists(targetPath, expectDirectory) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Path does not exist: ${targetPath}`);
  }
  const stat = fs.statSync(targetPath);
  if (expectDirectory && !stat.isDirectory()) {
    throw new Error(`Expected a folder but got a file: ${targetPath}`);
  }
  if (!expectDirectory && !stat.isFile()) {
    throw new Error(`Expected a file but got a folder: ${targetPath}`);
  }
  return stat;
}
async function handleOpenFolder(payloadPath) {
  const target = resolveUserPath(payloadPath);
  if (!target) {
    throw new Error("No folder path provided.");
  }
  ensurePathExists(target, true);
  const result = await shell.openPath(target);
  if (result) {
    throw new Error(result);
  }
  return { ok: true, message: `Opened folder: ${target}` };
}
function pickPreferredExtensions(hint) {
  const lowerHint = (hint ?? "").toLowerCase();
  if (lowerHint.includes("pdf")) return [".pdf"];
  if (lowerHint.includes("docx") || lowerHint.includes("word") || lowerHint.includes("doc"))
    return [".docx", ".doc"];
  if (lowerHint.includes("ppt") || lowerHint.includes("powerpoint"))
    return [".pptx", ".ppt"];
  if (lowerHint.includes("xls") || lowerHint.includes("excel"))
    return [".xlsx", ".xls"];
  if (lowerHint.includes("image") || lowerHint.includes("photo") || lowerHint.includes("picture") || lowerHint.includes("jpg") || lowerHint.includes("jpeg") || lowerHint.includes("png"))
    return [".png", ".jpg", ".jpeg", ".gif", ".webp"];
  if (lowerHint.includes("video") || lowerHint.includes("mp4") || lowerHint.includes("mkv"))
    return [".mp4", ".mkv", ".mov", ".avi"];
  return [".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".docx", ".doc"];
}
async function handleOpenFile(payloadPath, fileNameHint, originalText) {
  const target = resolveUserPath(payloadPath);
  if (!target) {
    throw new Error("No file path provided.");
  }
  const stat = fs.existsSync(target) ? fs.statSync(target) : null;
  if (stat && stat.isDirectory()) {
    const entries = fs.readdirSync(target);
    const nameHint = fileNameHint || originalText || "";
    const preferredExts = pickPreferredExtensions(nameHint);
    const byName = entries.find((entry) => {
      const lowerEntry = entry.toLowerCase();
      const hasExt = preferredExts.includes(path.extname(entry).toLowerCase());
      return hasExt && nameHint && lowerEntry.includes(nameHint.toLowerCase());
    });
    const byExt = byName || entries.find(
      (entry) => preferredExts.includes(path.extname(entry).toLowerCase())
    );
    const chosen = byName || byExt;
    if (!chosen) {
      throw new Error(`Folder has no matching files to open: ${target}`);
    }
    const filePath = path.join(target, chosen);
    ensurePathExists(filePath, false);
    const result2 = await shell.openPath(filePath);
    if (result2) {
      throw new Error(result2);
    }
    return { ok: true, message: `Opened file: ${filePath}` };
  }
  ensurePathExists(target, false);
  const result = await shell.openPath(target);
  if (result) {
    throw new Error(result);
  }
  return { ok: true, message: `Opened file: ${target}` };
}
async function handlePlayMedia(mediaPath) {
  const target = resolveUserPath(mediaPath);
  if (!target) {
    throw new Error("No media path provided.");
  }
  ensurePathExists(target, false);
  const result = await shell.openPath(target);
  if (result) {
    throw new Error(result);
  }
  return { ok: true, message: `Playing media: ${target}` };
}
function resolveWhitelistedApp(appName) {
  if (!appName) return null;
  const normalized = appName.toLowerCase();
  switch (normalized) {
    case "vscode":
    case "code":
      return "code";
    case "chrome":
    case "google chrome":
      return "chrome";
    default:
      return null;
  }
}
async function handleLaunchApp(appName) {
  const command = resolveWhitelistedApp(appName);
  if (!command) {
    throw new Error(`App is not in whitelist: ${appName ?? "unknown"}`);
  }
  await shell.openExternal(command);
  return { ok: true, message: `Launched app: ${command}` };
}
async function executeCommand(command) {
  try {
    switch (command.action) {
      case "open_folder":
        return await handleOpenFolder(command.payload.path);
      case "open_file":
        return await handleOpenFile(
          command.payload.path,
          // @ts-expect-error fileName is allowed but not required on payload
          command.payload.fileName,
          command.originalText
        );
      case "play_media":
        return await handlePlayMedia(command.payload.mediaPath ?? command.payload.path);
      case "launch_app":
        return await handleLaunchApp(command.payload.appName);
      default:
        throw new Error(`Unsupported action: ${command.action}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown execution error";
    return { ok: false, message };
  }
}
createRequire(import.meta.url);
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs")
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(createWindow);
ipcMain.handle("deskagent/run-command", async (_event, command) => {
  console.log("Received validated command from renderer:", command);
  const result = await executeCommand(command);
  return result;
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
