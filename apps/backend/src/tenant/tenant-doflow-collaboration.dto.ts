import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const COLLABORATION_RECORD_TYPES = [
  'lead', 'customer', 'project', 'activity', 'order', 'quote', 'contract',
  'invoice', 'renewal', 'document', 'builder', 'payment',
] as const;

class CommentAttachmentDto {
  @IsString()
  @MaxLength(500)
  reference!: string;
}

export class CreateCollaborationCommentDto {
  @IsIn(COLLABORATION_RECORD_TYPES)
  recordType!: (typeof COLLABORATION_RECORD_TYPES)[number];

  @IsUUID()
  recordId!: string;

  @IsString()
  @MaxLength(10_000)
  text!: string;

  @IsOptional()
  @IsUUID()
  parentCommentId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  mentionUserIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => CommentAttachmentDto)
  attachments?: CommentAttachmentDto[];
}

export class UpdateCollaborationCommentDto {
  @IsString()
  @MaxLength(10_000)
  text!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  mentionUserIds?: string[];

  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class DeleteCollaborationCommentDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ResolveCollaborationCommentDto {
  @IsBoolean()
  resolved!: boolean;

  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class ToggleCollaborationReactionDto {
  @IsIn(['👍', '❤️', '🎉'])
  emoji!: string;
}
