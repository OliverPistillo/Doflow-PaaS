import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ schema: 'businaro', name: 'warehouses' })
export class BusinaroWarehouse {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  code!: string;

  @Column()
  name!: string;

  @Column({ name: 'is_quarantine', default: false })
  isQuarantine!: boolean;
}
