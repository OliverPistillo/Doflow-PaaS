import { Injectable, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class RedisService implements OnModuleInit {
  private client: Redis;
  private dualProbeScriptSha!: string;

    getClient(): Redis {
    return this.client;
    }

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    });
  }

  async onModuleInit() {
    const scriptPath = path.join(__dirname, 'scripts', 'dual_probe.lua');
    const script = fs.readFileSync(scriptPath, 'utf8');
    this.dualProbeScriptSha = (await this.client.script('LOAD', script)) as string;
    console.log(`✅ Lua Script Loaded: ${this.dualProbeScriptSha}`);
  }

  async checkAndAdd(key: string, item: string, ttlSeconds: number): Promise<boolean> {
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
}
