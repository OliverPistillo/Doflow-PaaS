# AGENTS.md — Doflow-PaaS

Queste istruzioni si applicano all’intera repository. Le regole più specifiche eventualmente presenti in file `AGENTS.md` annidati prevalgono soltanto nel relativo sottoalbero.

## Doflow tenant-only visual gate

### Perimetro

- Le modifiche a CRM, Clienti, Pipeline, Progetti, File, Amministrazione, Performance consulente, navigazione e pannello laterale descritte in `docs/design-references/doflow-crm-projects/` si applicano **esclusivamente al tenant `doflow`**.
- Non propagare le nuove voci di menu, i nuovi layout o i nuovi comportamenti agli altri tenant.
- Componenti condivisi possono essere generalizzati internamente soltanto se il comportamento degli altri tenant resta invariato.
- Il tenant `doflow` è un ambiente operativo reale, non una sandbox distruttiva.
- Oliver e Daniele sono utenti di direzione/CEO nel tenant `doflow`. Non hardcodare nomi, email o identificativi: individuare account, ruoli e permessi reali nel codice e nei dati disponibili.
- Non introdurre automaticamente un ruolo globale `ceo`. Riutilizzare ruoli e capability esistenti, oppure aggiungere una capability tenant-specifica soltanto se realmente necessaria.
- Il Client Portal è stato rimosso intenzionalmente. Non reintrodurre route `/client/*`, `/client-portal/*`, token dedicati o funzionalità equivalenti.
- Il redesign del login è fuori ambito in questa fase. Non modificare `/login`, `AuthShell`, `UnifiedAuthPage`, mascotte o branding pre-auth salvo richiesta esplicita successiva.

### Fonti visuali

- Prima di modificare una schermata coperta dai mockup, aprire il riferimento corrispondente in:

  ```text
  docs/design-references/doflow-crm-projects/references/
  ```

- Consultare anche:

  ```text
  docs/design-references/doflow-crm-projects/REFERENCES_MANIFEST.md
  docs/design-references/doflow-crm-projects/VISUAL_ACCEPTANCE.md
  ```

- I mockup sono fonte di verità visuale per:
  - struttura e proporzioni;
  - gerarchia visiva;
  - sidebar e topbar bianche;
  - disposizione del pannello laterale;
  - tab e azioni;
  - spaziature;
  - tipografia;
  - raggi;
  - bordi e ombre;
  - icone;
  - stati selezionati;
  - azioni principali blu/viola;
  - stato attivo lilla.
- Riutilizzare il design system, i token e i componenti Doflow già presenti.
- Non creare un secondo design system.
- Non introdurre sidebar scure, loghi alternativi o componenti estranei all'identità corrente.
- Il contenuto testuale e i dati dinamici non devono essere copiati letteralmente dal mockup; layout, gerarchia e comportamento invece devono essere sostanzialmente coerenti.

### Metodo obbligatorio di confronto su localhost

Il confronto visuale non può essere svolto soltanto leggendo JSX/CSS. Codex deve avviare l’applicazione locale, aprirla in un browser reale e confrontare ciò che viene renderizzato con il PNG di riferimento.

Per i gate frontend-only del tenant reale `doflow`, usare dalla root la modalità server predefinita:

```bash
pnpm visual:gate:headed
```

Questa modalità usa esclusivamente:

- frontend Next locale su `http://localhost:3100`;
- richieste browser relative a `/api/*`;
- rewrite Next verso `https://api.doflow.it/api/*`;
- autenticazione manuale reale con eventuale MFA;
- Playwright locale con firewall read-only dopo il login.

Il processo frontend deve ricevere:

```text
INTERNAL_BACKEND_URL=https://api.doflow.it
NEXT_PUBLIC_API_URL=
```

Dopo aver acquisito una sessione valida in `.visual-auth/`, il gate headless è:

```bash
pnpm visual:gate
```

