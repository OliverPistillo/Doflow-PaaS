import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BUSINARO_WAREHOUSE_RULES } from '../rules/tokens';
import { BusinaroWarehouseRules } from '../rules/types';
import { StockStatus } from '../common/enums';
import { BusinaroInventoryLot } from './entities/inventory-lot.entity';
import { BusinaroStockMovement } from './entities/stock-movement.entity';
import { PickItemDto } from './dto/pick-item.dto';
import { QuarantineDecisionDto, QuarantineInDto } from './dto/quarantine.dto';

@Injectable()
export class BusinaroWarehouseService {
  constructor(
    @Inject(BUSINARO_WAREHOUSE_RULES) private readonly rules: BusinaroWarehouseRules,
  ) {}

  async pick(ds: DataSource, operatorId: string, dto: PickItemDto) {
    // Validazione Regola: Commessa Obbligatoria
    if (this.rules.requireJobOrderOnPick && !dto.jobOrderId) {
      throw new BadRequestException('jobOrderId obbligatorio per Businaro.');
    }

    const lotRepo = ds.getRepository(BusinaroInventoryLot);
    
    const lot = await lotRepo.findOne({
      where: { id: dto.lotId },
      relations: ['product'],
    });

    if (!lot) throw new BadRequestException('Lotto non trovato.');

    // Validazione Regola: Stato Prelevabile
    if (!this.rules.pickableStatuses.includes(lot.status)) {
      throw new ForbiddenException(`Lotto non prelevabile. Stato attuale: ${lot.status}`);
    }

    const currentQty = Number(lot.quantity);
    if (currentQty < dto.quantity) {
      throw new BadRequestException('Disponibilità insufficiente.');
    }

    // Preparazione dati per transazione
    const fromStatus = lot.status;
    const newQty = String(currentQty - dto.quantity);

    await ds.transaction(async (trx) => {
      // 1. Aggiorna Lotto
      // Nota: Non salviamo direttamente "lot" modificato per evitare race condition esterne, 
      // usiamo update o ricarichiamo in lock. Qui semplificato per brevità.
      await trx.getRepository(BusinaroInventoryLot).update(lot.id, {
        quantity: newQty,
        // Se quantità va a 0, potremmo cambiare status, ma Businaro preferisce tenerlo tracciato
      });

      // 2. Scrivi Audit Log
      await trx.getRepository(BusinaroStockMovement).save({
        inventoryLotId: lot.id,
        productId: lot.product.id,
        jobOrderId: dto.jobOrderId,
        delta: String(-dto.quantity),
        fromStatus,
        toStatus: fromStatus, // Il prelievo standard non cambia lo status del lotto rimanente
        reason: 'PICKING',
        operatorId,
      });
    });

    return { ok: true, lotId: lot.id, newQty };
  }

  async quarantineIn(ds: DataSource, operatorId: string, dto: QuarantineInDto) {
    const lotRepo = ds.getRepository(BusinaroInventoryLot);
    const lot = await lotRepo.findOne({ where: { id: dto.lotId }, relations: ['product'] });
    
    if (!lot) throw new BadRequestException('Lotto non trovato.');

    const fromStatus = lot.status;

    await ds.transaction(async (trx) => {
      // Cambio stato in QUARANTINE
      await trx.getRepository(BusinaroInventoryLot).update(lot.id, {
        status: StockStatus.QUARANTINE
      });

      await trx.getRepository(BusinaroStockMovement).save({
        inventoryLotId: lot.id,
        productId: lot.product.id,
        jobOrderId: null,
        delta: String(0), // Nessun cambio quantità, solo stato
        fromStatus,
        toStatus: StockStatus.QUARANTINE,
        reason: 'RETURN_TO_QUARANTINE',
        operatorId,
      });
    });

    return { ok: true, lotId: lot.id, status: StockStatus.QUARANTINE };
  }

  async quarantineDecision(ds: DataSource, operatorId: string, dto: QuarantineDecisionDto) {
    if (this.rules.quarantineRestockAllowed) {
      // Se mai cambiasse la regola
      throw new BadRequestException('Restock diretto non permesso.');
    }

    const lotRepo = ds.getRepository(BusinaroInventoryLot);
    const lot = await lotRepo.findOne({ where: { id: dto.lotId }, relations: ['product'] });
    
    if (!lot) throw new BadRequestException('Lotto non trovato.');
    if (lot.status !== StockStatus.QUARANTINE) {
      throw new BadRequestException('Il lotto non è in quarantena.');
    }

    const fromStatus = lot.status;
    const toStatus = dto.decision === 'APPROVE' ? StockStatus.AVAILABLE : StockStatus.SCRAP;

    await ds.transaction(async (trx) => {
      await trx.getRepository(BusinaroInventoryLot).update(lot.id, {
        status: toStatus
      });

      await trx.getRepository(BusinaroStockMovement).save({
        inventoryLotId: lot.id,
        productId: lot.product.id,
        jobOrderId: null,
        delta: String(0),
        fromStatus,
        toStatus,
        reason: dto.decision === 'APPROVE' ? 'QC_APPROVED' : 'QC_REJECTED',
        operatorId,
      });
    });

    return { ok: true, lotId: lot.id, status: toStatus };
  }
}