import { shell as c, app as d, BrowserWindow as P, ipcMain as $ } from "electron";
import { fileURLToPath as O } from "node:url";
import r from "node:path";
import a from "node:fs";
import _ from "node:os";
function h(n) {
  if (!n) return null;
  let e = n.replace(/\\/g, "/");
  const o = _.homedir().replace(/\\/g, "/"), t = _.userInfo().username;
  e = e.replace(/C:\/Users\/USERNAME/gi, `C:/Users/${t}`), (e.startsWith("~/") || e === "~") && (e = e.replace(/^~(?=\/|$)/, o));
  const i = e.toLowerCase();
  return i === "downloads" ? e = r.join(o, "Downloads") : i === "documents" || i === "docs" ? e = r.join(o, "Documents") : i === "desktop" && (e = r.join(o, "Desktop")), e;
}
function p(n, e) {
  if (!a.existsSync(n)) throw new Error(`Path does not exist: ${n}`);
  const o = a.statSync(n);
  if (e && !o.isDirectory())
    throw new Error(`Expected a folder but got a file: ${n}`);
  if (!e && !o.isFile())
    throw new Error(`Expected a file but got a folder: ${n}`);
  return o;
}
async function T(n) {
  const e = h(n);
  if (!e) throw new Error("No folder path provided.");
  p(e, !0);
  const o = await c.openPath(e);
  if (o) throw new Error(o);
  return { ok: !0, message: `Opened folder: ${e}` };
}
function U(n) {
  const e = (n ?? "").toLowerCase();
  return e.includes("pdf") ? [".pdf"] : e.includes("docx") || e.includes("word") || e.includes("doc") ? [".docx", ".doc"] : e.includes("ppt") || e.includes("powerpoint") ? [".pptx", ".ppt"] : e.includes("xls") || e.includes("excel") ? [".xlsx", ".xls"] : e.includes("image") || e.includes("photo") || e.includes("picture") || e.includes("jpg") || e.includes("jpeg") || e.includes("png") ? [".png", ".jpg", ".jpeg", ".gif", ".webp"] : e.includes("video") || e.includes("mp4") || e.includes("mkv") ? [".mp4", ".mkv", ".mov", ".avi"] : [".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".docx", ".doc"];
}
async function D(n, e, o) {
  const t = h(n);
  if (!t) throw new Error("No file path provided.");
  const i = a.existsSync(t) ? a.statSync(t) : null;
  if (i && i.isDirectory()) {
    const E = a.readdirSync(t), u = e || o || "", g = U(u), x = E.find((l) => {
      const C = l.toLowerCase();
      return g.includes(r.extname(l).toLowerCase()) && u && C.includes(u.toLowerCase());
    }), k = x || E.find((l) => g.includes(r.extname(l).toLowerCase())), v = x || k;
    if (!v) throw new Error(`Folder has no matching files to open: ${t}`);
    const f = r.join(t, v);
    p(f, !1);
    const y = await c.openPath(f);
    if (y) throw new Error(y);
    return { ok: !0, message: `Opened file: ${f}` };
  }
  p(t, !1);
  const m = await c.openPath(t);
  if (m) throw new Error(m);
  return { ok: !0, message: `Opened file: ${t}` };
}
async function S(n) {
  const e = h(n);
  if (!e) throw new Error("No media path provided.");
  p(e, !1);
  const o = await c.openPath(e);
  if (o) throw new Error(o);
  return { ok: !0, message: `Playing media: ${e}` };
}
function b(n) {
  if (!n) return null;
  switch (n.toLowerCase()) {
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
async function A(n) {
  const e = b(n);
  if (!e) throw new Error(`App is not in whitelist: ${n ?? "unknown"}`);
  return await c.openExternal(e), { ok: !0, message: `Launched app: ${e}` };
}
async function I(n) {
  try {
    switch (n.action) {
      case "open_folder":
        return await T(n.payload.path);
      case "open_file":
        const e = "fileName" in n.payload ? n.payload.fileName : void 0;
        return await D(n.payload.path, e, n.originalText);
      case "play_media":
        return await S(n.payload.mediaPath ?? n.payload.path);
      case "launch_app":
        return await A(n.payload.appName);
      default:
        throw new Error(`Unsupported action: ${n.action}`);
    }
  } catch (e) {
    return { ok: !1, message: e instanceof Error ? e.message : "Unknown execution error" };
  }
}
const j = r.dirname(O(import.meta.url));
process.env.APP_ROOT = r.join(j, "..");
const w = process.env.VITE_DEV_SERVER_URL, z = r.join(process.env.APP_ROOT, "dist-electron"), R = r.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = w ? r.join(process.env.APP_ROOT, "public") : R;
let s;
function L() {
  s = new P({
    icon: r.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: r.join(j, "preload.mjs")
    }
  }), s.webContents.on("did-finish-load", () => {
    s == null || s.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), w ? s.loadURL(w) : s.loadFile(r.join(R, "index.html"));
}
d.on("window-all-closed", () => {
  process.platform !== "darwin" && (d.quit(), s = null);
});
d.on("activate", () => {
  P.getAllWindows().length === 0 && L();
});
d.whenReady().then(L);
$.handle("deskagent/run-command", async (n, e) => (console.log("Received validated command from renderer:", e), await I(e)));
export {
  z as MAIN_DIST,
  R as RENDERER_DIST,
  w as VITE_DEV_SERVER_URL
};
