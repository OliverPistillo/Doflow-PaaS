import { IsPositive, IsString, IsUUID } from 'class-validator';

export class PickItemDto {
  @IsUUID()
  jobOrderId!: string; // OBBLIGATORIO

  @IsString()
  sku!: string;

  @IsPositive()
  quantity!: number;

  // opzionale: specifica lotto se scansionato
  @IsUUID()
  lotId!: string;
}