- Usare esattamente `localhost`, non `127.0.0.1`, per il login applicativo.
- `.visual-auth/` è ignorata da Git, contiene materiale segreto temporaneo e non deve essere stampata, allegata o inclusa nei report.
- In server mode trace, HAR, video, dump di rete e log di header/body API devono restare disabilitati.
- Dopo il login sono consentiti soltanto `GET`, `HEAD` e `OPTIONS` verso `/api/*`; durante login/MFA sono inoltre consentite soltanto le route auth necessarie.
- I dati personali, economici e account devono essere mascherati negli screenshot; `actual/` e `diff/` restano ignorate da Git.
- Non usare Docker, WSL, database locali, migrazioni, seed o backend locale in server mode.
- Non modificare file di lock o aggiungere dipendenze permanenti soltanto per produrre uno screenshot. Usare il browser/Playwright già disponibile nell’ambiente Codex; se non disponibile, dichiarare `VISUAL NO-GO` invece di fingere il confronto.
- Autenticarsi nel tenant `doflow` con credenziali fornite fuori dal codice e fuori dalla documentazione. Non salvare password o token nei file versionabili.
- Non usare né alterare dati di produzione per far coincidere la schermata con il mockup.

Per ogni schermata coperta da un riferimento:

1. Individuare nel codice corrente la route, il componente e il flusso reali. Non inventare path.
2. Implementare la modifica minima necessaria rispettando isolamento tenant, backend permissions e compatibilità degli altri tenant.
3. Avviare frontend e backend nell'ambiente locale o di test.
4. Usare dati deterministici o fixture non distruttive quando necessario.
5. Aprire la schermata con Playwright.
6. Acquisire uno screenshot alla viewport indicata nel manifest.
7. Salvare lo screenshot in:

   ```text
   docs/design-references/doflow-crm-projects/actual/
   ```

8. Creare, quando utile, overlay o diff in:

   ```text
   docs/design-references/doflow-crm-projects/diff/
   ```

9. Confrontare riferimento e implementazione per struttura, proporzioni, allineamenti, spacing, tipografia, componenti, tab, azioni e stati.
10. Correggere tutte le differenze critiche e maggiori prima di dichiarare il task completato.
11. Verificare anche:
    - tablet: `1024x768`;
    - mobile: `390x844`.
12. Su schermi piccoli il pannello laterale può diventare full-screen, ma nessuna funzione essenziale deve andare persa.

### Classificazione delle differenze

- **Critica**: cambia il flusso, il perimetro tenant, i permessi, la struttura primaria, il pannello, le tab o le azioni essenziali.
- **Maggiore**: proporzioni, spacing, gerarchia, tipografia o componenti si discostano visibilmente dal riferimento.
- **Minore**: differenze non bloccanti dovute a dati dinamici, rendering font, antialiasing o dettagli marginali.

### Condizioni automatiche di VISUAL NO-GO

Restituire `VISUAL NO-GO` quando si verifica almeno una delle seguenti condizioni:

- la modifica è visibile o attiva in un tenant diverso da `doflow` senza necessità architetturale e senza mantenere la compatibilità precedente;
- è stata modificata la pagina login in questo lavoro;
- sidebar o topbar non rispettano la shell bianca Doflow;
- è stato introdotto un logo alternativo o un'identità visiva differente;
- la struttura principale differisce materialmente dal mockup;
- il pannello cambia pagina o fa perdere filtri, ricerca, paginazione o posizione dell'elenco;
- mancano tab o azioni essenziali previste;
- desktop è coerente ma tablet/mobile perde funzioni essenziali;
- dati economici o di management sono esposti senza autorizzazione backend;
- il frontend non è stato avviato e aperto realmente su localhost o nell’ambiente locale equivalente;
- il confronto visuale non è stato eseguito;
- non esiste uno screenshot `actual` del risultato;
- restano differenze critiche o maggiori non giustificate;
- il report finale non dichiara esplicitamente `VISUAL GO` o `VISUAL NO-GO`.

