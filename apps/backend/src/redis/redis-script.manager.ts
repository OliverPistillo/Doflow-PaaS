import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class RedisScriptManager implements OnModuleInit {
  private readonly logger = new Logger(RedisScriptManager.name);
  private scripts: Map<string, string> = new Map(); // Name -> SHA1

  constructor(private readonly redisService: RedisService) {}

  async onModuleInit() {
    await this.loadScripts();
  }

  /**
   * Carica tutti gli script .lua dalla cartella ./scripts
   * e ne memorizza l'hash SHA1 per l'uso con EVALSHA via RedisService.
   */
  private async loadScripts() {
    const scriptsDir = path.join(__dirname, 'scripts');
    
    if (!fs.existsSync(scriptsDir)) {
      this.logger.warn(`Directory scripts non trovata: ${scriptsDir}`);
      return;
    }

    const files = fs.readdirSync(scriptsDir).filter((file) => file.endsWith('.lua'));
    const client = this.redisService.getClient();

    for (const file of files) {
      const scriptName = path.parse(file).name; // es. "traffic_guard", "dual_probe"
      const filePath = path.join(scriptsDir, file);
      const scriptContent = fs.readFileSync(filePath, 'utf8');

      try {
        // Carica lo script in Redis e ottieni lo SHA
        const sha = await client.script('LOAD', scriptContent) as string;
        this.scripts.set(scriptName, sha);
        this.logger.log(`✅ Script caricato: ${scriptName} => ${sha.substring(0, 7)}...`);
      } catch (err) {
        this.logger.error(`❌ Errore caricamento script ${scriptName}:`, err);
      }
    }
  }

  /**
   * Esegue uno script Lua pre-caricato in modo atomico.
   */
  async executeScript(scriptName: string, keys: string[], args: (string | number)[]) {
    const sha = this.scripts.get(scriptName);
    if (!sha) {
      this.logger.error(`Tentativo di esecuzione script non caricato: ${scriptName}`);
      throw new Error(`Script Lua non trovato o non caricato: ${scriptName}`);
    }

    const client = this.redisService.getClient();
    // evalsha args: SHA, numKeys, key1, key2, arg1, arg2...
    return await client.evalsha(sha, keys.length, ...keys, ...args.map(String));
  }

  getScriptSha(name: string): string | undefined {
    return this.scripts.get(name);
  }
}