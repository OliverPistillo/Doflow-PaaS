# Visual acceptance e gate GO/NO-GO

## Obiettivo del gate

Il gate serve a impedire che una schermata sia dichiarata completata soltanto perché compila o funziona. Per le schermate coperte dai mockup, la conformità visuale è parte del requisito funzionale.

## Fonti di verità

Ordine di priorità:

1. istruzione più recente di Oliver;
2. codice corrente della repo `main`;
3. comportamento verificato dell'ambiente reale;
4. mockup in `references/` per la resa visuale;
5. specifica funzionale Doflow;
6. documentazione storica.

Un mockup non autorizza a violare permessi, tenant isolation o comportamento reale del prodotto.

### Dettaglio progetto del replacement — decisione corrente

La precedente struttura del pannello Doflow a quattro tab è **SUPERATA**. Oliver ha richiesto la sostituzione completa con il gestionale sviluppato da Daniele; per il dettaglio progetto la fonte strutturale corrente è quindi il file read-only `src/features/commercial/components/commercial-project-detail-page.tsx` della reference `doflow-gestionale-reference` al commit `e6c3ef5920773afc14b3caff88cfe4027400c54b`.

Le sette tab canoniche sono, in questo ordine:

1. `overview` — Panoramica;
2. `activities` — Attività;
3. `phases` — Fasi;
4. `production` — Produzione e QA;
5. `documents` — Documenti;
6. `payments` — Pagamenti;
7. `timeline` — Timeline.

I riferimenti PNG della precedente esperienza restano storici e continuano a guidare shell, proporzioni, gerarchia, spacing e token quando compatibili, ma le quattro tab non sono più acceptance corrente. Non richiedere il vecchio pannello per il dettaglio progetto e non classificare le sette tab Daniele come differenza critica o maggiore.

## Criteri visuali

### Shell

- sidebar bianca;
- topbar bianca;
- separatori e bordi leggeri;
- stato attivo lilla;
- azioni principali blu/viola;
- card chiare;
- nessuna sidebar scura;
- nessun logo alternativo.

### Gerarchia

- titolo, stato, responsabile e azioni principali immediatamente riconoscibili;
- tab visibili e stabili;
- blocchi operativi prioritari rispetto ai campi secondari;
- una sola azione contestuale principale per blocco;
- informazioni urgenti riconoscibili anche senza affidarsi soltanto al colore.

### Pannello

- apertura senza cambiare pagina;
- conservazione di filtri, ricerca, paginazione e scroll;
- intestazione e azioni rapide persistenti;
- tab caricate nello stesso contenitore;
- deep link tramite URL interno autenticato;
- comportamento full-screen su mobile quando necessario.

Questi criteri si applicano alle superfici che restano pannelli laterali. Il dettaglio progetto del replacement è una route full-page: deve conservare stato in `?tab=`, supportare refresh e navigazione browser, e mantenere lo scroll orizzontale delle sette tab circoscritto al relativo contenitore su mobile.

### Componenti

- riutilizzare componenti e token Doflow;
- niente duplicazioni inutili;
- niente UUID o identificativi tecnici nell'interfaccia;
- pulsanti disabilitati durante richieste in corso;
- feedback chiaro per salvataggio, invio, errore e sincronizzazione;
- stati vuoti con una sola azione consigliata.

## Criteri funzionali collegati al visual gate

Un confronto visuale non può ottenere GO quando:

- il record non è realmente modificabile secondo i permessi previsti;
- i dati mostrati sono mock non collegati al backend;
- la timeline non registra gli eventi prodotti dall'azione;
- le tab mostrano informazioni duplicate con origini differenti;
- dati economici vengono soltanto nascosti via CSS invece di essere protetti dal backend;
- la modifica perde compatibilità con altri tenant.

## Workflow di verifica

Per ogni reference:

1. aprire il PNG di riferimento;
2. identificare la route o interazione reale;
3. predisporre dati deterministici non distruttivi;
4. per task frontend-only avviare `pnpm visual:gate:headed`, che usa Next su `http://localhost:3100` e backend server tramite proxy locale;
5. completare login e MFA manualmente nella finestra Chromium senza trasferire credenziali nella chat o nei log;
6. verificare in memoria tenant `doflow`, ruolo autorizzato e autenticazione completa;
7. raggiungere lo stato descritto dal mockup;
8. acquisire screenshot alla viewport di riferimento;
9. salvare in `actual/` con lo stesso ID del riferimento e un suffisso descrittivo;
10. generare overlay/diff quando utile;
11. classificare le differenze;
12. correggere le differenze critiche e maggiori;
13. verificare tablet e mobile;
14. emettere il verdetto.

