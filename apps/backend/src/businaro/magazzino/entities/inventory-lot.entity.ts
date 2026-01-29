import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { StockStatus, ConditionGrade } from '../../common/enums';
import { BusinaroProduct } from './product.entity';
import { BusinaroLocation } from './location.entity';

@Entity({ schema: 'businaro', name: 'inventory_lots' })
@Unique(['product', 'location', 'batchNumber', 'serialNumber', 'status', 'condition'])
export class BusinaroInventoryLot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => BusinaroProduct)
  @JoinColumn({ name: 'product_id' })
  product!: BusinaroProduct;

  @ManyToOne(() => BusinaroLocation)
  @JoinColumn({ name: 'location_id' })
  location!: BusinaroLocation;

  @Column({ name: 'batch_number', nullable: true })
  batchNumber!: string | null;

  @Column({ name: 'serial_number', nullable: true })
  serialNumber!: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 4, default: 0 })
  quantity!: string; // TypeORM su numeric spesso usa string

  @Column({ type: 'enum', enum: StockStatus, default: StockStatus.AVAILABLE })
  status!: StockStatus;

  @Column({ type: 'enum', enum: ConditionGrade, default: ConditionGrade.NEW })
  condition!: ConditionGrade;
}
