# Doflow — true pre-179 migration rehearsal

Data: 24 agosto 2026. Ambiente: esclusivamente locale e sintetico. Questa
prova non è stata eseguita in produzione e non autorizza un deploy.

## Esito

`TRUE PRE-179 MIGRATION REHEARSAL GO`

- branch/SHA: `main@961c7d0d1886742f9330fad81100a2634596cc02`;
- comando riproducibile: `pnpm acceptance:migration-pre179`;
- PostgreSQL 16, Redis 7 e MinIO dedicati; `NODE_ENV=test`, `DB_SYNC=false`;
- database distinti: source, replay del backup pre e restore del backup post;
- evidence macchina ignorata:
  `.visual-runtime/pre179-migration-rehearsal-result.json`.

## Baseline reale

Il runner TypeORM programmatico carica esclusivamente le migrazioni
`1714752000000`, `1750000000000`, `1760000000000`, `1770000000000` e
`1780000000000`. Prima del backup verifica strutturalmente che migrazioni,
tabelle, colonne e indici authority `179+` siano assenti. Non avvia backend,
bootstrap o helper `ensure*Tables` sulla baseline.

La fixture SQL congelata riproduce i tenant sintetici `doflow` e secondario,
due CEO canonici con valori esclusivamente sintetici, dati piattaforma,
Commercial, Delivery, Finance, documenti, contratti, notifiche e automazioni
legacy collegati. Non contiene ordini, rimborsi, note di credito, snapshot,
artifact authority, firme, run, punti, ranking, outbox o History inventati.

Fingerprint schema pre:
`9c0d43a548f9bf265e60187605882e0a7f10581bdd0c337fee761b3d4d014849`.

## Backup e migrazioni

| Checkpoint | Formato | Dimensione | SHA-256 | Migration max |
|---|---|---:|---|---:|
| pre | PostgreSQL custom | 224.971 byte | `8d13d0c8ab96633addd830b420e0f697d53dfd4b49eeab0fd41a82ae2b57d800` | 178 |
| post | PostgreSQL custom | 719.492 byte | `8b270152f773e13e28c1b46cac5ded7589738d3f1e6343bb8a91970ea3430614` | 184 |

Entrambi i dump sono stati verificati con `pg_restore --list`, ripristinati e
rimossi nel teardown (441 e 1.493 entry verificate; timestamp UTC
`2026-08-24T10:21:29Z` e `2026-08-24T10:22:23Z`). Le migrazioni `179–184` sono state applicate realmente e
in ordine; il secondo run non aveva migrazioni pending. Fingerprint schema
post:
`143b2d26954977a1255a0036c2af1f16c470aec0e9382471abdac6da6601b073`.

## Mapper, seed e reconciliation

- dry-run: checksum schema, conteggi e business invariati;
- Delivery: `development → in_progress`, una apply effettiva; `kickoff`
  conservato e riportato come ambiguo; zero unknown;
- Commerce: nessuna fattura reinterpretata come ordine e nessun
  pagamento/rimborso/snapshot inventato;
- Collaboration: il commento legacy è mappato con UUID sorgente;
- Automation/Performance: una versione verificabile della regola legacy;
  zero run, punti o ranking snapshot inventati;
- seconda apply: zero variazioni business o duplicazioni;
- doppio seed: conteggi idempotenti e CEO `PRESERVED=2`;
- checksum identità, password hash, provider/Google ID, MFA, verifica email,
  avatar, mirror pubblico e membership invariati;
- relazioni sentinella e somme `numeric` di preventivo, fattura, pagamento,
  residuo, ricorrenza e rinnovo riconciliate;
- secondo tenant invariato nei dati e zero UUID cross-schema.

Il replay indipendente dal backup pre coincide su fingerprint schema, history
migrazioni, conteggi, UUID sentinella, relazioni, somme, checksum CEO e report
ambiguità. Il restore post coincide sugli stessi criteri, non ha migration
pending e avvia il backend con `DB_SYNC=false`; health e smoke API read-only
hanno risposto `200`.

Un fault controllato dentro una transazione di mapping ha prodotto rollback:
conteggio prima/dopo invariato, zero righe parziali e apply nuovamente
eseguibile.

## Teardown e limiti

Container, network, volumi, tre database, backup sintetici, credenziali e log
temporanei sono stati rimossi. Le porte `3401`, `55432`, `56379` e `59000`
sono chiuse. `doflow-nginx`, produzione, tenant reali, CEO reali e reference
read-only non sono stati toccati.

Questa fase chiude soltanto il blocker migration rehearsal. Restano separati i
blocker RC su lint globale, E2E/visual globale con Context E e upgrade Nest 11.
