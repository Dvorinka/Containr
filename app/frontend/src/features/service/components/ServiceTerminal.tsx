import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Loader2 } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/api-client';

type Frame = {
  type: 'stdin' | 'resize' | 'stdout' | 'exit' | 'error' | 'ping' | 'pong';
  data?: string;
  cols?: number;
  rows?: number;
  code?: number;
  message?: string;
};

// Interactive shell: WebSocket → docker exec pty in the service container.
export function ServiceTerminal({ serviceId }: { serviceId: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'connecting' | 'live' | 'ended' | 'error'>('connecting');

  useEffect(() => {
    if (!hostRef.current) return;

    const term = new Terminal({
      fontFamily: 'var(--font-mono, ui-monospace, monospace)',
      fontSize: 13,
      cursorBlink: true,
      convertEol: false,
      theme: {
        background: '#0a0a0c',
        foreground: '#d4d4d8',
        cursor: '#a1a1aa',
        selectionBackground: '#3f3f46',
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(hostRef.current);
    fit.fit();

    const wsUrl = getApiBaseUrl().replace(/^http/, 'ws');
    const ws = new WebSocket(`${wsUrl}/services/${serviceId}/terminal`);

    ws.onopen = () => {
      setStatus('live');
      const { cols, rows } = term;
      const frame: Frame = { type: 'resize', cols, rows };
      ws.send(JSON.stringify(frame));
    };
    ws.onmessage = (ev) => {
      let f: Frame;
      try {
        f = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (f.type === 'stdout' && f.data) term.write(f.data);
      else if (f.type === 'exit') {
        setStatus('ended');
        term.write(`\r\n\x1b[90m[session ended — exit ${f.code ?? 0}]\x1b[0m\r\n`);
      } else if (f.type === 'error') {
        setStatus('error');
        term.write(`\r\n\x1b[31m${f.message ?? 'terminal error'}\x1b[0m\r\n`);
      }
    };
    ws.onerror = () => setStatus((s) => (s === 'live' ? s : 'error'));
    ws.onclose = () => setStatus((s) => (s === 'error' ? s : 'ended'));

    const dataSub = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'stdin', data } satisfies Frame));
      }
    });

    const observer = new ResizeObserver(() => {
      fit.fit();
      if (ws.readyState === WebSocket.OPEN) {
        const { cols, rows } = term;
        ws.send(JSON.stringify({ type: 'resize', cols, rows } satisfies Frame));
      }
    });
    observer.observe(hostRef.current);

    return () => {
      observer.disconnect();
      dataSub.dispose();
      ws.close();
      term.dispose();
    };
  }, [serviceId]);

  return (
    <div className="relative">
      {status === 'connecting' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0a0a0c]/80 rounded-[var(--radius-md)]">
          <Loader2 size={18} className="animate-spin text-[var(--accent-primary)]" />
        </div>
      )}
      <div
        ref={hostRef}
        className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] overflow-hidden p-2"
        style={{ background: '#0a0a0c', height: 420 }}
      />
    </div>
  );
}
