export type AllowedAction = 'open_folder' | 'open_file' | 'launch_app' | 'play_media';

export interface BaseCommandPayload {
  path?: string;
  appName?: string;
  mediaPath?: string;
}

export interface DeskAgentCommand {
  action: AllowedAction;
  payload: BaseCommandPayload;
  originalText: string;
}

export function isAllowedAction(action: string): action is AllowedAction {
  return ['open_folder', 'open_file', 'launch_app', 'play_media'].includes(action);
}

export function validateCommand(candidate: unknown): DeskAgentCommand | null {
  if (typeof candidate !== 'object' || candidate === null) return null;

  const cmd = candidate as Partial<DeskAgentCommand>;

  if (!cmd.action || typeof cmd.action !== 'string' || !isAllowedAction(cmd.action)) {
    return null;
  }

  if (!cmd.originalText || typeof cmd.originalText !== 'string') {
    return null;
  }

  const payload = (cmd.payload ?? {}) as BaseCommandPayload;

  if (payload.path && typeof payload.path !== 'string') {
    return null;
  }

  if (payload.appName && typeof payload.appName !== 'string') {
    return null;
  }

  if (payload.mediaPath && typeof payload.mediaPath !== 'string') {
    return null;
  }

  return {
    action: cmd.action as AllowedAction,
    originalText: cmd.originalText,
    payload,
  };
}