## Classificazione

### Critica

Esempi:

- leak verso altri tenant;
- permessi errati;
- modifica del login in questo lavoro;
- pannello assente o sostituito da cambio pagina;
- tab essenziali mancanti;
- azioni principali mancanti;
- perdita dello stato dell'elenco;
- esposizione di dati economici non autorizzati.

### Maggiore

Esempi:

- larghezza o struttura del pannello molto differente;
- gerarchia visiva alterata;
- card, spacing o tipografia incoerenti;
- azioni collocate in aree differenti senza giustificazione;
- shell Doflow non rispettata;
- responsive che nasconde funzioni essenziali.

### Minore

Esempi:

- differenze di antialiasing;
- dati dinamici diversi;
- pochi pixel di scarto non percepibili nel flusso;
- piccole variazioni dovute al rendering font;
- testi reali più lunghi gestiti correttamente.

## VISUAL GO

Dichiarare `VISUAL GO` soltanto quando:

- nessuna differenza critica è presente;
- nessuna differenza maggiore resta aperta;
- i dati sono reali o provengono da fixture dichiarate;
- tenant e permessi sono corretti;
- lo screenshot actual è stato prodotto;
- desktop, tablet e mobile sono stati controllati;
- test pertinenti e build passano, oppure i limiti sono esplicitamente segnalati senza dichiarare il task completo.

## VISUAL NO-GO

Dichiarare `VISUAL NO-GO` quando:

- il browser test è stato realmente eseguito e manca lo screenshot actual per una differenza critica/maggiore osservata;
- il confronto è stato eseguito e resta almeno una differenza critica o maggiore;
- rimane almeno una differenza critica o maggiore;
- il risultato è ottenuto con dati finti non dichiarati;
- la feature funziona soltanto nel frontend senza backend reale;
- la modifica coinvolge tenant non autorizzati;
- non è stato possibile verificare responsive o permessi;
- test o build pertinenti falliscono.

## VISUAL BLOCKED

Dichiarare `VISUAL BLOCKED` quando il gate non può essere eseguito realmente per autenticazione/MFA non completata, backend remoto o proxy locale non raggiungibile, Chromium non eseguibile o impossibilità di produrre gli screenshot. Non usare `VISUAL NO-GO` per un test mai eseguito.

## Tolleranza al pixel diff

Il pixel diff è uno strumento di supporto, non il verdetto automatico. Può essere influenzato da:

- contenuti dinamici;
- date e importi;
- font rendering;
- sistema operativo;
- antialiasing;
- scrollbar.

La decisione finale deve combinare:

- diff visuale;
- controllo della struttura;
- verifica del comportamento;
- verifica tenant e permessi;
- test responsive.

## Evidenza locale obbligatoria

Il report deve indicare URL localhost effettivo, route, viewport, reference e percorso dello screenshot actual. Un verdetto basato soltanto sull’ispezione di componenti o CSS è automaticamente `VISUAL NO-GO`.

## Evidenza finale Fase 5A.5 — 24 agosto 2026

Il gate `pnpm acceptance:final` ha avviato realmente frontend production su
`http://localhost:3100` e backend isolato su `http://localhost:3401`, con
PostgreSQL/Redis/storage locali e identità esclusivamente sintetiche `.invalid`.
La reference usata è
`doflow-gestionale-reference@e6c3ef5920773afc14b3caff88cfe4027400c54b`.

Copertura:

- 30 route canoniche e 31 superfici desktop chiaro/scuro;
- 14 superfici critiche responsive;
- viewport `390×900`, `768×900`, `1440×900`;
- temi chiaro e scuro;
- 121 screenshot in `actual/final-rc`;
- 118 controlli accessibilità;
- sette tab progetto, tastiera, Escape, focus dialog, alternativa al drag,
  sidebar mobile, browser Back, deep link, Select e input data;
- access denied finance chiaro/scuro;
- Control Room Superadmin desktop/mobile/tablet chiaro/scuro;
- zero errori console, zero warning console e zero `5xx` inattesi.

Sono stati ispezionati direttamente campioni desktop, mobile, dialog ordine,
access denied e Superadmin. Non restano differenze critiche o maggiori. I dati
dinamici sono fixture PostgreSQL sintetiche dichiarate; nessun pixel diff
separato è stato necessario. Login e branding pre-auth non sono stati
modificati in questa fase.

Verdetti:

- `GLOBAL VISUAL GO`;
- `VISUAL GO`.

## Addendum visuale Fase 5B.1A — workspace readiness

