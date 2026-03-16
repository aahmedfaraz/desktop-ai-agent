import { useState } from 'react';
import { parseCommandWithGroq } from '../services/groqClient';
import type { DeskAgentCommand } from '../../shared/commandSchema';
import { validateCommand } from '../../shared/commandSchema';

type Status = 'idle' | 'thinking' | 'error' | 'success';

declare global {
  interface Window {
    ipcRenderer: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
    };
  }
}

export function useCommand() {
  const [status, setStatus] = useState<Status>('idle');
  const [lastCommand, setLastCommand] = useState<DeskAgentCommand | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const sendCommand = async (text: string) => {
    setStatus('thinking');
    setError(null);

    try {
      const groqResult = await parseCommandWithGroq(text, {
        lastCommandText: lastCommand?.originalText,
        lastResolvedPath: lastCommand?.payload.path ?? lastCommand?.payload.mediaPath,
      });

      const candidate: DeskAgentCommand = {
        action: groqResult.action as DeskAgentCommand['action'],
        payload: groqResult.payload ?? {},
        originalText: text,
      };

      const validated = validateCommand(candidate);

      if (!validated) {
        throw new Error('Parsed command did not pass validation.');
      }

      setLastCommand(validated);
      setResultMessage(null);

      const result = (await window.ipcRenderer.invoke('deskagent/run-command', validated)) as {
        ok: boolean;
        message: string;
      };

      setResultMessage(result.message);
      setStatus(result.ok ? 'success' : 'error');
      if (!result.ok) {
        setError(result.message);
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setResultMessage(null);
      setStatus('error');
    }
  };

  return {
    status,
    lastCommand,
    error,
    resultMessage,
    sendCommand,
  };
}

