import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import * as net from 'node:net';
import * as tls from 'node:tls';

type RedisValue = string | number | null | RedisValue[] | { redisError: string };
interface ParsedValue {
  value: RedisValue;
  offset: number;
}
interface RateLimitRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

const RATE_LIMIT_SCRIPT = `
local blockedTtl = redis.call('PTTL', KEYS[2])
if blockedTtl > 0 then
  local hits = tonumber(redis.call('GET', KEYS[1]) or ARGV[3])
  local ttl = math.max(redis.call('PTTL', KEYS[1]), 0)
  return { hits, ttl, 1, blockedTtl }
end
local hits = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if hits == 1 or ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
local isBlocked = 0
local blockTtl = 0
if hits > tonumber(ARGV[3]) then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[2])
  isBlocked = 1
  blockTtl = tonumber(ARGV[2])
end
return { hits, ttl, isBlocked, blockTtl }
`;

function parseValue(buffer: Buffer, offset: number): ParsedValue | undefined {
  if (offset >= buffer.length) return undefined;
  const marker = String.fromCharCode(buffer[offset]);
  const lineEnd = buffer.indexOf('\r\n', offset);
  if (lineEnd < 0) return undefined;
  const line = buffer.toString('utf8', offset + 1, lineEnd);
  const next = lineEnd + 2;
  if (marker === '+') return { value: line, offset: next };
  if (marker === '-') return { value: { redisError: line }, offset: next };
  if (marker === ':') return { value: Number.parseInt(line, 10), offset: next };
  if (marker === '$') {
    const size = Number.parseInt(line, 10);
    if (size === -1) return { value: null, offset: next };
    if (buffer.length < next + size + 2) return undefined;
    return { value: buffer.toString('utf8', next, next + size), offset: next + size + 2 };
  }
  if (marker === '*') {
    const count = Number.parseInt(line, 10);
    if (count === -1) return { value: null, offset: next };
    const values: RedisValue[] = [];
    let cursor = next;
    for (let index = 0; index < count; index += 1) {
      const parsed = parseValue(buffer, cursor);
      if (!parsed) return undefined;
      values.push(parsed.value);
      cursor = parsed.offset;
    }
    return { value: values, offset: cursor };
  }
  throw new Error(`Unsupported Redis protocol response: ${marker}`);
}

class RedisConnection {
  private socket?: net.Socket;
  private connecting?: Promise<void>;
  private buffer = Buffer.alloc(0);
  private pending: Array<{ resolve: (value: RedisValue) => void; reject: (error: Error) => void }> =
    [];
  private closed = false;

  constructor(private readonly url: URL) {}

  async command(...args: string[]): Promise<RedisValue> {
    await this.connect();
    return this.writeCommand(args);
  }

  async close() {
    this.closed = true;
    this.socket?.end();
    this.socket?.destroy();
    this.socket = undefined;
    this.failPending(new Error('Redis connection closed'));
  }

