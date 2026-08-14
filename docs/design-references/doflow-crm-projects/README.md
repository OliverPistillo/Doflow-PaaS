# Doflow CRM e Progetti — riferimenti visuali

## Stato del documento

Questa cartella contiene i riferimenti visuali e i criteri di accettazione per il lavoro corrente su CRM e Progetti.

## Perimetro

- Tenant interessato: **solo `doflow`**.
- Utenti di direzione: Oliver e Daniele, da risolvere tramite account, ruoli e permessi reali; non hardcodare email o identificativi.
- Tenant `federicanerone`: protetto e fuori ambito.
- Altri tenant: devono mantenere il comportamento corrente.
- Login: **fuori ambito** in questa fase.
- Client Portal: non deve essere reintrodotto.

## Obiettivo

Realizzare l'esperienza operativa descritta nella specifica Doflow mantenendo l'identità grafica corrente e usando i mockup come riferimento visuale obbligatorio per:

- pannello cliente;
- timeline e comunicazioni;
- file cliente;
- amministrazione cliente;
- panoramica progetto;
- flusso progetto;
- attività progetto;
- file progetto.

## Struttura

```text
doflow-crm-projects/
├── README.md
├── REFERENCES_MANIFEST.md
├── VISUAL_ACCEPTANCE.md
├── LOCAL_VISUAL_WORKFLOW.md
├── CODEX_TASK_TEMPLATE.md
├── references/
│   ├── README.md
│   └── *.png
├── actual/
│   └── README.md
└── diff/
    └── README.md
```

## Ordine di utilizzo

1. Leggere il manifest.
2. Aprire il mockup interessato.
3. Individuare route e componenti reali nella repo `main`.
4. Implementare rispettando perimetro tenant e permessi backend.
5. Avviare realmente frontend e, quando necessario, backend su localhost.
6. Aprire la route locale in un browser/Playwright.
7. Eseguire test funzionali.
8. Catturare lo screenshot `actual`.
9. Confrontare con il riferimento.
10. Iterare fino al `VISUAL GO`, oppure dichiarare chiaramente `VISUAL NO-GO`.

## Principi visuali invarianti

- sidebar e topbar bianche;
- card chiare;
- stato attivo lilla;
- azioni principali blu/viola;
- font, raggi, ombre, spaziature e icone coerenti con Doflow;
- nessun logo alternativo;
- nessuna sidebar scura;
- niente componenti appartenenti a un design system parallelo.

## Principi funzionali invarianti

- nessun accesso cross-tenant;
- separazione tra superadmin piattaforma e owner/management tenant;
- permessi verificati anche lato backend;
- query parametrizzate;
- validazione rigorosa degli identificatori dinamici;
- migrazioni e backfill idempotenti;
- nessuna cancellazione di dati esistenti senza migrazione verificata;
- nessun commit, push o deploy automatico.

## Regola fondamentale

`VISUAL GO` richiede il confronto tra il PNG di riferimento e la pagina realmente renderizzata su localhost. La sola lettura del codice non costituisce verifica visuale.

## Modalità del gate

- **SERVER MODE (predefinito)**: `pnpm visual:gate:headed` acquisisce manualmente login/MFA e `pnpm visual:gate` riusa la sessione per il gate headless. Avvia soltanto il frontend su `http://localhost:3100`, usa il proxy Next `/api` verso `https://api.doflow.it`, applica un firewall read-only e maschera i dati reali negli screenshot.
