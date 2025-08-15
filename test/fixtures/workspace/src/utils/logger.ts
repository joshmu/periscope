export class Logger {
  private prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  log(message: string) {
    console.log(`[${this.prefix}] ${message}`);
  }

  error(message: string) {
    console.error(`[${this.prefix}] ERROR: ${message}`);
  }

  warn(message: string) {
    console.warn(`[${this.prefix}] WARNING: ${message}`);
  }
}

const log = new Logger('App');

// Error scenarios for testing
export function connectToDatabase() {
  try {
    // Simulate database connection
    throw new Error('Connection timeout');
  } catch (err) {
    log.error('Database connection failed');
    log.writeError('Failed to establish database connection');
  }
}

export function processRequest(data: any) {
  if (!data) {
    log.fatalError('No data provided');
    return;
  }

  log.log('Processing request');
}
