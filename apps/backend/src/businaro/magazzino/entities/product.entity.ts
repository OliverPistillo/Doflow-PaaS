import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ProductType } from '../../common/enums';

@Entity({ schema: 'businaro', name: 'products' })
export class BusinaroProduct {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  sku!: string;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'enum', enum: ProductType })
  type!: ProductType;

  @Column({ default: 'PZ' })
  uom!: string;

  @Column({ name: 'min_stock_level', type: 'int', default: 0 })
  minStockLevel!: number;
}
