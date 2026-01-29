import { IsEnum, IsPositive, IsString, IsUUID } from 'class-validator';
import { ConditionGrade } from '../../common/enums';

export class QuarantineInDto {
  @IsString()
  sku!: string;

  @IsPositive()
  quantity!: number;

  @IsEnum(ConditionGrade)
  condition!: ConditionGrade;

  @IsUUID()
  lotId!: string;
}

export class QuarantineDecisionDto {
  @IsUUID()
  lotId!: string;

  // APPROVE => AVAILABLE, REJECT => SCRAP
  @IsString()
  decision!: 'APPROVE' | 'REJECT';
}
