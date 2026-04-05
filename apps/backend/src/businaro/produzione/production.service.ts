import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BUSINARO_PRODUCTION_RULES, BUSINARO_WAREHOUSE_RULES } from '../rules/tokens';
import { BusinaroProductionRules, BusinaroWarehouseRules } from '../rules/types';
import { BusinaroDepartment, StockStatus } from '../common/enums';
import { BusinaroInventoryLot } from '../magazzino/entities/inventory-lot.entity';
import { BusinaroProduct } from '../magazzino/entities/product.entity';
import { BusinaroStockMovement } from '../magazzino/entities/stock-movement.entity';
import { TransformDto } from '../magazzino/dto/transform.dto';

@Injectable()
export class BusinaroProductionService {
  constructor(
    @Inject(BUSINARO_PRODUCTION_RULES) private readonly rules: BusinaroProductionRules,
    @Inject(BUSINARO_WAREHOUSE_RULES) private readonly wmsRules: BusinaroWarehouseRules,
  ) {}

  async transform(ds: DataSource, operatorId: string, operatorRole: BusinaroDepartment, dto: TransformDto) {
    // 1. Controllo Ruolo Reparto
    if (!this.rules.transformAllowedDepartments.includes(operatorRole)) {
      throw new ForbiddenException('Operazione non permessa al tuo reparto.');
    }

    const productRepo = ds.getRepository(BusinaroProduct);
    const lotRepo = ds.getRepository(BusinaroInventoryLot);

    // 2. Recupero SKU
    const source = await productRepo.findOne({ where: { sku: dto.sourceSku } });
    const target = await productRepo.findOne({ where: { sku: dto.targetSku } });

    if (!source || !target) throw new BadRequestException(`SKU non valido: ${!source ? dto.sourceSku : dto.targetSku}`);

    // 3. Verifica Regola Fisica (es. Raw -> Semi)
    if (!this.rules.isTransformationAllowed(source.type, target.type)) {
      throw new BadRequestException(`Trasformazione illegale: ${source.type} -> ${target.type}`);
    }

    // 4. Recupero Lotto Input
    const sourceLot = await lotRepo.findOne({ 
      where: { id: dto.sourceLotId }, 
      relations: ['product', 'location'] 
    });
    
    if (!sourceLot) throw new BadRequestException('Lotto sorgente non trovato.');
    if (sourceLot.product.id !== source.id) throw new BadRequestException('Il lotto non contiene lo SKU dichiarato.');
    if (sourceLot.status !== StockStatus.AVAILABLE) throw new BadRequestException('Lotto non disponibile (impegnato o in quarantena).');

    const qty = dto.quantity;
    const currentQty = Number(sourceLot.quantity);
    if (currentQty < qty) throw new BadRequestException(`Giacenza insufficiente (Richiesto: ${qty}, Disp: ${currentQty})`);

    // 5. Cerca Lotto Output (Destinazione)
    // Cerchiamo se esiste già un lotto dello stesso prodotto, nello stesso posto, con le stesse caratteristiche
    let existingTargetLot = await lotRepo.findOne({
      where: {
        product: { id: target.id } as any,
        location: { id: sourceLot.location.id } as any,
        status: StockStatus.AVAILABLE,
        condition: sourceLot.condition, // Manteniamo la condizione (es. NEW)
      } as any,
      relations: ['product', 'location'],
    });

    // 6. Transazione Atomica
    await ds.transaction(async (trx) => {
      // A) Scarico Materia Prima
      await trx.getRepository(BusinaroInventoryLot).update(sourceLot.id, {
        quantity: String(currentQty - qty)
      });

      await trx.getRepository(BusinaroStockMovement).save({
        inventoryLotId: sourceLot.id,
        productId: source.id,
        jobOrderId: dto.jobOrderId,
        delta: String(-qty),
        fromStatus: StockStatus.AVAILABLE,
        toStatus: StockStatus.AVAILABLE,
        reason: 'TRANSFORMATION_INPUT',
        operatorId,
      });

      // B) Carico Semilavorato
      let finalTargetLot: BusinaroInventoryLot;

      if (existingTargetLot) {
        // Aggiorno esistente
        const newTargetQty = Number(existingTargetLot.quantity) + qty;
        await trx.getRepository(BusinaroInventoryLot).update(existingTargetLot.id, {
          quantity: String(newTargetQty)
        });
        finalTargetLot = existingTargetLot;
        finalTargetLot.quantity = String(newTargetQty); // Aggiorno oggetto per return
      } else {
        // Creo nuovo lotto
        finalTargetLot = trx.getRepository(BusinaroInventoryLot).create({
          product: target,
          location: sourceLot.location,
          batchNumber: null, // Qui si potrebbe generare un nuovo batch ID
          serialNumber: null,
          quantity: String(qty),
          status: StockStatus.AVAILABLE,
          condition: sourceLot.condition,
        });
        finalTargetLot = await trx.getRepository(BusinaroInventoryLot).save(finalTargetLot);
      }

      await trx.getRepository(BusinaroStockMovement).save({
        inventoryLotId: finalTargetLot.id,
        productId: target.id,
        jobOrderId: dto.jobOrderId,
        delta: String(qty),
        fromStatus: StockStatus.AVAILABLE,
        toStatus: StockStatus.AVAILABLE,
        reason: 'TRANSFORMATION_OUTPUT',
        operatorId,
      });
      
      existingTargetLot = finalTargetLot; // Sync per return
    });

    return { 
      ok: true, 
      sourceLotId: sourceLot.id, 
      targetLotId: existingTargetLot!.id, // Sicuro (!) perché assegnato in transazione
      targetQty: existingTargetLot!.quantity 
    };
  }
}