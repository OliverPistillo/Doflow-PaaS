import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  private dualProbeScriptSha!: string;

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
    });
  }

    // --- NEW METHOD FOR HEALTH CHECK ---
  async ping(): Promise<{ pong: string; latency_ms: number }> {
    const t0 = Date.now();
    const pong = await this.client.ping(); // qui sei dentro la classe, quindi ok
    return { pong, latency_ms: Date.now() - t0 };
  }

  // --- LIFECYCLE METHODS ---

  async onModuleInit() {
    // Caricamento script Lua esistente
    const scriptPath = path.join(__dirname, 'scripts', 'dual_probe.lua');
    // Check se il file esiste per evitare crash se non lo hai ancora creato
    if (fs.existsSync(scriptPath)) {
      const script = fs.readFileSync(scriptPath, 'utf8');
      this.dualProbeScriptSha = (await this.client.script('LOAD', script)) as string;
      console.log(`✅ Lua Script Loaded: ${this.dualProbeScriptSha}`);
    } else {
      console.warn(`⚠️ Lua script not found at ${scriptPath}`);
    }
  }

  onModuleDestroy() {
    this.client.disconnect();
  }

  // --- EXISTING METHODS ---

  getClient(): Redis {
    return this.client;
  }

  async checkAndAdd(key: string, item: string, ttlSeconds: number): Promise<boolean> {
    if (!this.dualProbeScriptSha) {
       throw new Error('Lua script not loaded');
    }
    const currentKey = `doflow:bf:${key}:current`;
    const prevKey = `doflow:bf:${key}:prev`;

    const result = await this.client.evalsha(
      this.dualProbeScriptSha,
      2,
      currentKey,
      prevKey,
      item,
      ttlSeconds.toString(),
    );

    return result === 1;
  }

  // --- NUOVI METODI RICHIESTI DAL MIDDLEWARE ---

  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    if (ttlSeconds) {
      return await this.client.set(key, value, 'EX', ttlSeconds);
    }
    return await this.client.set(key, value);
  }

  async del(key: string) {
    return await this.client.del(key);
  }
}