type MessageHandler = (msg: any) => void;

let ws: WebSocket | null = null;
let handlers: MessageHandler[] = [];
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let _connected = false;
let _onConnectionChange: ((connected: boolean) => void) | null = null;

function getWsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}/ws`;
}

function connect(): void {
  try {
    ws = new WebSocket(getWsUrl());
  } catch {
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    console.log('[Agent Office] WebSocket connected');
    _connected = true;
    _onConnectionChange?.(_connected);
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      for (const handler of handlers) {
        handler(msg);
      }
    } catch {
      // ignore malformed messages
    }
  };

  ws.onclose = () => {
    console.log('[Agent Office] WebSocket disconnected');
    _connected = false;
    _onConnectionChange?.(_connected);
    ws = null;
    scheduleReconnect();
  };

  ws.onerror = () => {
    ws?.close();
  };
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, 2000);
}

export const transport = {
  onMessage(handler: MessageHandler): () => void {
    handlers.push(handler);
    return () => {
      handlers = handlers.filter((h) => h !== handler);
    };
  },

  postMessage(msg: unknown): void {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  },

  get connected(): boolean {
    return _connected;
  },

  onConnectionChange(handler: (connected: boolean) => void): void {
    _onConnectionChange = handler;
  },
};

// Auto-connect on import
connect();