### Condizioni di VISUAL GO

Restituire `VISUAL GO` soltanto quando:

- tutte le condizioni automatiche di no-go sono assenti;
- non restano differenze critiche o maggiori;
- struttura e gerarchia del riferimento sono rispettate;
- spacing, dimensioni, tipografia e componenti sono sostanzialmente allineati;
- le differenze dovute a dati dinamici sono documentate;
- desktop, tablet e mobile sono utilizzabili;
- permessi, tenant isolation e controlli backend sono verificati;
- test pertinenti e build passano, oppure gli eventuali limiti sono riportati senza dichiarare falsamente il completamento.

### Condizioni di VISUAL BLOCKED

Per la Fase 1 navigation shell, dichiarare `VISUAL BLOCKED` quando il gate non può arrivare alla verifica visuale per autenticazione/MFA non completata, backend remoto o proxy non raggiungibile, porta localhost non disponibile o Chromium non eseguibile. Non usare `VISUAL NO-GO` quando il browser test non è stato realmente eseguito.

### Pannello laterale e navigazione

- Lead, cliente e progetto devono usare lo stesso contenitore di pannello, con adapter specifici per il tipo di record.
- Apertura e chiusura del pannello non devono perdere filtri, ricerca, paginazione o scroll dell'elenco.
- Lo stato del pannello deve essere serializzabile nell'URL per consentire deep link e navigazione browser.
- Non usare route da Client Portal per implementare il deep link.
- Le quattro tab sono:
  1. Riepilogo;
  2. Attività e comunicazioni;
  3. File;
  4. Amministrazione.

### Cronologia

- Gli eventi devono essere prodotti dal backend e non simulati soltanto dal frontend.
- Note interne e comunicazioni esterne devono essere distinguibili.
- Correzioni importanti devono lasciare traccia di autore e orario.
- Un evento di progetto deve essere visibile anche nel contesto cliente collegato.
- Usare query parametrizzate, validazione degli identificatori e isolamento schema-per-tenant.
- Evitare modifiche distruttive; migrazioni e backfill devono essere idempotenti quando possibile.

### WhatsApp: prima versione consentita

È accettata una semi-implementazione senza provider WhatsApp Business completo:

- normalizzare il numero;
- aprire WhatsApp Web/app con messaggio precompilato;
- registrare in timeline il testo predisposto e l'apertura del canale;
- chiedere successivamente conferma manuale dell'esito;
- consentire nota e follow-up.

Stati consentiti senza webhook provider:

```text
external_opened
manually_confirmed
not_sent
sent
replied
no_reply
follow_up
```

Non mostrare o registrare automaticamente come reali:

```text
delivered
read
provider_error
inbound_received
```

finché non esiste una vera integrazione con webhook verificati.

### Divieti operativi

- Non eseguire commit, push, merge o deploy automatici salvo richiesta esplicita di Oliver.
- Non usare reset, truncate, drop schema, drop table o cancellazioni massive.
- Non inserire segreti in codice, log, prompt o documentazione.
- Non usare tenant reali come terreno di prova distruttivo.
- Non dichiarare completato senza screenshot, test e build pertinenti.

### Report finale obbligatorio

Il report Codex deve indicare:

- obiettivo del task;
- conferma perimetro tenant `doflow`;
- conferma che il login non è stato modificato;
- root cause o stato iniziale;
- file modificati;
- comportamento prima/dopo;
- riferimento visuale usato;
- route o interazione verificata;
- viewport del riferimento;
- percorso dello screenshot `actual`;
- eventuale percorso del diff;
- differenze trovate e iterazioni eseguite;
- verifica desktop, tablet e mobile;
- test eseguiti;
- risultato build;
- rischi residui;
- punti non verificati;
- risultato finale `VISUAL GO`, `VISUAL NO-GO` oppure `VISUAL BLOCKED`;
- conferma che commit, push e deploy non sono stati eseguiti, salvo richiesta esplicita.
