# Doflow Calls — architettura e configurazione

## Stato e perimetro

Doflow Calls 1.1 introduce chiamate LiveKit **Desktop-first** senza duplicare il gestionale. La webapp autenticata rimane la UI condivisa per team e CRM, ma le azioni di chiamata interna vengono renderizzate soltanto quando è presente il bridge nativo Doflow Desktop v2 e il backend conferma feature, provider e permessi.

La route pubblica `/meeting` serve esclusivamente il pre-join guest. Non è Client Portal, non crea un account, non riceve una sessione CRM e non espone dati tenant. Client Portal, Builder/Site Proposals e Flow Arcade non fanno parte di questo modulo.

Sono inclusi:

- chiamate audio/video interne 1:1 tra client Desktop online;
- incoming window, notifica Windows di richiamo, tray e finestra chiamata dedicata;
- mute, camera, device selection, output audio quando supportato e screen sharing;
- reconnect LiveKit, timeout, busy e stati terminali distinti;
- link guest monouso, a scadenza e revocabili;
- proiezione idempotente dell’esito in `commercial_activities` quando la timeline CRM esiste;
- contesto opzionale company, contact, opportunity o project, autorizzato server-side.

Non sono inclusi SIP/PSTN, trunk telefonici, registrazione, trascrizione, riassunti AI o telemetria dei contenuti media.

## Flusso autorevole

```text
Webapp in Doflow Desktop
  -> handshake bridge v2 + capabilities native
  -> API tenant autenticata + permission + collab.calls
  -> sessione e state machine nello schema PostgreSQL del tenant
  -> evento sul WebSocket Doflow esistente
  -> incoming/call window Tauri
  -> token breve e room-scoped emesso dal backend
  -> LiveKit WebRTC

Guest browser
  -> /meeting#invite=<bearer opaco>
  -> il client rimuove subito il fragment dalla barra indirizzi
  -> resolve/consume pubblico rate-limited
  -> token guest limitato alla sola room server-side
  -> LiveKit WebRTC
```

Il database è la fonte di verità. Gli eventi realtime svegliano i client, ma dopo reconnect il Desktop recupera le chiamate `ringing` dall’API. Tenant, attore, room, identity e token non sono selezionabili dal client.

## Configurazione

Variabili backend, senza valori reali nel repository:

| Variabile | Scopo |
| --- | --- |
| `LIVEKIT_ENABLED` | master gate del provider |
| `DESKTOP_CALLS_ENABLED` | master gate applicativo Desktop Calls |
| `DESKTOP_CALLS_GUEST_ENABLED` | abilita la creazione dei meeting guest |
| `LIVEKIT_URL` | URL `wss://` del deployment LiveKit |
| `LIVEKIT_API_KEY` | API key server-side |
| `LIVEKIT_API_SECRET` | API secret server-side e verifica webhook ufficiale |
| `DESKTOP_CALLS_PUBLIC_MEETING_URL` | URL pubblico della route meeting, senza token |
| `LIVEKIT_TOKEN_TTL_SECONDS` | TTL token, clamp `60..900`, default `300` |
| `DESKTOP_CALL_RING_TIMEOUT_SECONDS` | ringing, clamp `15..120`, default `45` |
| `DESKTOP_CALL_CONNECT_TIMEOUT_SECONDS` | accepted/connecting, clamp `30..300`, default `90` |
| `DESKTOP_CALL_GUEST_TTL_SECONDS` | invito guest, clamp `300..86400`, default `3600` |
| `DESKTOP_CALL_MAXIMUM_SECONDS` | durata massima autoritativa, clamp `300..43200`, default `14400` |

La feature è disponibile soltanto se:

1. entrambi i master gate sono `true`;
2. URL, API key e API secret sono presenti;
3. il tenant ha una subscription `collab.calls` `ACTIVE` o `TRIAL` valida;
4. l’utente ha `canUseDesktopCalls`; per i link guest serve anche `canCreateGuestMeetings`;
5. il profilo mantiene un heartbeat Doflow Desktop valido.

La mancanza di provider o rollout non impedisce l’avvio di frontend/backend: gli endpoint falliscono in modo controllato e le azioni restano assenti.

Il runtime nativo accetta endpoint media soltanto su `wss://` sotto `*.doflow.it` o `*.livekit.cloud`; per lo sviluppo locale sono ammessi esclusivamente `ws://localhost` e gli indirizzi loopback. Un deployment LiveKit su un dominio diverso richiede quindi un aggiornamento esplicito e revisionato dell'allowlist Desktop, non un URL arbitrario fornito dal client.

## Database e migration

La migration `1880000000000-CreateDesktopCallsAuthority` è additiva e materializza per ogni schema tenant registrato:

- `tenant_call_sessions`;
- `tenant_call_user_locks` per una sola chiamata non terminale per utente;
- `tenant_call_guest_invites` (solo digest del bearer e della sessione guest);
- `tenant_call_webhook_events` per dedupe;
- `tenant_call_activities` per la proiezione idempotente;
- `tenant_call_audit`.

