import { useEffect, useMemo, useRef, useState } from 'react';
import { getApiBaseUrl } from '@/lib/api-client';

type BuildUpdatePayload = {
  channel: string;
  data: unknown;
};

type BuildUpdateMessage = {
  type?: string;
  channel?: string;
  data?: unknown;
};

function toWebSocketUrl(apiBase: string): string {
  const wsBase = apiBase.startsWith('https://') ? apiBase.replace('https://', 'wss://') : apiBase.replace('http://', 'ws://');
  return `${wsBase}/ws`;
}

export function useBuildUpdates(
  buildIds: string[],
  onBuildUpdate: (payload: BuildUpdatePayload) => void,
): boolean {
  const [connected, setConnected] = useState(false);
  const callbackRef = useRef(onBuildUpdate);
  useEffect(() => {
    callbackRef.current = onBuildUpdate;
  }, [onBuildUpdate]);

  const normalizedBuildIds = useMemo(
    () => Array.from(new Set(buildIds.filter(Boolean))).sort(),
    [buildIds],
  );

  const buildIdsKey = normalizedBuildIds.join('|');
  const subscriptionIds = useMemo(
    () => (buildIdsKey ? buildIdsKey.split('|') : []),
    [buildIdsKey],
  );

  useEffect(() => {
    if (subscriptionIds.length === 0) {
      return;
    }

    const wsUrl = toWebSocketUrl(getApiBaseUrl());
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let closedByEffect = false;

    const subscribeAll = () => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return;
      }
      for (const buildId of subscriptionIds) {
        socket.send(
          JSON.stringify({
            action: 'subscribe',
            channel: `build:${buildId}`,
          }),
        );
      }
    };

    const connect = () => {
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        setConnected(true);
        subscribeAll();
      };

      socket.onmessage = (event) => {
        const lines = String(event.data ?? '')
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line) as BuildUpdateMessage;
            if (parsed.type !== 'build_update' || !parsed.channel) {
              continue;
            }
            callbackRef.current({
              channel: parsed.channel,
              data: parsed.data,
            });
          } catch {
            // Ignore malformed messages.
          }
        }
      };

      socket.onclose = () => {
        setConnected(false);
        if (closedByEffect) {
          return;
        }
        reconnectTimer = window.setTimeout(connect, 2000);
      };

      socket.onerror = () => {
        setConnected(false);
      };
    };

    connect();

    return () => {
      closedByEffect = true;
      setConnected(false);
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      if (socket && socket.readyState === WebSocket.OPEN) {
        for (const buildId of subscriptionIds) {
          socket.send(
            JSON.stringify({
              action: 'unsubscribe',
              channel: `build:${buildId}`,
            }),
          );
        }
      }
      socket?.close();
    };
  }, [buildIdsKey, subscriptionIds]);

  return subscriptionIds.length > 0 && connected;
}
