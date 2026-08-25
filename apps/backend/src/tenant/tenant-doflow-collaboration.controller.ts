import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import {
  CreateCollaborationCommentDto,
  DeleteCollaborationCommentDto,
  ResolveCollaborationCommentDto,
  ToggleCollaborationReactionDto,
  UpdateCollaborationCommentDto,
} from "./tenant-doflow-collaboration.dto";
import { TenantDoflowCollaborationService } from "./tenant-doflow-collaboration.service";
import { TenantDocumentsService } from "./tenant-documents.service";

@Controller("tenant/doflow/collaboration")
@UseGuards(JwtAuthGuard)
export class TenantDoflowCollaborationController {
  constructor(
    private readonly service: TenantDoflowCollaborationService,
    private readonly documents: TenantDocumentsService,
  ) {}

  @Get("comments")
  comments(@Query() query: Record<string, unknown>) {
    return this.service.listComments(query || {});
  }

  @Post("comments")
  createComment(
    @Body() body: CreateCollaborationCommentDto,
    @Headers("idempotency-key") idempotencyKey?: string,
    @Headers("x-correlation-id") correlationId?: string,
  ) {
    return this.service.createComment(body, idempotencyKey, correlationId);
  }

  @Patch("comments/:id")
  updateComment(
    @Param("id") id: string,
    @Body() body: UpdateCollaborationCommentDto,
    @Headers("idempotency-key") idempotencyKey?: string,
    @Headers("x-correlation-id") correlationId?: string,
  ) {
    return this.service.updateComment(id, body, idempotencyKey, correlationId);
  }

  @Delete("comments/:id")
  deleteComment(
    @Param("id") id: string,
    @Body() body: DeleteCollaborationCommentDto,
    @Headers("idempotency-key") idempotencyKey?: string,
    @Headers("x-correlation-id") correlationId?: string,
  ) {
    return this.service.deleteComment(id, body, idempotencyKey, correlationId);
  }

  @Patch("comments/:id/resolve")
  resolveComment(
    @Param("id") id: string,
    @Body() body: ResolveCollaborationCommentDto,
    @Headers("idempotency-key") idempotencyKey?: string,
    @Headers("x-correlation-id") correlationId?: string,
  ) {
    return this.service.resolveComment(id, body, idempotencyKey, correlationId);
  }

  @Post("comments/:id/reactions")
  reaction(
    @Param("id") id: string,
    @Body() body: ToggleCollaborationReactionDto,
    @Headers("idempotency-key") idempotencyKey?: string,
    @Headers("x-correlation-id") correlationId?: string,
  ) {
    return this.service.toggleReaction(
      id,
      body.emoji,
      idempotencyKey,
      correlationId,
    );
  }

  @Get("comments/:id/history")
  history(@Param("id") id: string) {
    return this.service.listCommentHistory(id);
  }

  @Post("attachments/:id/access")
  attachmentAccess(@Param("id") id: string) {
    return this.service.createAttachmentAccess(id);
  }

  @Get("attachments/access/:token")
  async downloadAttachment(
    @Param("token") token: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const access = await this.service.resolveAttachmentAccess(token);
    const result = await this.documents.downloadDocument(access.documentId);
    res.set({
      "Content-Type": result.contentType || "application/octet-stream",
      "Content-Length": result.contentLength,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(result.filename)}"`,
      "Cache-Control": "private, no-store",
    });
    return new StreamableFile(result.stream);
  }

  @Get("audit")
  audit(@Query() query: Record<string, unknown>) {
    return this.service.listRecordAudit(query || {});
  }
}
