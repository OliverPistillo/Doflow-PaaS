const { test } = require('node:test');
const assert = require('node:assert/strict');
const { summarizeConfig, sanitizeLog } = require('../scripts/team-invite-readonly-diagnostics.cjs');

test('configuration output contains presence and validity only, with false TLS and an optional name', () => {
  const summary = summarizeConfig({ MAIL_HOST: 'smtp.example.invalid', MAIL_PORT: '587', MAIL_SECURE: 'false', MAIL_USER: 'sender@example.invalid', MAIL_PASSWORD: 'synthetic-password', FRONTEND_URL: 'https://app.example.invalid', DB_SYNC: 'false' });
  assert.equal(summary.MAIL_SECURE.valid, true);
  assert.equal(summary.MAIL_SECURE.implicit_tls, false);
  assert.equal(summary.MAIL_FROM_NAME.required, false);
  assert.equal(summary.frontend_origin.production_syntax_valid, true);
  assert.equal(summary.DB_SYNC_is_false, true);
  for (const secret of ['sender@example.invalid', 'synthetic-password', 'smtp.example.invalid']) assert.equal(JSON.stringify(summary).includes(secret), false);
});

test('invalid config remains a report, with no startup or network side effects', () => {
  const summary = summarizeConfig({ MAIL_PORT: 'NaN', MAIL_SECURE: 'invalid', FRONTEND_URL: 'http://localhost:3000', SMTP_HOST: 'old-name', MAIL_CONNECTION_TIMEOUT_MS: 'bad' });
  assert.equal(summary.MAIL_PORT.valid, false);
  assert.equal(summary.MAIL_SECURE.valid, false);
  assert.equal(summary.frontend_origin.production_syntax_valid, false);
  assert.equal(summary.deprecated_SMTP_names_present, true);
  assert.equal(summary.timeouts.connection.effective_ms, 10000);
});

test('legacy logs omit recipient, SMTP credentials, URLs, body and raw error fields', () => {
  const result = sanitizeLog('2026-09-12T09:24:34.000Z Invite email failed recipient=private@example.invalid code=EAUTH command=AUTH responseCode=535 message="synthetic-password https://app.example.invalid/accept-invite?token=fake-token email-body"');
  assert.deepEqual(result, { event: 'invite_smtp_failed', timestamp: '2026-09-12T09:24:34.000Z', code: 'EAUTH', response_code: 535 });
});

test('timeout and late outcome remain distinguishable and unrelated telemetry is omitted', () => {
  assert.equal(sanitizeLog('TelemetryService API_PERFORMANCE /api/collaboration'), null);
  assert.deepEqual(sanitizeLog('Team invite phase=application_timeout outcome=unknown duration_ms=15000'), { event: 'team_invite', phase: 'application_timeout', outcome: 'unknown', duration_ms: 15000 });
  assert.deepEqual(sanitizeLog('Team invite phase=smtp_late outcome=accepted'), { event: 'team_invite', phase: 'smtp_late', outcome: 'accepted' });
});
