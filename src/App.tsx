import { useState } from 'react';
import { useCommand } from './hooks/useCommand';
import './index.css';

function App() {
  const [input, setInput] = useState('');
  const { status, error, lastCommand, resultMessage, sendCommand } = useCommand();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    await sendCommand(input.trim());
  };

  return (
    <div className="app-root">
      <h1>DeskAgent (text-only prototype)</h1>

      <form onSubmit={handleSubmit} className="command-form">
        <input
          type="text"
          placeholder="Type a command, e.g. open my Documents folder"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" disabled={status === 'thinking'}>
          {status === 'thinking' ? 'Thinking…' : 'Send'}
        </button>
      </form>

      <section className="status-panel">
        <p>
          <strong>Status:</strong> {status}
        </p>
        {resultMessage && (
          <p>
            <strong>Result:</strong> {resultMessage}
          </p>
        )}
        {lastCommand && (
          <pre className="last-command">
            {JSON.stringify(lastCommand, null, 2)}
          </pre>
        )}
        {error && (
          <p className="error-text">
            <strong>Error:</strong> {error}
          </p>
        )}
      </section>
    </div>
  );
}

export default App;

