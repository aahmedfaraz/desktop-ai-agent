import { shell } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { DeskAgentCommand } from '../shared/commandSchema';

interface ExecutionResult {
  ok: boolean;
  message: string;
}

function resolveUserPath(rawPath?: string): string | null {
  if (!rawPath) return null;

  let resolved = rawPath.replace(/\\/g, '/');

  const homeDir = os.homedir().replace(/\\/g, '/');
  const username = os.userInfo().username;

  // Replace placeholder USERNAME with real username if present
  resolved = resolved.replace(/C:\/Users\/USERNAME/gi, `C:/Users/${username}`);

  // Expand tilde to home directory
  if (resolved.startsWith('~/') || resolved === '~') {
    resolved = resolved.replace(/^~(?=\/|$)/, homeDir);
  }

  // If it's a known special folder keyword, map relative to home
  const lower = resolved.toLowerCase();
  if (lower === 'downloads') {
    resolved = path.join(homeDir, 'Downloads');
  } else if (lower === 'documents' || lower === 'docs') {
    resolved = path.join(homeDir, 'Documents');
  } else if (lower === 'desktop') {
    resolved = path.join(homeDir, 'Desktop');
  }

  return resolved;
}

function ensurePathExists(targetPath: string, expectDirectory: boolean): fs.Stats {
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

async function handleOpenFolder(payloadPath?: string): Promise<ExecutionResult> {
  const target = resolveUserPath(payloadPath);
  if (!target) {
    throw new Error('No folder path provided.');
  }

  ensurePathExists(target, true);

  const result = await shell.openPath(target);
  if (result) {
    // Electron returns a non-empty string on error
    throw new Error(result);
  }

  return { ok: true, message: `Opened folder: ${target}` };
}

async function handleOpenFile(payloadPath?: string): Promise<ExecutionResult> {
  const target = resolveUserPath(payloadPath);
  if (!target) {
    throw new Error('No file path provided.');
  }

  const stat = fs.existsSync(target) ? fs.statSync(target) : null;

  if (stat && stat.isDirectory()) {
    // Heuristic: if a folder was provided where a file was expected,
    // try to open the first image file inside that folder.
    const entries = fs.readdirSync(target);
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    const imageFile = entries.find((entry) =>
      imageExtensions.includes(path.extname(entry).toLowerCase()),
    );

    if (!imageFile) {
      throw new Error(`Folder has no image files to open: ${target}`);
    }

    const imagePath = path.join(target, imageFile);
    ensurePathExists(imagePath, false);

    const result = await shell.openPath(imagePath);
    if (result) {
      throw new Error(result);
    }

    return { ok: true, message: `Opened image file: ${imagePath}` };
  }

  ensurePathExists(target, false);

  const result = await shell.openPath(target);
  if (result) {
    throw new Error(result);
  }

  return { ok: true, message: `Opened file: ${target}` };
}

async function handlePlayMedia(mediaPath?: string): Promise<ExecutionResult> {
  const target = resolveUserPath(mediaPath);
  if (!target) {
    throw new Error('No media path provided.');
  }

  ensurePathExists(target, false);

  const result = await shell.openPath(target);
  if (result) {
    throw new Error(result);
  }

  return { ok: true, message: `Playing media: ${target}` };
}

function resolveWhitelistedApp(appName?: string): string | null {
  if (!appName) return null;

  const normalized = appName.toLowerCase();

  // Minimal, explicit whitelist for demo purposes.
  switch (normalized) {
    case 'vscode':
    case 'code':
      return 'code'; // assumes VS Code is on PATH
    case 'chrome':
    case 'google chrome':
      return 'chrome'; // assumes Chrome is on PATH
    default:
      return null;
  }
}

async function handleLaunchApp(appName?: string): Promise<ExecutionResult> {
  const command = resolveWhitelistedApp(appName);
  if (!command) {
    throw new Error(`App is not in whitelist: ${appName ?? 'unknown'}`);
  }

  // Use shell.openExternal for simplicity and safety.
  // This assumes protocol handlers or PATH-based resolution.
  await shell.openExternal(command);

  return { ok: true, message: `Launched app: ${command}` };
}

export async function executeCommand(command: DeskAgentCommand): Promise<ExecutionResult> {
  try {
    switch (command.action) {
      case 'open_folder':
        return await handleOpenFolder(command.payload.path);
      case 'open_file':
        return await handleOpenFile(command.payload.path);
      case 'play_media':
        return await handlePlayMedia(command.payload.mediaPath ?? command.payload.path);
      case 'launch_app':
        return await handleLaunchApp(command.payload.appName);
      default:
        throw new Error(`Unsupported action: ${command.action}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown execution error';
    return { ok: false, message };
  }
}

