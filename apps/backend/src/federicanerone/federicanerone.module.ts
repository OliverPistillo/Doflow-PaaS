import { Module } from '@nestjs/common';
import { ClientiController } from './clienti/clienti.controller';
import { ClientiService } from './clienti/clienti.service';
import { TrattamentiController } from './trattamenti/trattamenti.controller';
import { TrattamentiService } from './trattamenti/trattamenti.service';
import { AppuntamentiController } from './appuntamenti/appuntamenti.controller';
import { AppuntamentiService } from './appuntamenti/appuntamenti.service';

@Module({
  controllers: [ClientiController, TrattamentiController, AppuntamentiController],
  providers: [ClientiService, TrattamentiService, AppuntamentiService],
})
export class FedericaNeroneModule {}
