# Template task Codex — Doflow CRM e Progetti

Copia questo blocco in Codex e sostituisci soltanto i campi tra parentesi quadre.

```text
Repository: OliverPistillo/Doflow-PaaS
Branch di riferimento: main

OBIETTIVO
[Descrivere una sola schermata, feature o modifica coerente e verificabile.]

PERIMETRO TENANT
- Questa modifica riguarda esclusivamente il tenant `doflow`.
- Non modificare il comportamento degli altri tenant.
- Non modificare l'area protetta `federicanerone`.
- Oliver e Daniele sono utenti CEO/management nel tenant `doflow`, ma non hardcodare nomi, email o ID. Verifica utenti, ruoli e permessi reali.
- Non introdurre un ruolo globale `ceo` senza una necessità architetturale verificata.
- Il Client Portal è stato rimosso: non reintrodurre `/client/*`, `/client-portal/*` o token equivalenti.
- Il login è fuori ambito: non modificare `/login`, AuthShell, UnifiedAuthPage, branding o mascotte.

RIFERIMENTO VISUALE OBBLIGATORIO
ID: [client-overview | client-activity-communications | client-files | client-administration | project-overview | project-flow | project-activities | project-files]
File: docs/design-references/doflow-crm-projects/references/[nome-file].png
Manifest: docs/design-references/doflow-crm-projects/REFERENCES_MANIFEST.md
Criteri: docs/design-references/doflow-crm-projects/VISUAL_ACCEPTANCE.md
Workflow locale: docs/design-references/doflow-crm-projects/LOCAL_VISUAL_WORKFLOW.md

Prima di scrivere codice:
1. apri il riferimento visuale;
2. ispeziona route, componenti, API, schema e permessi correnti;
3. ricostruisci il flusso end-to-end;
4. segnala eventuali divergenze tra codice e documentazione;
5. non inventare path di file.

CONTESTO FUNZIONALE
[Descrivere il comportamento corrente e quello atteso.]

AREE DA ISPEZIONARE
- navigazione tenant e gating `doflow`;
- componenti frontend della schermata;
- API frontend;
- controller, service e schema backend;
- permessi effettivi backend;
- collegamenti con CRM, progetti, documenti, calendario, preventivi, contratti e finance, se pertinenti;
- test esistenti.

VINCOLI ARCHITETTURALI
- preserva isolamento schema-per-tenant;
- nessun accesso cross-tenant;
- separa owner/management tenant da superadmin piattaforma;
- feature enforcement e autorizzazione lato backend, non soltanto UI;
- query parametrizzate;
- validazione rigorosa di schema e identificatori dinamici;
- migrazioni e backfill idempotenti;
- nessun reset, truncate, drop table, drop schema o cancellazione massiva;
- non cancellare dati legacy per semplificare la UI;
- non inserire segreti;
- DB_SYNC=false in produzione;
- mantieni compatibilità degli altri tenant.

STILE E UX
- usa il design system Doflow esistente;
- sidebar e topbar bianche;
- card chiare;
- stato attivo lilla;
- azioni principali blu/viola;
- niente sidebar scure o loghi alternativi;
- non esporre UUID;
- disabilita pulsanti durante richieste in corso;
- mostra feedback chiari;
- conserva filtri, ricerca, paginazione e scroll quando si apre il pannello;
- supporta deep link interno tramite URL;
- su mobile il pannello può diventare full-screen.

WHATSAPP, SE PERTINENTE
È ammessa la prima versione semi-integrata:
- normalizza il numero;
- apri WhatsApp Web/app con testo precompilato;
- registra in timeline testo e apertura del canale;
- chiedi esito manuale;
- consenti nota o follow-up.
Non simulare consegnato, letto, errore provider o messaggio inbound senza webhook reale.

COMPORTAMENTO ATTESO
[Elencare in modo verificabile il risultato funzionale.]

CASI LIMITE
[Elencare record incompleti, permessi insufficienti, dati legacy, viewport piccole, errori API e doppi invii pertinenti.]

VISUAL GATE OBBLIGATORIO
Dopo l'implementazione:
1. al primo accesso avvia `pnpm visual:gate:headed` e completa login/MFA manualmente nella finestra Chromium; con una sessione valida usa `pnpm visual:gate`;
2. verifica il frontend realmente aperto su `http://localhost:3100` e il proxy Next same-origin `/api/*` verso il backend server approvato;
3. mantieni il gate in sola lettura: il firewall deve bloccare le mutazioni non autenticative e non devono essere registrati token, cookie, body o header sensibili;
4. acquisisci gli screenshot alle viewport del manifest con dati personali, economici e account mascherati;
5. salva gli screenshot in docs/design-references/doflow-crm-projects/actual/;
6. genera un diff/overlay in docs/design-references/doflow-crm-projects/diff/ quando utile;
7. confronta layout, gerarchia, proporzioni, spacing, tipografia, componenti, tab, azioni e stati;
8. correggi tutte le differenze critiche e maggiori;
9. verifica anche 1024x768 e 390x844;
10. dichiara VISUAL GO soltanto in assenza di differenze critiche o maggiori;
11. dichiara VISUAL BLOCKED quando il gate non può essere eseguito e VISUAL NO-GO soltanto quando il browser ha rilevato differenze bloccanti.

TEST DA ESEGUIRE
- test backend pertinenti;
- test frontend pertinenti;
- test tenant isolation e permessi;
- test del mantenimento stato elenco/pannello;
- test deep link;
- test prevenzione doppio invio;
- lint;
- type-check;
- build frontend;
- build backend.
Esegui solo i test pertinenti disponibili e riporta esattamente quelli eseguiti.

DIVIETI OPERATIVI
- non eseguire commit;
- non eseguire push;
- non aprire PR;
- non eseguire merge;
- non eseguire deploy;
- non modificare dati di produzione per far coincidere il mockup.

REPORT FINALE OBBLIGATORIO
- root cause o stato iniziale;
- file modificati;
- comportamento prima/dopo;
- conferma scope solo tenant doflow;
- conferma federicanerone non modificato;
- conferma login non modificato;
- riferimento visuale usato;
- URL localhost effettivo;
- route/interazione verificata;
- viewport;
- percorso screenshot actual;
- percorso diff, se creato;
- differenze trovate;
- iterazioni eseguite;
- verifica desktop/tablet/mobile;
- test eseguiti;
- esito build;
- rischi residui;
- punti non verificati;
- verdetto VISUAL GO oppure VISUAL NO-GO;
- conferma che commit, push e deploy non sono stati eseguiti.
```
