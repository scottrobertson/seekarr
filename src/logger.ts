function timestamp(): string {
  return new Date().toISOString();
}

export function log(instance: string, message: string): void {
  console.log(`[${timestamp()}] [${instance}] ${message}`);
}

export function logError(instance: string, message: string): void {
  console.error(`[${timestamp()}] [${instance}] ERROR: ${message}`);
}
