import React, { useEffect, useRef, useState } from 'react';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

interface LogViewerProps {
  logs: LogEntry[];
  autoScroll?: boolean;
}

export default function LogViewer({ logs, autoScroll = true }: LogViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (!autoScroll || isPaused || !containerRef.current) return;
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [logs, autoScroll, isPaused]);

  function formatTimestamp(ts: string): string {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false });
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button
          className="btn btn-sm btn-secondary"
          onClick={() => setIsPaused(!isPaused)}
        >
          {isPaused ? '▶ Resume scroll' : '⏸ Pause scroll'}
        </button>
      </div>
      <div className="log-viewer" ref={containerRef}>
        {logs.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
            No logs yet...
          </div>
        )}
        {logs.map((log, i) => (
          <div key={i} className={`log-line ${log.level}`}>
            <span className="timestamp">[{formatTimestamp(log.timestamp)}]</span>
            {log.message}
          </div>
        ))}
      </div>
    </div>
  );
}
