import { Controller, Get, Post, Query, Body, Res, Req } from '@nestjs/common';
import { Response, Request } from 'express';
import { DataSource } from 'typeorm';
import { getTenantConn } from '../../tenant-helpers';
import axios from 'axios';

// CONFIGURAZIONE (Da mettere in .env in produzione)
const FB_VERIFY_TOKEN = 'doflow_verify_token'; // Scegli una password a caso
const FB_PAGE_ACCESS_TOKEN = 'EAAWZA2QtQvFUBQvELZBxOSDYR0rXtOEfG9QCsyNb3ZAGIifv2ldt9xzQJSqXX9Ax9BrzMNqDZC550ZAbHeKnHipUNOW8HrriUxzFXzJlhMO9xGZCQniMMDRLehMdk6XRKe1hMqyM4ufELTPV8dYAQlJJZBE0Pf3hnMd7pgXddhKNQMq0UPDAGI9cNcAZAKNfDQZDZD'; 

@Controller('facebook')
export class FacebookController {
  
  // 1. VERIFICA WEBHOOK (Facebook chiama questo quando configuri l'app)
  @Get('webhook')
  verifyWebhook(@Query() query: any, @Res() res: Response) {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode && token) {
      if (mode === 'subscribe' && token === FB_VERIFY_TOKEN) {
        console.log('WEBHOOK_VERIFIED');
        return res.status(200).send(challenge);
      } else {
        return res.sendStatus(403);
      }
    }
    return res.sendStatus(400);
  }

  // 2. RICEZIONE LEAD (Facebook invia i dati qui)
  @Post('webhook')
  async receiveLead(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    console.log('Facebook Event Received');

    try {
      const ds = getTenantConn(req); // Nota: Qui serve gestire il tenant. Per i webhook esterni, spesso si usa una connessione admin o si deduce il tenant.
      // Per semplicità assumiamo che questo webhook sia SOLO per Federica Nerone.
      
      if (body.object === 'page') {
        for (const entry of body.entry) {
          for (const change of entry.changes) {
            if (change.field === 'leadgen') {
              const leadgenId = change.value.leadgen_id;
              await this.processLead(ds, leadgenId);
            }
          }
        }
        return res.status(200).send('EVENT_RECEIVED');
      } else {
        return res.sendStatus(404);
      }
    } catch (error) {
      console.error('Errore webhook:', error);
      return res.sendStatus(500);
    }
  }

  // 3. RECUPERO DATI E SALVATAGGIO
  private async processLead(ds: DataSource, leadId: string) {
    try {
      // Chiamata alle Graph API di Facebook per avere i dettagli
      const fbUrl = `https://graph.facebook.com/v18.0/${leadId}?access_token=${FB_PAGE_ACCESS_TOKEN}`;
      const { data } = await axios.get(fbUrl);
      
      // I dati arrivano come array di oggetti { name: 'email', values: ['...'] }
      const formMap: any = {};
      data.field_data.forEach((field: any) => {
        formMap[field.name] = field.values[0];
      });

      // Mappatura campi (dipende da come hai chiamato i campi nel form Facebook)
      const fullName = formMap['full_name'] || formMap['nome_completo'] || 'Lead Facebook';
      const email = formMap['email'] || null;
      const phone = formMap['phone_number'] || formMap['telefono'] || null;

      // Salvataggio nel DB
      await ds.query(
        `INSERT INTO federicanerone.clienti 
         (full_name, email, phone, source, external_id, created_at, updated_at)
         VALUES ($1, $2, $3, 'facebook_ads', $4, now(), now())
         ON CONFLICT (email) DO NOTHING`, // Evita duplicati se l'email esiste
        [fullName, email, phone, leadId]
      );

      console.log(`Lead salvato: ${fullName}`);

    } catch (e) {
      console.error('Errore processing lead:', e);
    }
  }
}