import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { StockStatus } from '../../common/enums';

@Entity({ schema: 'businaro', name: 'stock_movements' })
export class BusinaroStockMovement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'inventory_lot_id', type: 'uuid', nullable: true })
  inventoryLotId!: string | null;

  @Column({ name: 'product_id', type: 'uuid', nullable: true })
  productId!: string | null;

  @Column({ name: 'job_order_id', type: 'uuid', nullable: true })
  jobOrderId!: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 4 })
  delta!: string;

  @Column({ name: 'from_status', type: 'enum', enum: StockStatus, nullable: true })
  fromStatus!: StockStatus | null;

  @Column({ name: 'to_status', type: 'enum', enum: StockStatus, nullable: true })
  toStatus!: StockStatus | null;

  @Column()
  reason!: string;

  @Column({ name: 'operator_id', type: 'uuid', nullable: true })
  operatorId!: string | null;

  @Column({ name: 'occurred_at', type: 'timestamptz', default: () => 'NOW()' })
  occurredAt!: Date;
}
