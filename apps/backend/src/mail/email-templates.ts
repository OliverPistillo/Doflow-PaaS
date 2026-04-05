// ─── Base layout ─────────────────────────────────────────────────────────────

function wrapInLayout(title: string, body: string): string {
  return `
  <div style="font-family:system-ui,sans-serif;font-size:14px;color:#111;
              max-width:600px;margin:0 auto;padding:32px;
              border:1px solid #eee;border-radius:10px;background:#fff;">
    <div style="margin-bottom:24px;">
      <span style="font-size:22px;font-weight:700;color:#4f46e5;">DoFlow</span>
    </div>
    <h1 style="font-size:20px;margin:0 0 16px;">${title}</h1>
    ${body}
    <hr style="border:none;border-top:1px solid #eee;margin:32px 0 16px;" />
    <p style="font-size:11px;color:#999;text-align:center;margin:0;">
      Team DoFlow · <a href="https://app.doflow.it" style="color:#4f46e5;">app.doflow.it</a>
    </p>
  </div>
  `;
}

function ctaButton(label: string, href: string): string {
  return `
  <p style="margin:24px 0;">
    <a href="${href}"
       style="background:#4f46e5;color:#fff;padding:11px 20px;
              border-radius:6px;text-decoration:none;font-weight:600;
              display:inline-block;">
      ${label}
    </a>
  </p>
  `;
}

function credentialsBox(fields: Record<string, string>): string {
  const rows = Object.entries(fields)
    .map(
      ([k, v]) =>
        `<tr>
           <td style="padding:6px 12px 6px 0;font-weight:600;white-space:nowrap;">${k}</td>
           <td style="padding:6px 0;"><code style="background:#eef2ff;padding:2px 8px;
                border-radius:4px;color:#4338ca;">${v}</code></td>
         </tr>`,
    )
    .join('');

  return `
  <table style="background:#f9fafb;border-radius:8px;padding:14px 16px;
                margin:20px 0;border-collapse:collapse;width:100%;">
    ${rows}
  </table>
  `;
}

// ─── Template: Invito ─────────────────────────────────────────────────────────

export function buildInviteEmail(params: {
  tenantName: string;
  inviteLink: string;
}) {
  const subject = `Sei stato invitato su ${params.tenantName} – Doflow`;
  const html = wrapInLayout(
    `Invito su ${params.tenantName}`,
    `<p>Hai ricevuto un invito per accedere allo spazio di lavoro
       <strong>${params.tenantName}</strong> su Doflow.</p>
     <p>Clicca sul pulsante per accettare l'invito e completare la registrazione:</p>
     ${ctaButton('Accetta invito', params.inviteLink)}
     <p style="font-size:12px;color:#666;">
       Se il pulsante non funziona, copia questo link:<br/>
       <span style="word-break:break-all;">${params.inviteLink}</span>
     </p>`,
  );
  return { subject, html };
}

// ─── Template: Reset Password (utente) ───────────────────────────────────────

export function buildPasswordResetEmail(params: { resetLink: string }) {
  const subject = `Reimposta la tua password Doflow`;
  const html = wrapInLayout(
    'Reimposta la password',
    `<p>Hai richiesto la reimpostazione della password per il tuo account Doflow.</p>
     <p>Il link è valido per <strong>15 minuti</strong>.</p>
     ${ctaButton('Reimposta password', params.resetLink)}
     <p style="font-size:12px;color:#666;">
       Se non hai richiesto questa operazione, puoi ignorare questa email.
     </p>`,
  );
  return { subject, html };
}

// ─── Template: Benvenuto nuovo Tenant (Superadmin → Admin tenant) ─────────────

export function buildWelcomeEmail(params: {
  tenantName: string;
  loginUrl: string;
  email: string;
  tempPassword: string;
}) {
  const subject = `Benvenuto in DoFlow – Il tuo spazio "${params.tenantName}" è pronto 🚀`;
  const html = wrapInLayout(
    `Il tuo spazio "${params.tenantName}" è pronto!`,
    `<p>Ciao,</p>
     <p>Lo spazio di lavoro <strong>${params.tenantName}</strong> è stato configurato con successo.</p>
     <p>Usa le credenziali qui sotto per accedere:</p>
     ${credentialsBox({
       'URL Accesso': params.loginUrl,
       'Username':    params.email,
       'Password':    params.tempPassword,
     })}
     <p style="font-size:13px;color:#c00;font-weight:600;">
       ⚠️ Cambia la password al primo accesso.
     </p>
     ${ctaButton('Accedi a DoFlow', params.loginUrl)}`,
  );

  const text =
    `Benvenuto in DoFlow!\n\n` +
    `Il tuo spazio "${params.tenantName}" è pronto.\n\n` +
    `Accesso: ${params.loginUrl}\n` +
    `Username: ${params.email}\n` +
    `Password: ${params.tempPassword}\n\n` +
    `Cambia la password al primo accesso.`;

  return { subject, html, text };
}

// ─── Template: Reset Password (azione Superadmin) ─────────────────────────────

export function buildPasswordResetAdminEmail(params: {
  email: string;
  tenantName: string;
  newPassword: string;
  loginUrl: string;
}) {
  const subject = `[DoFlow] Password reimpostata per ${params.tenantName}`;
  const html = wrapInLayout(
    'La tua password è stata reimpostata',
    `<p>Il team DoFlow ha reimpostato la password del tuo account su
       <strong>${params.tenantName}</strong>.</p>
     <p>Usa le seguenti credenziali per accedere:</p>
     ${credentialsBox({
       'Username':         params.email,
       'Nuova Password':   params.newPassword,
     })}
     <p style="font-size:13px;color:#c00;font-weight:600;">
       ⚠️ Cambia subito la password dopo l'accesso.
     </p>
     ${ctaButton('Accedi ora', params.loginUrl)}`,
  );

  const text =
    `La tua password su DoFlow (${params.tenantName}) è stata reimpostata.\n\n` +
    `Username: ${params.email}\n` +
    `Nuova password: ${params.newPassword}\n\n` +
    `Accedi su: ${params.loginUrl}\n` +
    `Cambia la password subito dopo l'accesso.`;

  return { subject, html, text };
}
