export function buildInviteEmail(params: {
  tenantName: string;
  inviteLink: string;
}) {
  const subject = `Sei stato invitato su ${params.tenantName} – Doflow`;
  const html = `
  <div style="font-family:system-ui,sans-serif;font-size:14px;color:#111;padding:24px">
    <h1 style="font-size:20px;margin-bottom:12px;">Invito su ${params.tenantName}</h1>
    <p style="margin-bottom:12px;">
      Hai ricevuto un invito per accedere allo spazio di lavoro <strong>${params.tenantName}</strong> su Doflow.
    </p>
    <p style="margin-bottom:12px;">
      Clicca sul pulsante qui sotto per accettare l'invito e completare la registrazione:
    </p>
    <p style="margin:24px 0;">
      <a href="${params.inviteLink}"
         style="background:#111;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">
        Accetta invito
      </a>
    </p>
    <p style="font-size:12px;color:#666;">
      Se il pulsante non funziona, copia e incolla questo link nel browser:<br/>
      <span style="word-break:break-all;">${params.inviteLink}</span>
    </p>
  </div>
  `;
  return { subject, html };
}

export function buildPasswordResetEmail(params: {
  resetLink: string;
}) {
  const subject = `Reimposta la tua password Doflow`;
  const html = `
  <div style="font-family:system-ui,sans-serif;font-size:14px;color:#111;padding:24px">
    <h1 style="font-size:20px;margin-bottom:12px;">Reimposta la password</h1>
    <p style="margin-bottom:12px;">
      Hai richiesto la reimpostazione della password per il tuo account Doflow.
    </p>
    <p style="margin-bottom:12px;">
      Clicca sul pulsante qui sotto per scegliere una nuova password. Il link è valido per 15 minuti.
    </p>
    <p style="margin:24px 0;">
      <a href="${params.resetLink}"
         style="background:#111;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">
        Reimposta password
      </a>
    </p>
    <p style="font-size:12px;color:#666;">
      Se non hai richiesto tu questa operazione, puoi ignorare questa email.
    </p>
  </div>
  `;
  return { subject, html };
}
