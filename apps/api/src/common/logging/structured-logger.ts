import { Injectable, LoggerService } from '@nestjs/common';

@Injectable()
export class StructuredLogger implements LoggerService {
  event(event: string, fields: Record<string, string | number | boolean | undefined>) {
    const entry = { timestamp: new Date().toISOString(), level: 'info', event, ...fields };
    process.stdout.write(`${JSON.stringify(entry)}\n`);
  }
  log(message: unknown, ...optional: unknown[]) {
    this.write('info', message, optional);
  }
  warn(message: unknown, ...optional: unknown[]) {
    this.write('warn', message, optional);
  }
  error(message: unknown, ...optional: unknown[]) {
    this.write('error', message, optional);
  }
  debug(message: unknown, ...optional: unknown[]) {
    this.write('debug', message, optional);
  }
  verbose(message: unknown, ...optional: unknown[]) {
    this.write('trace', message, optional);
  }
  fatal(message: unknown, ...optional: unknown[]) {
    this.write('fatal', message, optional);
  }

  private write(level: string, message: unknown, optional: unknown[]) {
    const context = optional.find((value) => typeof value === 'string');
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message: typeof message === 'string' ? message : JSON.stringify(message),
    };
    const output = `${JSON.stringify(entry)}\n`;
    if (level === 'error' || level === 'fatal') process.stderr.write(output);
    else process.stdout.write(output);
  }
}
