import { Module } from '@nestjs/common';
import { ClientiController } from './clienti/clienti.controller';
import { ClientiService } from './clienti/clienti.service';
import { TrattamentiController } from './trattamenti/trattamenti.controller';
import { TrattamentiService } from './trattamenti/trattamenti.service';
import { AppuntamentiController } from './appuntamenti/appuntamenti.controller';
import { AppuntamentiService } from './appuntamenti/appuntamenti.service';
import { SettingsController } from './settings/settings.controller';
// --- NUOVO: Import del controller Facebook ---
import { FacebookController } from './facebook/facebook.controller';

@Module({
  // --- NUOVO: Aggiunto FacebookController ---
  controllers: [
    ClientiController, 
    TrattamentiController, 
    AppuntamentiController, 
    SettingsController, 
    FacebookController
  ],
  providers: [ClientiService, TrattamentiService, AppuntamentiService],
})
export class FedericaNeroneModule {}