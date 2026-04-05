import { Column, Entity, ManyToOne, JoinColumn, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { BusinaroWarehouse } from './warehouse.entity';

@Entity({ schema: 'businaro', name: 'locations' })
@Unique(['warehouse', 'code'])
export class BusinaroLocation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => BusinaroWarehouse, { nullable: true })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse!: BusinaroWarehouse | null;

  @Column()
  code!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;
}