Lo schema `public` contiene soltanto indici opachi room/invite -> schema/call. Non contiene token raw né dati CRM. La migration non crea tabelle CRM mancanti: aggiunge le colonne di proiezione solo se `commercial_activities` esiste. `down` è intenzionalmente non distruttivo perché call audit, revoche e risultati sono record autorevoli.

In produzione mantenere `DB_SYNC=false` e usare il migration runner tracciato. Non eseguire SQL manuale per abilitare la feature.

## State machine e idempotenza

Percorso normale:

```text
created -> ringing -> accepted -> connecting -> active -> ended
```

Esiti alternativi: `rejected`, `cancelled`, `missed`, `busy`, `failed`. Le transizioni sono validate in una transazione con row lock; soltanto il callee può accettare/rifiutare e soltanto il caller può annullare. `accepted_device_id` garantisce un solo vincitore tra dispositivi. Advisory lock e `tenant_call_user_locks` impediscono più chiamate simultanee.

Gli eventi webhook hanno una chiave unica; la timeline ha una riga di dedupe per call. La durata deriva esclusivamente da `started_at` e `ended_at` server-side.

## Sicurezza e privacy

- sessione e schema derivano dall’auth corrente; override di tenant, attore, room e token sono rifiutati;
- lookup di utenti e CRM resta nello schema validato con query parametrizzate;
- i token LiveKit hanno TTL breve, `roomJoin` per una sola room opaca e nessun grant room-create;
- identity LiveKit interne sono hash tenant/user; i secret non raggiungono frontend o Tauri;
- credenziali call vivono soltanto nel `CallManager` nativo e vengono rimosse al termine;
- i bearer guest sono casuali, memorizzati come SHA-256, monouso, revocabili e scadono;
- la pagina meeting usa `no-store`, `Referrer-Policy: no-referrer`, `noindex` e `credentials: omit`;
- il webhook usa il raw body e `WebhookReceiver` dell’SDK ufficiale;
- notification body e audit non includono token o contenuti audio/video;
- nessuna registrazione e nessun media payload viene persistito.

La versione ufficiale del plugin Tauri in uso espone notifiche Windows come richiamo, ma non garantisce callback portabili per azioni native Rispondi/Rifiuta. Le azioni autorevoli restano quindi nella finestra incoming compatta, sempre focalizzata durante il ringing; non viene simulato un supporto notification-action inesistente.

## Sviluppo locale

1. Installare le dipendenze con il lockfile (`pnpm install --frozen-lockfile`).
2. Configurare un LiveKit di sviluppo e le sole variabili sopra in un file non versionato.
3. Applicare la migration sul database locale e attivare `collab.calls` per un tenant sintetico.
4. Avviare backend e frontend con i comandi del repository.
5. Avviare due client Doflow Desktop con due utenti dello stesso tenant.
6. Configurare il webhook LiveKit verso `POST /api/public/desktop-calls/webhook/livekit`.

La CI usa adapter e token firmati localmente e non richiede un server LiveKit reale. Un test media end-to-end richiede invece un provider di sviluppo e due endpoint reali.

## Test principali

```powershell
Push-Location apps/backend
pnpm exec jest --runInBand
Pop-Location

pnpm -C apps/frontend type-check
pnpm run test:desktop-calls-frontend
pnpm -C apps/frontend build

pnpm -C apps/desktop type-check
pnpm -C apps/desktop test
pnpm -C apps/desktop build

cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml -- --check
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml --all-targets
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
cargo clippy --manifest-path apps/desktop/src-tauri/Cargo.toml --all-targets -- -D warnings
```

## Checklist production (operazione separata)

- applicare la migration tramite runner e verificare zero pending;
- configurare LiveKit e TLS `wss://`;
- configurare il webhook autenticato;
- attivare `collab.calls` solo sui tenant approvati;
- aprire i master flag soltanto dopo uno smoke con due Desktop;
- verificare camera/microfono/screen share e policy Windows/WebView2;
- monitorare errori e rate limit senza loggare bearer o JWT;
- mantenere le chiamate interne browser disabilitate.

## Troubleshooting

- **Azioni assenti:** verificare Desktop 1.1+, bridge capability, subscription e master flag.
- **Provider non configurato:** verificare solo la presenza delle variabili; non stamparne i valori.
- **Destinatario offline:** Doflow Desktop deve essere in esecuzione; PC spento o app terminata non ricevono chiamate.
- **Permesso negato:** abilitare microfono/camera per Doflow in Windows e riaprire la finestra call.
- **Output non selezionabile:** WebView2/driver può non supportare `audiooutput`; resta disponibile l’output predefinito OS.
- **Screen share terminato dall’OS:** la UI rileva l’unpublish e ripristina la camera precedente.
- **Invite non valido:** il bearer può essere già consumato, scaduto, revocato o invalidato dalla chiusura della call.
