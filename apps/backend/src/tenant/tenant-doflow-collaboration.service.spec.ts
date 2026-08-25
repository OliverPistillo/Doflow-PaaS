import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { TenantDoflowCollaborationService } from "./tenant-doflow-collaboration.service";

jest.mock("./tenant-doflow-collaboration-schema", () => ({
  ensureDoflowCollaborationTables: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("./tenant-doflow-workspace.service", () => ({
  DOFLOW_ROLE_CAPABILITIES: {},
  ensureDoflowWorkspaceTables: jest.fn().mockResolvedValue(undefined),
}));

describe("TenantDoflowCollaborationService", () => {
  const userId = "11111111-1111-4111-8111-111111111111";

  function request(tenantId = "doflow") {
    return {
      user: {
        sub: userId,
        email: "owner@example.test",
        role: "owner",
        tenantId,
      },
    };
  }

  it("nega la collaborazione fuori dal tenant doflow", async () => {
    const service = new TenantDoflowCollaborationService(
      { query: jest.fn() } as any,
      request("altro"),
    );
    await expect(
      service.listComments({ recordType: "project", recordId: userId }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("accetta per i commenti soltanto riferimenti a documenti reali", async () => {
    const service = new TenantDoflowCollaborationService(
      { query: jest.fn() } as any,
      request(),
    );
    await expect(
      (service as any).replaceMentionsAndAttachments(
        { query: jest.fn() },
        {
          id: userId,
          email: "owner@example.test",
          role: "owner",
          schema: "doflow",
        },
        "22222222-2222-4222-8222-222222222222",
        {
          attachments: [
            {
              name: "falso.pdf",
              size: 10,
              reference: "data:application/pdf;base64,AA==",
            },
          ],
        },
        true,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
