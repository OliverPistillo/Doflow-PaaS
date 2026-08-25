import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { createHmac, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const runtimeConfigPath = path.join(
  root,
  ".visual-runtime",
  "commercial-core-stack.json",
);
const credentialPath = path.join(
  root,
  ".visual-auth",
  "acceptance-credentials.json",
);
const resultPath = path.join(
  root,
  ".visual-runtime",
  "collaboration-acceptance-result.json",
);
const actualDir = path.join(
  root,
  "docs",
  "design-references",
  "doflow-crm-projects",
  "actual",
);
const backendRequire = createRequire(
  path.join(root, "apps/backend/package.json"),
);
const { Client: PgClient } = backendRequire("pg");
type Credentials = { email: string; password: string; mfaSecret: string };
type AppResult = { status: number; ok: boolean; json: any; text: string };

function decodeBase32(value: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const character of value.toUpperCase().replace(/=+$/g, ""))
    bits += alphabet.indexOf(character).toString(2).padStart(5, "0");
  const bytes = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8)
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  return Buffer.from(bytes);
}
function totp(secret: string) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac("sha1", decodeBase32(secret))
    .update(buffer)
    .digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}
async function stableTotp(page: Page, secret: string) {
  const remaining = 30_000 - (Date.now() % 30_000);
  if (remaining < 5_000) await page.waitForTimeout(remaining + 150);
  return totp(secret);
}
async function login(
  context: BrowserContext,
  email: string,
  credentials: Credentials,
  withMfa = false,
) {
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  if (withMfa) {
    await expect(page).toHaveURL(/\/doflow\/mfa$/, { timeout: 20_000 });
    await page
      .getByLabel("Codice di verifica a 6 cifre")
      .fill(await stableTotp(page, credentials.mfaSecret));
    await page.getByRole("button", { name: "Verifica Codice" }).click();
  }
  await expect
    .poll(
      async () => {
        try {
          const result = await appFetch(page, "/auth/me");
          return result.ok ? result.json?.user?.authStage : result.status;
        } catch {
          return "navigation";
        }
      },
      { timeout: 20_000 },
    )
    .toBe("FULL");
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
  return page;
}
async function setTheme(page: Page, theme: "light" | "dark") {
  const expected = theme === "dark";
  const current = await page.evaluate(() =>
    document.documentElement.classList.contains("dark"),
  );
  if (current !== expected)
    await page.getByRole("button", { name: "Cambia tema" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.classList.contains("dark")),
    )
    .toBe(expected);
  // Theme tokens transition after the class flips; capture only the settled palette.
  await page.waitForTimeout(500);
}
async function appFetch(
  page: Page,
  pathname: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<AppResult> {
  return page.evaluate(
    async ({ pathValue, request }) => {
      const method = request.method || "GET";
      const csrf = document.cookie
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith("doflow_csrf="))
        ?.slice("doflow_csrf=".length);
      const headers: Record<string, string> = {
        ...(request.body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
        ...(request.headers || {}),
      };
      if (!["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase()) && csrf)
        headers["X-CSRF-Token"] = decodeURIComponent(csrf);
      const response = await fetch(`/api${pathValue}`, {
        method,
        headers,
        credentials: "include",
        body:
          request.body === undefined ? undefined : JSON.stringify(request.body),
      });
      const text = await response.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        /* retain raw */
      }
      return { status: response.status, ok: response.ok, json, text };
    },
    { pathValue: pathname, request: options },
  );
}
const write = (
  page: Page,
  pathname: string,
  method: "POST" | "PATCH" | "DELETE",
  body: unknown,
  key = randomUUID(),
) =>
  appFetch(page, pathname, {
    method,
    body,
    headers: { "Idempotency-Key": key, "X-Correlation-Id": randomUUID() },
  });
function restartBackend() {
  const result = spawnSync(
    process.execPath,
    [
      path.join(root, "scripts/commercial-core-isolated-stack.mjs"),
      "restart-backend",
    ],
    { cwd: root, encoding: "utf8", windowsHide: true },
  );
  if (result.status !== 0)
    throw new Error(
      `Unable to restart backend: ${result.stderr || result.stdout}`,
    );
}
function restartFrontend() {
  const result = spawnSync(
    process.execPath,
    [
      path.join(root, "scripts/commercial-core-isolated-stack.mjs"),
      "restart-frontend",
    ],
    { cwd: root, encoding: "utf8", windowsHide: true },
  );
  if (result.status !== 0)
    throw new Error(
      `Unable to restart frontend: ${result.stderr || result.stdout}`,
    );
}
function restartRedis() {
  const result = spawnSync(
    process.execPath,
    [
      path.join(root, "scripts/commercial-core-isolated-stack.mjs"),
      "restart-redis",
    ],
    { cwd: root, encoding: "utf8", windowsHide: true },
  );
  if (result.status !== 0)
    throw new Error(
      `Unable to restart Redis: ${result.stderr || result.stdout}`,
    );
}

test("Phase 4A collaboration, notifications and realtime are PostgreSQL-authoritative and tenant-isolated", async ({
  browser,
}) => {
  const config = JSON.parse(await readFile(runtimeConfigPath, "utf8")) as {
    databaseUrl: string;
  };
  const credentials = JSON.parse(
    await readFile(credentialPath, "utf8"),
  ) as Credentials;
  const db = new PgClient({ connectionString: config.databaseUrl });
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const contextC = await browser.newContext();
  let contextA2: BrowserContext | undefined;
  const projectId = randomUUID();
  const companyId = randomUUID();
  const marker = `COLLAB-${Date.now()}`;
  try {
    await db.connect();
    await db.query(
      `INSERT INTO doflow.companies (id, name, status, source, owner_user_id, created_by, updated_by) VALUES ($1,$2,'active_client','acceptance_fixture',$3,$3,$3)`,
      [companyId, `Cliente ${marker}`, "a0000000-0000-4000-8000-000000000001"],
    );
    await db.query(
      `INSERT INTO doflow.projects (id, company_id, name, type, status, priority, project_manager_id, created_by, updated_by) VALUES ($1,$2,$3,'software','in_progress','medium',$4,$4,$4)`,
      [
        projectId,
        companyId,
        `Progetto ${marker}`,
        "a0000000-0000-4000-8000-000000000002",
      ],
    );
    await db.query(
      `INSERT INTO doflow.project_members (project_id, user_id, role, created_by) VALUES ($1,$2,'member',$3)`,
      [
        projectId,
        "a0000000-0000-4000-8000-000000000003",
        "a0000000-0000-4000-8000-000000000001",
      ],
    );
    const owner = await login(contextA, credentials.email, credentials, true);
    const limited = await login(
      contextB,
      "visual.editor@acceptance.invalid",
      credentials,
    );
    const secondary = await login(
      contextC,
      "secondary.owner@acceptance.invalid",
      credentials,
    );
    const assignedProjects = await appFetch(
      limited,
      "/tenant/delivery/projects",
    );
    expect(assignedProjects.ok, assignedProjects.text).toBe(true);
    expect(assignedProjects.json.items.map((item: any) => item.id)).toContain(
      projectId,
    );
    const assignedWorkspace = await appFetch(
      limited,
      `/tenant/delivery/projects/${projectId}`,
    );
    expect(assignedWorkspace.ok, assignedWorkspace.text).toBe(true);
    expect(
      assignedWorkspace.json.members.map((member: any) => member.user_id),
    ).toContain("a0000000-0000-4000-8000-000000000003");
    const unassignedProjectId = randomUUID();
    await db.query(
      `INSERT INTO doflow.projects (id, company_id, name, type, status, priority, project_manager_id, created_by, updated_by) VALUES ($1,$2,$3,'software','in_progress','medium',$4,$4,$4)`,
      [
        unassignedProjectId,
        companyId,
        `Progetto riservato ${marker}`,
        "a0000000-0000-4000-8000-000000000001",
      ],
    );
    expect(
      (
        await appFetch(
          limited,
          `/tenant/doflow/collaboration/comments?recordType=project&recordId=${unassignedProjectId}`,
        )
      ).status,
    ).toBe(404);

    await limited.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const events: any[] = [];
          (window as any).__collaborationEvents = events;
          const socket = new WebSocket("ws://localhost:3401/ws");
          (window as any).__collaborationSocket = socket;
          const timeout = setTimeout(
            () => reject(new Error("websocket hello timeout")),
            15_000,
          );
          socket.onmessage = (message) => {
            const event = JSON.parse(String(message.data));
            events.push(event);
            if (event.type === "hello") {
              clearTimeout(timeout);
              resolve();
            }
          };
          socket.onerror = () => {
            clearTimeout(timeout);
            reject(new Error("websocket connection failed"));
          };
        }),
    );

    await secondary.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const events: any[] = [];
          (window as any).__collaborationEvents = events;
          const socket = new WebSocket("ws://localhost:3401/ws");
          (window as any).__collaborationSocket = socket;
          const timeout = setTimeout(
            () => reject(new Error("secondary websocket hello timeout")),
            15_000,
          );
          socket.onmessage = (message) => {
            const event = JSON.parse(String(message.data));
            events.push(event);
            if (event.type === "hello") {
              clearTimeout(timeout);
              resolve();
            }
          };
          socket.onerror = () => {
            clearTimeout(timeout);
            reject(new Error("secondary websocket connection failed"));
          };
        }),
    );

    const emptyComment = await write(
      owner,
      "/tenant/doflow/collaboration/comments",
      "POST",
      { recordType: "project", recordId: projectId, text: "   " },
    );
    expect(emptyComment.status, emptyComment.text).toBe(400);
    expect(
      (
        await write(owner, "/tenant/doflow/collaboration/comments", "POST", {
          recordType: "project",
          recordId: projectId,
          text: "x".repeat(10_001),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await write(owner, "/tenant/doflow/collaboration/comments", "POST", {
          recordType: "project",
          recordId: projectId,
          parentCommentId: randomUUID(),
          text: "parent inesistente",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await write(owner, "/tenant/doflow/collaboration/comments", "POST", {
          recordType: "project",
          recordId: projectId,
          text: "menzione cross tenant",
          mentionUserIds: ["b0000000-0000-4000-8000-000000000001"],
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await write(owner, "/tenant/doflow/collaboration/comments", "POST", {
          recordType: "project",
          recordId: projectId,
          text: "menzione senza accesso",
          mentionUserIds: ["a0000000-0000-4000-8000-000000000004"],
        })
      ).status,
    ).toBe(400);
    await db.query(`UPDATE doflow.users SET is_active = false WHERE id = $1`, [
      "a0000000-0000-4000-8000-000000000004",
    ]);
    expect(
      (
        await write(owner, "/tenant/doflow/collaboration/comments", "POST", {
          recordType: "project",
          recordId: projectId,
          text: "menzione utente inattivo",
          mentionUserIds: ["a0000000-0000-4000-8000-000000000004"],
        })
      ).status,
    ).toBe(400);
    const xssText = `<img src=x onerror="window.__collaborationXss=true">${marker}`;
    const xssComment = await write(
      owner,
      "/tenant/doflow/collaboration/comments",
      "POST",
      { recordType: "customer", recordId: companyId, text: xssText },
    );
    expect(xssComment.ok, xssComment.text).toBe(true);
    expect(xssComment.json.body).toBe(xssText);
    expect(
      await owner.evaluate(() => (window as any).__collaborationXss),
    ).toBeUndefined();
    expect(
      (
        await write(
          owner,
          `/tenant/doflow/collaboration/comments/${xssComment.json.id}`,
          "DELETE",
          { expectedVersion: 1, reason: "XSS acceptance fixture" },
        )
      ).ok,
    ).toBe(true);

    const createKey = randomUUID();
    const input = {
      recordType: "project",
      recordId: projectId,
      text: `Commento ${marker}`,
      mentionUserIds: [
        "a0000000-0000-4000-8000-000000000003",
        "a0000000-0000-4000-8000-000000000003",
      ],
    };
    const created = await write(
      owner,
      "/tenant/doflow/collaboration/comments",
      "POST",
      input,
      createKey,
    );
    expect(created.ok, created.text).toBe(true);
    expect(created.json.optimistic_version).toBe(1);
    const repeated = await write(
      owner,
      "/tenant/doflow/collaboration/comments",
      "POST",
      input,
      createKey,
    );
    expect(repeated.ok, repeated.text).toBe(true);
    expect(repeated.json.id).toBe(created.json.id);
    const changedPayload = await write(
      owner,
      "/tenant/doflow/collaboration/comments",
      "POST",
      { ...input, text: "payload differente" },
      createKey,
    );
    expect(changedPayload.status).toBe(409);
    await expect
      .poll(() =>
        limited.evaluate(
          () =>
            (window as any).__collaborationEvents.filter(
              (event: any) => event.type === "user_notification",
            ).length,
        ),
      )
      .toBeGreaterThan(0);
    expect(
      await secondary.evaluate(
        ({ expectedProjectId, expectedCommentId, expectedMarker }) =>
          (window as any).__collaborationEvents.filter((event: any) => {
            const payload = JSON.stringify(event);
            return (
              payload.includes(expectedProjectId) ||
              payload.includes(expectedCommentId) ||
              payload.includes(expectedMarker)
            );
          }).length,
        {
          expectedProjectId: projectId,
          expectedCommentId: created.json.id,
          expectedMarker: marker,
        },
      ),
    ).toBe(0);

    const limitedList = await appFetch(
      limited,
      `/tenant/doflow/collaboration/comments?recordType=project&recordId=${projectId}`,
    );
    expect(limitedList.ok, limitedList.text).toBe(true);
    expect(limitedList.json.items).toHaveLength(1);
    const updated = await write(
      owner,
      `/tenant/doflow/collaboration/comments/${created.json.id}`,
      "PATCH",
      {
        text: `Commento aggiornato ${marker}`,
        mentionUserIds: ["a0000000-0000-4000-8000-000000000003"],
        expectedVersion: 1,
      },
    );
    expect(updated.ok, updated.text).toBe(true);
    expect(updated.json.optimistic_version).toBe(2);
    const noOpBefore = (
      await db.query(
        `SELECT
          (SELECT COUNT(*)::int FROM doflow.collaboration_history WHERE comment_id = $1) AS history,
          (SELECT COUNT(*)::int FROM doflow.collaboration_outbox WHERE aggregate_id = $1) AS outbox,
          (SELECT COUNT(*)::int FROM doflow.audit_log WHERE target = $1::text) AS audit`,
        [created.json.id],
      )
    ).rows[0];
    const noOpUpdate = await write(
      owner,
      `/tenant/doflow/collaboration/comments/${created.json.id}`,
      "PATCH",
      {
        text: `Commento aggiornato ${marker}`,
        mentionUserIds: ["a0000000-0000-4000-8000-000000000003"],
        expectedVersion: 2,
      },
    );
    expect(noOpUpdate.ok, noOpUpdate.text).toBe(true);
    expect(noOpUpdate.json.optimistic_version).toBe(2);
    const noOpAfter = (
      await db.query(
        `SELECT
          (SELECT COUNT(*)::int FROM doflow.collaboration_history WHERE comment_id = $1) AS history,
          (SELECT COUNT(*)::int FROM doflow.collaboration_outbox WHERE aggregate_id = $1) AS outbox,
          (SELECT COUNT(*)::int FROM doflow.audit_log WHERE target = $1::text) AS audit`,
        [created.json.id],
      )
    ).rows[0];
    expect(noOpAfter).toEqual(noOpBefore);
    expect(
      (
        await write(
          limited,
          `/tenant/doflow/collaboration/comments/${created.json.id}`,
          "PATCH",
          { text: "modifica di un altro autore", expectedVersion: 2 },
        )
      ).status,
    ).toBe(403);
    const conflict = await write(
      owner,
      `/tenant/doflow/collaboration/comments/${created.json.id}`,
      "PATCH",
      { text: "scrittura stale", expectedVersion: 1 },
    );
    expect(conflict.status).toBe(409);
    const reaction = await write(
      limited,
      `/tenant/doflow/collaboration/comments/${created.json.id}/reactions`,
      "POST",
      { emoji: "👍" },
    );
    expect(reaction.ok, reaction.text).toBe(true);
    expect(reaction.json.reactions[0].user_ids).toContain(
      "a0000000-0000-4000-8000-000000000003",
    );
    const reactionRemoved = await write(
      limited,
      `/tenant/doflow/collaboration/comments/${created.json.id}/reactions`,
      "POST",
      { emoji: "👍" },
    );
    expect(reactionRemoved.ok, reactionRemoved.text).toBe(true);
    expect(
      reactionRemoved.json.reactions.find((item: any) => item.emoji === "👍"),
    ).toBeUndefined();
    const reactionRestored = await write(
      limited,
      `/tenant/doflow/collaboration/comments/${created.json.id}/reactions`,
      "POST",
      { emoji: "👍" },
    );
    expect(reactionRestored.ok, reactionRestored.text).toBe(true);
    expect(
      (
        await write(
          limited,
          `/tenant/doflow/collaboration/comments/${created.json.id}/reactions`,
          "POST",
          { emoji: "arbitrary" },
        )
      ).status,
    ).toBe(400);

    const reply = await write(
      limited,
      "/tenant/doflow/collaboration/comments",
      "POST",
      {
        recordType: "project",
        recordId: projectId,
        parentCommentId: created.json.id,
        text: `Risposta ${marker}`,
      },
    );
    expect(reply.ok, reply.text).toBe(true);
    const resolved = await write(
      owner,
      `/tenant/doflow/collaboration/comments/${created.json.id}/resolve`,
      "PATCH",
      { resolved: true, expectedVersion: 2 },
    );
    expect(resolved.ok, resolved.text).toBe(true);
    expect(resolved.json.optimistic_version).toBe(3);
    const resolvedAgain = await write(
      owner,
      `/tenant/doflow/collaboration/comments/${created.json.id}/resolve`,
      "PATCH",
      { resolved: true, expectedVersion: 3 },
    );
    expect(resolvedAgain.ok, resolvedAgain.text).toBe(true);
    expect(resolvedAgain.json.optimistic_version).toBe(3);
    expect(
      Number(
        (
          await db.query(
            `SELECT COUNT(*)::int AS count FROM doflow.collaboration_history WHERE comment_id = $1 AND event_type = 'comment_resolved'`,
            [created.json.id],
          )
        ).rows[0].count,
      ),
    ).toBe(1);
    const reopened = await write(
      owner,
      `/tenant/doflow/collaboration/comments/${created.json.id}/resolve`,
      "PATCH",
      { resolved: false, expectedVersion: 3 },
    );
    expect(reopened.ok, reopened.text).toBe(true);
    expect(reopened.json.optimistic_version).toBe(4);
    const reopenedAgain = await write(
      owner,
      `/tenant/doflow/collaboration/comments/${created.json.id}/resolve`,
      "PATCH",
      { resolved: false, expectedVersion: 4 },
    );
    expect(reopenedAgain.ok, reopenedAgain.text).toBe(true);
    expect(reopenedAgain.json.optimistic_version).toBe(4);
    expect(
      Number(
        (
          await db.query(
            `SELECT COUNT(*)::int AS count FROM doflow.collaboration_history WHERE comment_id = $1 AND event_type = 'comment_reopened'`,
            [created.json.id],
          )
        ).rows[0].count,
      ),
    ).toBe(1);
    const deletedReply = await write(
      limited,
      `/tenant/doflow/collaboration/comments/${reply.json.id}`,
      "DELETE",
      { expectedVersion: 1, reason: "Rimozione acceptance" },
    );
    expect(deletedReply.ok, deletedReply.text).toBe(true);
    expect(deletedReply.json.is_deleted).toBe(true);
    expect(deletedReply.json.body).toBeNull();
    const deletedReplyAgain = await write(
      limited,
      `/tenant/doflow/collaboration/comments/${reply.json.id}`,
      "DELETE",
      { expectedVersion: 2, reason: "Rimozione acceptance ripetuta" },
    );
    expect(deletedReplyAgain.ok, deletedReplyAgain.text).toBe(true);
    expect(deletedReplyAgain.json.optimistic_version).toBe(2);
    expect(
      (
        await write(
          limited,
          `/tenant/doflow/collaboration/comments/${reply.json.id}/reactions`,
          "POST",
          { emoji: "❤️" },
        )
      ).status,
    ).toBe(404);

    expect(
      (
        await write(owner, "/tenant/doflow/collaboration/comments", "POST", {
          recordType: "project",
          recordId: projectId,
          text: "allegato Data URL vietato",
          attachments: [{ reference: "data:application/pdf;base64,AA==" }],
        })
      ).status,
    ).toBe(400);
    const invalidDocuments = [
      { id: randomUUID(), mime: "application/x-msdownload", size: 10 },
      { id: randomUUID(), mime: "application/pdf", size: 0 },
      { id: randomUUID(), mime: "application/pdf", size: 5_000_001 },
    ];
    for (const invalidDocument of invalidDocuments) {
      await db.query(
        `INSERT INTO doflow.documents
          (id, title, original_filename, mime_type, size_bytes, storage_key, entity_type, entity_id, uploaded_by)
         VALUES ($1, 'invalid acceptance', 'invalid.bin', $2, $3, $4, 'project', $5, $6)`,
        [
          invalidDocument.id,
          invalidDocument.mime,
          invalidDocument.size,
          `acceptance/invalid/${invalidDocument.id}`,
          projectId,
          "a0000000-0000-4000-8000-000000000001",
        ],
      );
      expect(
        (
          await write(owner, "/tenant/doflow/collaboration/comments", "POST", {
            recordType: "project",
            recordId: projectId,
            text: "allegato non valido",
            attachments: [{ reference: `document:${invalidDocument.id}` }],
          })
        ).status,
      ).toBe(400);
    }

    const document = await owner.evaluate(
      async ({ id, tag }) => {
        const csrf =
          document.cookie
            .split(";")
            .map((part) => part.trim())
            .find((part) => part.startsWith("doflow_csrf="))
            ?.split("=")[1] || "";
        const form = new FormData();
        form.append(
          "file",
          new File([`synthetic ${tag}`], `${tag}.pdf`, {
            type: "application/pdf",
          }),
        );
        form.append("title", `${tag}.pdf`);
        form.append("category", "generic");
        form.append("visibility", "internal");
        form.append("entity_type", "project");
        form.append("entity_id", id);
        const response = await fetch("/api/tenant/documents/upload", {
          method: "POST",
          headers: { "X-CSRF-Token": decodeURIComponent(csrf) },
          credentials: "include",
          body: form,
        });
        return { status: response.status, json: await response.json() };
      },
      { id: projectId, tag: marker },
    );
    expect(document.status).toBe(201);
    const withAttachment = await write(
      owner,
      "/tenant/doflow/collaboration/comments",
      "POST",
      {
        recordType: "project",
        recordId: projectId,
        text: `Allegato ${marker}`,
        attachments: [{ reference: `document:${document.json.id}` }],
      },
    );
    expect(withAttachment.ok, withAttachment.text).toBe(true);
    expect(withAttachment.json.attachments).toHaveLength(1);
    const access = await appFetch(
      owner,
      `/tenant/doflow/collaboration/attachments/${withAttachment.json.attachments[0].id}/access`,
      { method: "POST" },
    );
    expect(access.ok, access.text).toBe(true);
    expect(
      (
        await appFetch(
          secondary,
          `/tenant/doflow/collaboration/attachments/${withAttachment.json.attachments[0].id}/access`,
          { method: "POST" },
        )
      ).status,
    ).toBe(403);
    expect(
      await limited.evaluate(
        async (url) => (await fetch(url, { credentials: "include" })).status,
        access.json.url,
      ),
    ).toBe(404);
    const firstDownload = await owner.evaluate(
      async (url) => (await fetch(url, { credentials: "include" })).status,
      access.json.url,
    );
    const secondDownload = await owner.evaluate(
      async (url) => (await fetch(url, { credentials: "include" })).status,
      access.json.url,
    );
    expect(firstDownload).toBe(200);
    expect(secondDownload).toBe(404);

    const notifications = await appFetch(
      limited,
      "/tenant/notifications?type=comment_mention",
    );
    expect(notifications.ok, notifications.text).toBe(true);
    const matchingNotifications = notifications.json.items.filter(
      (item: any) => item.comment_id === created.json.id,
    );
    expect(matchingNotifications).toHaveLength(1);
    const notification = matchingNotifications[0];
    expect(notification.link_url).toContain(`commentId=${created.json.id}`);
    const summary = await appFetch(limited, "/tenant/notifications/summary");
    expect(summary.json.unreadNotifications).toBeGreaterThanOrEqual(1);
    const invalidCsrf = await limited.evaluate(async () => {
      const response = await fetch("/api/tenant/notifications/preferences", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": "invalid",
        },
        credentials: "include",
        body: JSON.stringify({ daily_digest_enabled: false }),
      });
      return response.status;
    });
    expect(invalidCsrf).toBe(401);
    expect(
      (
        await appFetch(
          limited,
          `/tenant/notifications/${notification.id}/read`,
          { method: "PATCH" },
        )
      ).ok,
    ).toBe(true);
    const readSummary = await appFetch(
      limited,
      "/tenant/notifications/summary",
    );
    expect(readSummary.json.unreadNotifications).toBeLessThan(
      summary.json.unreadNotifications,
    );
    expect(
      (
        await appFetch(limited, "/tenant/notifications/preferences", {
          method: "PATCH",
          body: {
            muted_types: ["system"],
            daily_digest_enabled: false,
            digest_time: "09:15",
          },
        })
      ).ok,
    ).toBe(true);
    await mkdir(actualDir, { recursive: true });
    await limited.setViewportSize({ width: 1440, height: 900 });
    await limited.goto(notification.link_url);
    await expect(
      limited.locator('main[data-app-shell-ready="true"]').first(),
    ).toHaveAttribute("data-workspace-ready", "true", { timeout: 20_000 });
    await expect(limited.getByText("Attività e collaborazione")).toBeVisible();
    await expect(limited.locator(`#comment-${created.json.id}`)).toBeVisible();
    await limited.screenshot({
      path: path.join(actualDir, "phase4a-collaboration-project-1440x900.png"),
    });
    await limited.setViewportSize({ width: 768, height: 900 });
    await limited.screenshot({
      path: path.join(actualDir, "phase4a-collaboration-project-768x900.png"),
    });
    await limited.setViewportSize({ width: 390, height: 900 });
    await limited.screenshot({
      path: path.join(actualDir, "phase4a-collaboration-project-390x900.png"),
    });
    await limited.goto("/dashboard/notifiche");
    await expect(
      limited.getByRole("heading", { name: "Notifiche" }),
    ).toBeVisible();
    await setTheme(limited, "light");
    await limited.screenshot({
      path: path.join(actualDir, "phase4a-notifications-390x900-light.png"),
      fullPage: true,
    });
    await setTheme(limited, "dark");
    await limited.screenshot({
      path: path.join(actualDir, "phase4a-notifications-390x900-dark.png"),
      fullPage: true,
    });
    for (const width of [768, 1440]) {
      await limited.setViewportSize({ width, height: 900 });
      await setTheme(limited, "light");
      await limited.screenshot({
        path: path.join(
          actualDir,
          `phase4a-notifications-${width}x900-light.png`,
        ),
        fullPage: true,
      });
      await setTheme(limited, "dark");
      await limited.screenshot({
        path: path.join(
          actualDir,
          `phase4a-notifications-${width}x900-dark.png`,
        ),
        fullPage: true,
      });
    }

    const crossTenant = await appFetch(
      secondary,
      `/tenant/doflow/collaboration/comments?recordType=project&recordId=${projectId}`,
    );
    expect(crossTenant.status).toBe(403);
    const spoofed = await appFetch(
      secondary,
      `/tenant/doflow/collaboration/comments?recordType=project&recordId=${projectId}&tenant=doflow`,
      { headers: { "X-Tenant-Id": "doflow" } },
    );
    expect(spoofed.status).toBe(403);
    expect(
      (await appFetch(secondary, "/tenant/notifications")).json.items,
    ).toHaveLength(0);
    restartRedis();
    const persistedAfterRedisRestart = await appFetch(
      owner,
      `/tenant/doflow/collaboration/comments?recordType=project&recordId=${projectId}`,
    );
    expect(persistedAfterRedisRestart.ok, persistedAfterRedisRestart.text).toBe(
      true,
    );
    restartBackend();
    await expect
      .poll(
        async () => {
          try {
            return (await fetch("http://localhost:3401/api/health/system"))
              .status;
          } catch {
            return 0;
          }
        },
        { timeout: 120_000 },
      )
      .toBe(200);
    await limited.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const events: any[] = (window as any).__collaborationEvents || [];
          (window as any).__collaborationEvents = events;
          const socket = new WebSocket("ws://localhost:3401/ws");
          (window as any).__collaborationSocket = socket;
          const timeout = setTimeout(
            () => reject(new Error("websocket reconnect timeout")),
            15_000,
          );
          socket.onmessage = (message) => {
            const event = JSON.parse(String(message.data));
            events.push(event);
            if (event.type === "hello") {
              clearTimeout(timeout);
              resolve();
            }
          };
          socket.onerror = () => {
            clearTimeout(timeout);
            reject(new Error("websocket reconnect failed"));
          };
        }),
    );
    expect(
      await limited.evaluate(
        () =>
          (window as any).__collaborationEvents.filter(
            (event: any) => event.type === "user_notification",
          ).length,
      ),
    ).toBe(0);
    const notificationsAfterReconnect = await appFetch(
      limited,
      "/tenant/notifications?type=comment_mention",
    );
    expect(
      notificationsAfterReconnect.json.items.filter(
        (item: any) => item.comment_id === created.json.id,
      ),
    ).toHaveLength(1);
    restartFrontend();
    contextA2 = await browser.newContext();
    const ownerAgain = await login(
      contextA2,
      credentials.email,
      credentials,
      true,
    );
    const persisted = await appFetch(
      ownerAgain,
      `/tenant/doflow/collaboration/comments?recordType=project&recordId=${projectId}`,
    );
    expect(persisted.ok, persisted.text).toBe(true);
    expect(persisted.json.items.map((item: any) => item.id)).toContain(
      created.json.id,
    );
    const storageKeys = await ownerAgain.evaluate(() =>
      Object.keys(localStorage).filter((key) =>
        /comment|notification|collaboration/i.test(key),
      ),
    );
    expect(storageKeys).toEqual([]);
    expect(
      (await appFetch(ownerAgain, "/auth/logout", { method: "POST" })).ok,
    ).toBe(true);
    expect(
      (
        await appFetch(
          ownerAgain,
          `/tenant/doflow/collaboration/comments?recordType=project&recordId=${projectId}`,
        )
      ).status,
    ).toBe(401);

    const proof = (
      await db.query(
        `SELECT
      (SELECT COUNT(*)::int FROM doflow.record_comments WHERE record_id = $1) AS comments,
      (SELECT COUNT(*)::int FROM doflow.collaboration_history WHERE record_id = $1) AS history,
      (SELECT COUNT(*)::int FROM doflow.collaboration_idempotency WHERE scope LIKE '%comment%') AS idempotency,
      (SELECT COUNT(*)::int FROM doflow.collaboration_outbox WHERE aggregate_id = $2) AS outbox,
      (SELECT COUNT(*)::int FROM doflow.audit_log WHERE metadata->>'recordId' = $1::text) AS audit,
      (SELECT COUNT(*)::int FROM doflow.notifications WHERE recipient_user_id = $3 AND comment_id = $2) AS notifications`,
        [projectId, created.json.id, "a0000000-0000-4000-8000-000000000003"],
      )
    ).rows[0];
    expect(Number(proof.comments)).toBe(3);
    expect(Number(proof.history)).toBeGreaterThanOrEqual(7);
    expect(Number(proof.idempotency)).toBeGreaterThanOrEqual(8);
    expect(Number(proof.outbox)).toBeGreaterThanOrEqual(3);
    expect(Number(proof.audit)).toBeGreaterThanOrEqual(5);
    expect(Number(proof.notifications)).toBe(1);
    await writeFile(
      resultPath,
      JSON.stringify({
        marker,
        projectId,
        commentId: created.json.id,
        proof,
        contexts: 3,
        realtime: true,
        redisRestart: true,
        backendRestart: true,
        frontendRestart: true,
        sessionRevocation: true,
        deepLink: true,
        attachmentOneTime: true,
      }),
      { mode: 0o600 },
    );
  } finally {
    await Promise.allSettled([
      contextA.close(),
      contextB.close(),
      contextC.close(),
      contextA2?.close(),
    ]);
    await db.end().catch(() => undefined);
  }
});
