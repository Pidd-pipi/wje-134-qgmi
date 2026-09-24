export const logger = {
  info(message: string, metadata?: Record<string, unknown>): void {
    console.log(JSON.stringify({ level: 'info', message, ...metadata }));
  },
  warn(message: string, metadata?: Record<string, unknown>): void {
    console.warn(JSON.stringify({ level: 'warn', message, ...metadata }));
  },
  error(message: string, metadata?: Record<string, unknown>): void {
    console.error(JSON.stringify({ level: 'error', message, ...metadata }));
  }
};