  private async connect(): Promise<void> {
    if (this.socket && !this.socket.destroyed) return;
    if (this.closed) throw new Error('Redis connection is closed');
    if (this.connecting) return this.connecting;
    this.connecting = new Promise<void>((resolve, reject) => {
      const host = this.url.hostname;
      const port = Number(this.url.port || 6379);
      const socket =
        this.url.protocol === 'rediss:'
          ? tls.connect({ host, port, servername: host })
          : net.createConnection({ host, port });
      socket.setTimeout(5_000, () => socket.destroy(new Error('Redis connection timed out')));
      this.socket = socket;
      const connectedEvent = this.url.protocol === 'rediss:' ? 'secureConnect' : 'connect';
      socket.once(connectedEvent, async () => {
        socket.setTimeout(0);
        socket.on('data', (chunk: Buffer) => this.receive(chunk));
        socket.on('error', (error) => this.disconnect(error));
        socket.on('close', () => this.disconnect(new Error('Redis connection ended')));
        try {
          const username = decodeURIComponent(this.url.username);
          const password = decodeURIComponent(this.url.password);
          if (password) {
            if (username) await this.writeCommand(['AUTH', username, password]);
            else await this.writeCommand(['AUTH', password]);
          }
          const database = this.url.pathname.replace(/^\//, '');
          if (database && database !== '0') await this.writeCommand(['SELECT', database]);
          resolve();
        } catch (error) {
          socket.destroy();
          reject(error);
        }
      });
      socket.once('error', (error) => reject(error));
    }).finally(() => {
      this.connecting = undefined;
    });
    return this.connecting;
  }

  private writeCommand(args: string[]): Promise<RedisValue> {
    const socket = this.socket;
    if (!socket || socket.destroyed)
      return Promise.reject(new Error('Redis socket is not connected'));
    const command = `*${args.length}\r\n${args.map((arg) => `$${Buffer.byteLength(arg)}\r\n${arg}\r\n`).join('')}`;
    return new Promise<RedisValue>((resolve, reject) => {
      this.pending.push({ resolve, reject });
      socket.write(command, (error) => {
        if (error) this.disconnect(error);
      });
    });
  }

  private receive(chunk: Buffer) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.pending.length) {
      let parsed: ParsedValue | undefined;
      try {
        parsed = parseValue(this.buffer, 0);
      } catch (error) {
        this.disconnect(error instanceof Error ? error : new Error('Invalid Redis response'));
        return;
      }
      if (!parsed) return;
      this.buffer = this.buffer.subarray(parsed.offset);
      const next = this.pending.shift()!;
      if (
        parsed.value &&
        typeof parsed.value === 'object' &&
        !Array.isArray(parsed.value) &&
        'redisError' in parsed.value
      ) {
        next.reject(new Error(`Redis command failed: ${parsed.value.redisError}`));
      } else next.resolve(parsed.value);
    }
  }

  private disconnect(error: Error) {
    this.socket = undefined;
    this.buffer = Buffer.alloc(0);
    this.failPending(error);
  }

  private failPending(error: Error) {
    for (const pending of this.pending.splice(0)) pending.reject(error);
  }
}

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly connections: RedisConnection[] = [];
  private nextConnection = 0;
  private readonly prefix = process.env.RATE_LIMIT_KEY_PREFIX || 'repairproof:rate-limit';

  constructor(redisUrl?: string, poolSize = Number(process.env.REDIS_POOL_SIZE || 4)) {
    if (
      !redisUrl &&
      (process.env.NODE_ENV === 'production' || process.env.REQUIRE_REDIS_RATE_LIMIT === 'true')
    )
      throw new Error('REDIS_URL is required for production shared rate limiting');
    if (!redisUrl) return;
    const url = new URL(redisUrl);
    if (!['redis:', 'rediss:'].includes(url.protocol))
      throw new Error('REDIS_URL must use redis:// or rediss://');
    for (let index = 0; index < Math.max(1, Math.min(poolSize, 32)); index += 1)
      this.connections.push(new RedisConnection(url));
  }

  get isConfigured() {
    return this.connections.length > 0;
  }

  async onModuleInit() {
    if (this.connections.length) {
      await Promise.all(this.connections.map((connection) => connection.command('PING')));
      this.logger.log(
        `Connected shared rate-limit storage (${this.connections.length} pooled connections)`,
      );
    }
  }

  async onModuleDestroy() {
    await Promise.all(this.connections.map((connection) => connection.close()));
  }

  async checkHealth(): Promise<void> {
    if (!this.connections.length) throw new Error('Redis rate-limit storage is not configured');
    const result = await this.connections[0].command('PING');
    if (result !== 'PONG') throw new Error('Redis health check returned an unexpected response');
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<RateLimitRecord> {
    if (!this.connections.length) throw new Error('Redis rate-limit storage is not configured');
    const baseKey = `${this.prefix}:${throttlerName}:${key}`;
    const reply = await this.connections[this.nextConnection++ % this.connections.length].command(
      'EVAL',
      RATE_LIMIT_SCRIPT,
      '2',
      baseKey,
      `${baseKey}:blocked`,
      `${ttl}`,
      `${blockDuration}`,
      `${limit}`,
    );
    if (!Array.isArray(reply) || reply.length !== 4)
      throw new Error('Invalid response from Redis rate-limit script');
    const [totalHits, timeToExpire, isBlocked, timeToBlockExpire] = reply.map(Number);
    return { totalHits, timeToExpire, isBlocked: isBlocked === 1, timeToBlockExpire };
  }
}
