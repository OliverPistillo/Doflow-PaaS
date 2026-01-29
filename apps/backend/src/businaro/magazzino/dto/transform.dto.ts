import { IsPositive, IsString, IsUUID } from 'class-validator';

export class TransformDto {
  @IsUUID()
  jobOrderId!: string;

  @IsString()
  sourceSku!: string;

  @IsString()
  targetSku!: string;

  @IsPositive()
  quantity!: number;

  // opzionale: lotto specifico input
  @IsUUID()
  sourceLotId!: string;
}
