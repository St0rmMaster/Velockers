type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogPayload {
  level: LogLevel;
  scope: string;
  message: unknown;
  timestamp: string;
}

const buffer: LogPayload[] = [];
const MAX_BUFFER = 500;

function normalise(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      message: value.message,
      stack: value.stack,
      name: value.name,
    };
  }

  if (typeof value === 'object' && value !== null) {
    try {
      JSON.stringify(value);
      return value;
    } catch {
      return String(value);
    }
  }

  return value;
}

async function sendToServer(payload: LogPayload) {
  if (typeof window === 'undefined') return;
  if (!import.meta.env.DEV) return;

  const body = JSON.stringify(payload);

  try {
    // Send to Vite dev server endpoint that will write to file
    await fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      // Fallback to old endpoint
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon('/__client-log', blob);
      }
    });
  } catch (error) {
    console.warn('[logger] failed to send log to server', error);
  }
}

function record(level: LogLevel, scope: string, data: unknown) {
  const payload: LogPayload = {
    level,
    scope,
    message: normalise(data),
    timestamp: new Date().toISOString(),
  };

  buffer.push(payload);
  if (buffer.length > MAX_BUFFER) {
    buffer.shift();
  }

  if (typeof window !== 'undefined') {
    (window as any).__exce1siorLogs = buffer.slice();
  }

  const consoleMethod =
    level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  consoleMethod(`[${payload.timestamp}] [${scope}] [${level.toUpperCase()}]`, payload.message);

  void sendToServer(payload);
}

export const logger = {
  debug(scope: string, data: unknown) {
    record('debug', scope, data);
  },
  info(scope: string, data: unknown) {
    record('info', scope, data);
  },
  warn(scope: string, data: unknown) {
    record('warn', scope, data);
  },
  error(scope: string, data: unknown) {
    record('error', scope, data);
  },
  getBuffer() {
    return buffer.slice();
  },
  downloadLogs() {
    const logs = buffer.map(log => 
      `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.scope}] ${JSON.stringify(log.message, null, 2)}`
    ).join('\n\n');
    
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exce1sior-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
  clearLogs() {
    buffer.length = 0;
    if (typeof window !== 'undefined') {
      (window as any).__exce1siorLogs = [];
    }
  },
};

export type Logger = typeof logger;
