import { Module } from '@nestjs/common';
import { ClientiController } from './clienti/clienti.controller';
import { ClientiService } from './clienti/clienti.service';
import { TrattamentiController } from './trattamenti/trattamenti.controller';
import { TrattamentiService } from './trattamenti/trattamenti.service';
import { AppuntamentiController } from './appuntamenti/appuntamenti.controller';
import { AppuntamentiService } from './appuntamenti/appuntamenti.service';
// --- MODIFICA VIP: Import del controller Settings ---
import { SettingsController } from './settings/settings.controller';

@Module({
  // --- MODIFICA VIP: Aggiunto SettingsController ai controllers ---
  controllers: [ClientiController, TrattamentiController, AppuntamentiController, SettingsController],
  providers: [ClientiService, TrattamentiService, AppuntamentiService],
})
export class FedericaNeroneModule {}