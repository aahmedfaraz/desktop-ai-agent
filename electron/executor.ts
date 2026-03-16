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

  resolved = resolved.replace(/C:\/Users\/USERNAME/gi, `C:/Users/${username}`);

  if (resolved.startsWith('~/') || resolved === '~') {
    resolved = resolved.replace(/^~(?=\/|$)/, homeDir);
  }

  const lower = resolved.toLowerCase();
  if (lower === 'downloads') resolved = path.join(homeDir, 'Downloads');
  else if (lower === 'documents' || lower === 'docs')
    resolved = path.join(homeDir, 'Documents');
  else if (lower === 'desktop') resolved = path.join(homeDir, 'Desktop');

  return resolved;
}

function ensurePathExists(targetPath: string, expectDirectory: boolean): fs.Stats {
  if (!fs.existsSync(targetPath)) throw new Error(`Path does not exist: ${targetPath}`);
  const stat = fs.statSync(targetPath);
  if (expectDirectory && !stat.isDirectory())
    throw new Error(`Expected a folder but got a file: ${targetPath}`);
  if (!expectDirectory && !stat.isFile())
    throw new Error(`Expected a file but got a folder: ${targetPath}`);
  return stat;
}

async function handleOpenFolder(payloadPath?: string): Promise<ExecutionResult> {
  const target = resolveUserPath(payloadPath);
  if (!target) throw new Error('No folder path provided.');

  ensurePathExists(target, true);

  const result = await shell.openPath(target);
  if (result) throw new Error(result);

  return { ok: true, message: `Opened folder: ${target}` };
}

function pickPreferredExtensions(hint: string | undefined): string[] {
  const lowerHint = (hint ?? '').toLowerCase();

  if (lowerHint.includes('pdf')) return ['.pdf'];
  if (lowerHint.includes('docx') || lowerHint.includes('word') || lowerHint.includes('doc'))
    return ['.docx', '.doc'];
  if (lowerHint.includes('ppt') || lowerHint.includes('powerpoint')) return ['.pptx', '.ppt'];
  if (lowerHint.includes('xls') || lowerHint.includes('excel')) return ['.xlsx', '.xls'];
  if (
    lowerHint.includes('image') ||
    lowerHint.includes('photo') ||
    lowerHint.includes('picture') ||
    lowerHint.includes('jpg') ||
    lowerHint.includes('jpeg') ||
    lowerHint.includes('png')
  )
    return ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
  if (lowerHint.includes('video') || lowerHint.includes('mp4') || lowerHint.includes('mkv'))
    return ['.mp4', '.mkv', '.mov', '.avi'];

  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.docx', '.doc'];
}

async function handleOpenFile(
  payloadPath?: string,
  fileNameHint?: string,
  originalText?: string,
): Promise<ExecutionResult> {
  const target = resolveUserPath(payloadPath);
  if (!target) throw new Error('No file path provided.');

  const stat = fs.existsSync(target) ? fs.statSync(target) : null;

  if (stat && stat.isDirectory()) {
    const entries = fs.readdirSync(target);
    const nameHint = fileNameHint || originalText || '';
    const preferredExts = pickPreferredExtensions(nameHint);

    const byName = entries.find((entry) => {
      const lowerEntry = entry.toLowerCase();
      const hasExt = preferredExts.includes(path.extname(entry).toLowerCase());
      return hasExt && nameHint && lowerEntry.includes(nameHint.toLowerCase());
    });

    const byExt = byName || entries.find((entry) => preferredExts.includes(path.extname(entry).toLowerCase()));

    const chosen = byName || byExt;
    if (!chosen) throw new Error(`Folder has no matching files to open: ${target}`);

    const filePath = path.join(target, chosen);
    ensurePathExists(filePath, false);

    const result = await shell.openPath(filePath);
    if (result) throw new Error(result);

    return { ok: true, message: `Opened file: ${filePath}` };
  }

  ensurePathExists(target, false);
  const result = await shell.openPath(target);
  if (result) throw new Error(result);

  return { ok: true, message: `Opened file: ${target}` };
}

async function handlePlayMedia(mediaPath?: string): Promise<ExecutionResult> {
  const target = resolveUserPath(mediaPath);
  if (!target) throw new Error('No media path provided.');
  ensurePathExists(target, false);

  const result = await shell.openPath(target);
  if (result) throw new Error(result);

  return { ok: true, message: `Playing media: ${target}` };
}

function resolveWhitelistedApp(appName?: string): string | null {
  if (!appName) return null;
  const normalized = appName.toLowerCase();

  switch (normalized) {
    case 'vscode':
    case 'code':
      return 'code';
    case 'chrome':
    case 'google chrome':
      return 'chrome';
    default:
      return null;
  }
}

async function handleLaunchApp(appName?: string): Promise<ExecutionResult> {
  const command = resolveWhitelistedApp(appName);
  if (!command) throw new Error(`App is not in whitelist: ${appName ?? 'unknown'}`);

  await shell.openExternal(command);
  return { ok: true, message: `Launched app: ${command}` };
}

// --- Updated executeCommand ---
export async function executeCommand(command: DeskAgentCommand): Promise<ExecutionResult> {
  try {
    switch (command.action) {
      case 'open_folder':
        return await handleOpenFolder(command.payload.path);
      case 'open_file':
        // Cast payload safely instead of using @ts-expect-error
        const fileName = 'fileName' in command.payload ? command.payload.fileName : undefined;
        return await handleOpenFile(command.payload.path, fileName, command.originalText);
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