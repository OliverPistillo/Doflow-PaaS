// apps\backend\src\sitebuilder\site-storage.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
// Importa il tuo servizio Redis qui, se usi ioredis dal tuo package.json.
// Per questo esempio, usiamo una Map in memoria per simulare il salvataggio.

@Injectable()
export class SiteStorageService {
  private tempStorage = new Map<string, any>();

  constructor(private jwtService: JwtService) {}

  async saveAndGenerateToken(siteData: any): Promise<string> {
    // 1. Genera un ID univoco per questo "pacchetto" di dati
    const exportId = crypto.randomUUID();

    // 2. Salva i dati (idealmente su Redis con scadenza o nel DB)
    this.tempStorage.set(exportId, siteData);

    // 3. Genera il Token JWT che contiene solo l'ID
    const payload = { exportId };
    const token = this.jwtService.sign(payload);

    return token;
  }

  async getSiteDataByToken(token: string): Promise<any> {
    try {
      // 1. Verifica e decodifica il token
      const payload = this.jwtService.verify(token);
      const exportId = payload.exportId;

      // 2. Recupera i dati dal database/Redis
      const data = this.tempStorage.get(exportId);

      if (!data) {
        throw new NotFoundException('Dati non trovati o token scaduto');
      }

      // 3. Opzionale: cancella i dati dopo il download (One-time download)
      // this.tempStorage.delete(exportId);

      return data;
    } catch (error) {
      throw new Error('Token non valido o scaduto');
    }
  }
}