La copertura e gli screenshot Fase 5A.5 restano evidenza storica. La Fase
5B.1A non modifica design, reference, route canoniche, shell Doflow, sette tab,
Builder o login visuale.

Il gate visuale aggiunge una regressione funzionale: dopo l'autenticazione
`<main>` deve essere presente quando la shell è utilizzabile, anche se dati
secondari sono pending. Workspace essenziale e dati secondari espongono stati
semantici distinti; un errore secondario produce un messaggio e un retry
controllati, mai un loader permanente, full reload o hydration mismatch.

Sono coperti sia il deep link Collaboration di un utente assegnato privo di
capability lead sia il dettaglio progetto del project manager privo di lettura
attività CRM: query non pertinenti non possono rendere inert la route progetto.
Il gate isolato ha verificato marker workspace ready, pannello/commento e
screenshot a 1440×900, 768×900 e 390×900; il gate globale verifica il marker
prima delle sette tab e passa 1/1 nella sequenza mirata completa.

Il nuovo `GLOBAL VISUAL GO` è valido soltanto se l'orchestratore finale
verifica route e Context E alle viewport previste, chiaro/scuro, senza errori
console, `5xx` inattesi o loader workspace permanente. Il risultato conclusivo
è registrato nell'evidence stability; questo addendum non lo anticipa.

## Baseline canonica Full Daniele Design — 25 agosto 2026

Questa sezione **SUPERSEDE come target grafico** il precedente visual gate
basato su `master/e6c3ef…`, gli screenshot della shell ibrida e
`ANTI-REFERENCE — Stato attuale Oliver.png`. La struttura funzionale a sette
tab del dettaglio progetto resta invariata.

Ordine corrente delle fonti:

1. `TARGET — Reference Daniele.png`, `1348×888`, tema default;
2. `origin/daniele-design@b9a08eea2acaabf23ed56c75111f714c551374f8`;
3. reference funzionale storica `master@e6c3ef5920773afc14b3caff88cfe4027400c54b`;
4. frontend corrente esclusivamente per adapter, API, auth e capability.

Il confronto è stato eseguito realmente nello stack locale isolato su
`http://localhost:3100`, backend `http://localhost:3401`, con identità e dati
sintetici. Il gate usa tema `default` soltanto per il tenant `doflow` e ha
verificato:

- shell bianca, sidebar `248px` / rail `64px`, topbar `64px`, breadcrumb,
  ricerca e azioni;
- gruppi Workspace, Pausa, Sistema, Aiuto e tutorial e footer identità;
- dashboard a due colonne, tab Agenzia/Personale/Collaboratore, card economica,
  obiettivi e KPI inferiori;
- Builder integrato nella stessa generazione visuale;
- login, forgot/reset e MFA nella nuova presentazione, senza cambiare auth,
  CSRF, sessioni o payload;
- dettaglio progetto a sette tab;
- altro tenant sulla shell compatibile e Control Room Superadmin separata;
- mobile Sheet, tablet, desktop, tastiera, focus, Escape, dialog, select,
  browser Back, refresh e deep link;
- zero errori/warning console e zero `5xx` inattesi nel gate visuale.

Artefatti canonici:

- actual: `actual/full-daniele-design/dashboard-target-1348x888-default.png`;
- pixel diff: `diff/full-daniele-design/dashboard-target-1348x888-pixel-diff.png`;
- matrice completa: `actual/final-rc/` e result JSON runtime ignorato.

Il diff grezzo, senza mascherare shell/card/tab/spaziature, misura `1348×888`,
MAE RGB `11,296/255` (`4,43%`) e `9,98%` dei pixel oltre delta 16. Il residuo
visibile deriva da greeting dipendente dall'ora, dati economici indisponibili
mostrati onestamente, obiettivo sintetico, badge notifiche, testi dinamici e
rendering font. Dopo l'iterazione finale il bordo inferiore delle card
principali coincide con la quota del TARGET (circa `y=803`); non restano
differenze critiche o maggiori di struttura, proporzione o flusso.

Copertura conclusiva di `pnpm acceptance:final`:

- 75 screenshot;
- viewport `390×900`, `768×900`, `1348×888`, `1440×900`;
- 4/4 test visuali;
- Context A–E e `SUPERADMIN CONTEXT E GO`;
- health 10/10;
- teardown ufficiale senza residui.

L'esatto Dockerfile frontend è stato inoltre costruito e osservato per
`300000 ms`: cold start e tre restart controllati hanno risposto `200`, i
10 probe sono verdi, il restart count finale è zero e container, immagine e
porta dedicati sono stati rimossi.

`GLOBAL VISUAL GO`

`VISUAL GO`
