# DoFlow PaaS — Struttura Completa Pagine

> Analisi basata su: Odoo, HubSpot, Zoho CRM, Pipedrive, Monday.com, Salesforce  
> Organizzazione per gruppo sidebar → pagina → sotto-pagine

---

## 📊 PANORAMICA

### `/dashboard` — Dashboard ⭐ STARTER (✅ ESISTE)
Dashboard personalizzabile con widget drag-and-drop, KPI, grafici.

### `/analytics` — Analytics Avanzata 🔷 ENTERPRISE
- Report incrociati multi-modulo
- Heatmap vendite (per zona, prodotto, periodo)
- Grafici BI interattivi (line, bar, pie, funnel)
- Export PDF/CSV/Excel dei report
- Dashboard condivisibili con il team

### `/activity` — Feed Attività 🟢 STARTER *(NUOVA)*
- Timeline cronologica di tutte le azioni (stile HubSpot Activity Feed)
- Filtri per tipo (email, chiamata, task, nota, deal)
- Filtri per utente/team
- Ricerca full-text nelle attività

---

## 👥 CRM & VENDITE

### `/customers` — CRM & Clienti ⭐ STARTER (✅ ESISTE)
Tab Utenti + Tab Lead già creati.

### `/customers/[id]` — Scheda Cliente 🟢 STARTER *(NUOVA)*
- Pagina dettaglio singolo contatto/azienda (stile HubSpot 360°)
- Storico interazioni (email, chiamate, note, meeting)
- Deal associati
- Documenti allegati
- Timeline attività
- Note interne del team

### `/contacts` — Rubrica Contatti 🟢 STARTER *(NUOVA)*
- Lista contatti separata dai lead (come Zoho: Lead → Contatto → Cliente)
- Import/export CSV/vCard
- Ricerca avanzata, filtri per tag/azienda/città
- Merge duplicati
- Gruppi/segmenti contatti

### `/companies` — Aziende 🟢 STARTER *(NUOVA)*
- Anagrafica aziende (ragione sociale, P.IVA, indirizzo, settore)
- Contatti associati a ogni azienda
- Deal e fatture collegate
- Note e file allegati
- Gerarchia azienda madre/filiale (Enterprise)

### `/deals` — Pipeline Vendite 🟢 STARTER *(NUOVA)*
- Kanban drag-and-drop con stadi personalizzabili (stile Pipedrive)
- Vista lista e vista tabella alternativa
- Deal value, probabilità, expected close date
- Deal "rotting" — evidenzia deal fermi troppo a lungo
- Assegnazione a venditore
- Attività collegate (prossima chiamata, email, meeting)
- Filtri per venditore, valore, stadio, data

### `/deals/[id]` — Dettaglio Deal *(NUOVA)*
- Riepilogo deal con progresso visuale
- Timeline attività e storico cambi stadio
- Prodotti/servizi associati
- Preventivi generati dal deal
- Note e file

### `/quotes` — Preventivi 🟢 STARTER *(NUOVA)*
- Creazione preventivo da template
- Collegamento a deal e cliente
- Calcolo automatico totali, IVA, sconti
- Stati: Bozza → Inviato → Accettato → Rifiutato → Scaduto
- Conversione preventivo → ordine con un click
- Anteprima e invio PDF via email
- Firma digitale (Enterprise)

---

## 📦 CATALOGO & ORDINI

### `/products` — Catalogo Prodotti/Servizi ⭐ STARTER (da creare)
- Lista prodotti con immagine, nome, codice, prezzo, categoria
- Filtri per categoria, prezzo, disponibilità
- Dettaglio prodotto con varianti (taglia, colore)
- Gestione prezzi listino / prezzi per cliente
- Import/export CSV

### `/products/categories` — Categorie Prodotto *(NUOVA)*
- Albero categorie gerarchico
- Drag-and-drop per riordinare
- Immagine e descrizione per categoria

### `/orders` — Ordini 🟢 STARTER (da creare)
- Lista ordini con stati: Nuovo → Confermato → In lavorazione → Spedito → Consegnato
- Creazione ordine manuale o da preventivo
- Dettaglio ordine con righe prodotto
- Calcolo automatico totali
- Generazione DDT e fattura dall'ordine
- Storico modifiche

### `/orders/[id]` — Dettaglio Ordine *(NUOVA)*
- Righe ordine (prodotto, quantità, prezzo, sconto)
- Stato spedizione
- Fatture collegate
- Pagamenti registrati
- Note interne

---

## 💰 FATTURAZIONE & FINANZA

### `/invoices` — Fatture & Pagamenti 🔵 PRO (da creare)
- Lista fatture con stati: Bozza → Emessa → Pagata → Scaduta → Annullata
- Scadenzario visuale (calendario scadenze)
- Creazione fattura da ordine o manuale
- Numerazione automatica progressiva
- Calcolo IVA, ritenute, bollo
- Invio PDF via email
- Registrazione incasso parziale/totale
- Dashboard: fatturato mensile, scaduto, da incassare

### `/invoices/[id]` — Dettaglio Fattura *(NUOVA)*
- Anteprima fattura stile documento
- Righe fattura modificabili
- Storico pagamenti
- Note di credito collegate
- Download PDF

### `/expenses` — Note Spese 🔵 PRO *(NUOVA)*
- Registrazione spese con ricevuta allegata (foto da mobile)
- Categorie spesa (viaggio, fornitore, ufficio, software)
- Approvazione da parte del manager
- Report spese mensili per dipendente/progetto
- Export per commercialista

### `/billing` — Abbonamento & Piano 🔵 PRO (da creare)
- Piano attuale con feature incluse
- Upgrade/downgrade
- Storico pagamenti
- Metodo di pagamento
- Fatture DoFlow ricevute

### `/payments` — Pagamenti & Incassi 🔷 ENTERPRISE *(NUOVA)*
- Riconciliazione bancaria
- Import movimenti bancari (CSV/OFX)
- Matching automatico fattura ↔ pagamento
- Dashboard cash flow
- Scadenzario avanzato con aging report

---

## ✅ OPERAZIONI & PRODUTTIVITÀ

### `/tasks` — Task ⭐ STARTER (✅ ESISTE)
Gestione task con tabella, filtri, creazione.

### `/tasks/board` — Kanban Task 🟢 STARTER *(NUOVA)*
- Vista kanban drag-and-drop dei task (stile Monday.com / Trello)
- Colonne per stato personalizzabili
- Subtask e checklist
- Commenti sui task
- Time tracking per task

### `/projects` — Progetti 🔵 PRO (✅ ESISTE base)
Già presente ma da arricchire con:
- Gantt chart (Enterprise)
- Milestone e deadline
- Budget progetto vs speso
- Team members assegnati
- File e documenti condivisi

### `/calendar` — Calendario 🟢 STARTER *(NUOVA)*
- Calendario mensile/settimanale/giornaliero
- Eventi: meeting, chiamate, scadenze, task
- Sync Google Calendar / Outlook (PRO)
- Creazione evento con invito partecipanti
- Vista agenda del giorno
- Promemoria e notifiche

### `/timesheet` — Foglio Ore 🔵 PRO *(NUOVA)*
- Registrazione ore per progetto/task/cliente
- Timer start/stop
- Approvazione ore da manager
- Report ore settimanali/mensili
- Calcolo costo/ricavo per ore fatturabili
- Export per payroll

---

## 📧 COMUNICAZIONE & MARKETING

### `/inbox` — Posta in arrivo 🔵 PRO *(NUOVA)*
- Inbox condivisa del team (stile HubSpot)
- Email collegate automaticamente a contatto/deal
- Assegnazione conversazione a membro del team
- Template email predefiniti
- Tracking apertura e click

### `/email-templates` — Template Email 🟢 STARTER *(NUOVA)*
- Libreria template email personalizzabili
- Variabili dinamiche (nome cliente, azienda, importo)
- Anteprima e test
- Statistiche uso template

### `/campaigns` — Campagne Email 🔵 PRO *(NUOVA)*
- Creazione campagna con editor drag-and-drop
- Segmentazione lista destinatari
- Scheduling invio
- A/B testing oggetto email
- Report: aperture, click, bounce, unsubscribe
- Automazione: sequenze email basate su trigger

### `/forms` — Form & Landing Page 🔵 PRO *(NUOVA)*
- Builder form drag-and-drop per cattura lead
- Embed su sito esterno
- Notifica automatica al team quando arriva un lead
- Mapping campi form → campi CRM

---

## 📦 LOGISTICA & MAGAZZINO

### `/logistics` — Logistica 🔵 PRO (da creare)
- Panoramica spedizioni in corso
- Creazione DDT da ordine
- Tracking spedizioni (codice tracking, corriere)
- Stati: Preparazione → Spedito → In transito → Consegnato
- Storico spedizioni per cliente

### `/inventory` — Magazzino 🔵 PRO *(NUOVA)*
- Giacenze in tempo reale per prodotto/magazzino
- Movimenti: carico, scarico, trasferimento
- Alert sotto-scorta automatico
- Inventario periodico con riconciliazione
- Multi-magazzino (Enterprise)
- Barcode scanning (da mobile)

### `/suppliers` — Fornitori 🔵 PRO *(NUOVA)*
- Anagrafica fornitori
- Ordini di acquisto
- Storico acquisti e prezzi
- Valutazione fornitore
- Documenti e contratti allegati

### `/purchase-orders` — Ordini di Acquisto 🔵 PRO *(NUOVA)*
- Creazione OdA da prodotto o manuale
- Approvazione multi-livello
- Ricezione merce con verifica quantità
- Collegamento a fattura fornitore

---

## 📄 DOCUMENTI & FILE

### `/documents` — Gestione Documenti 🟢 STARTER *(NUOVA)*
- File manager con cartelle per cliente/progetto/deal
- Upload drag-and-drop
- Anteprima in-app (PDF, immagini)
- Versioning documenti
- Condivisione link esterno con scadenza
- Ricerca full-text nei documenti (PRO)
- Template documenti (contratti, NDA, proposte)

### `/signatures` — Firma Digitale 🔷 ENTERPRISE *(NUOVA)*
- Invio documento per firma elettronica
- Tracking stato firma
- Storico firme completate
- Validità legale (integrazione con provider)

---

## 👤 HR & TEAM (per aziende con dipendenti)

### `/team` — Gestione Team 🔵 PRO *(NUOVA)*
- Organigramma visuale
- Profili dipendenti (ruolo, dipartimento, contatti)
- Assegnazione a progetti/task
- Calendario ferie e permessi
- Obiettivi e performance (Enterprise)

### `/team/roles` — Ruoli & Permessi 🔵 PRO *(NUOVA)*
- Definizione ruoli custom (Admin, Manager, Venditore, Viewer)
- Matrice permessi per modulo (CRUD)
- Assegnazione ruolo a utente

---

## ⚙️ SISTEMA & IMPOSTAZIONI

### `/settings` — Impostazioni ⭐ STARTER (✅ ESISTE)
Profilo, preferenze, notifiche, sicurezza, piano.

### `/settings/company` — Dati Azienda 🟢 STARTER *(NUOVA)*
- Logo, ragione sociale, P.IVA, indirizzo
- Informazioni bancarie (per fatture)
- Footer personalizzato per documenti
- Valuta e fuso orario predefiniti

### `/settings/pipeline` — Configurazione Pipeline 🟢 STARTER *(NUOVA)*
- Personalizzazione stadi pipeline vendite
- Stadi task personalizzabili
- Colori e label custom
- Campi custom per deal/task/contatto

### `/settings/integrations` — Integrazioni 🔵 PRO *(NUOVA)*
- Google Workspace (Calendar, Drive, Gmail)
- Microsoft 365 (Outlook, Teams)
- Stripe / PayPal (pagamenti)
- Zapier / Webhook
- API keys management
- Stato connessione e log sync

### `/settings/import-export` — Import/Export Dati 🟢 STARTER *(NUOVA)*
- Import contatti/aziende da CSV
- Import da altro CRM (Pipedrive, HubSpot, Zoho)
- Export completo dati in CSV/JSON
- Backup dati manuale

### `/settings/security` — Sicurezza Avanzata 🔷 ENTERPRISE (da creare)
- Audit log completo (chi ha fatto cosa, quando)
- Ruoli granulari e permessi per campo
- Obbligo MFA per tutto il team
- IP whitelist
- Session management (dispositivi attivi)
- Data retention policy

### `/settings/automations` — Automazioni 🔵 PRO *(NUOVA)*
- Workflow builder visuale (se X → allora Y)
- Trigger: nuovo lead, cambio stadio deal, task scaduto, fattura scaduta
- Azioni: invia email, crea task, notifica utente, aggiorna campo
- Log esecuzioni
- Template automazioni predefiniti

### `/settings/notifications` — Centro Notifiche 🟢 STARTER *(NUOVA)*
- Preferenze notifica per evento
- Canali: in-app, email, push browser
- Notifiche non lette con badge
- Storico notifiche

---

## 📈 RIEPILOGO PER PIANO

| Piano       | Pagine incluse |
|-------------|---------------|
| **STARTER** | Dashboard, Activity Feed, CRM (Clienti, Contatti, Aziende), Deals Pipeline, Preventivi, Catalogo, Ordini, Task, Calendario, Documenti, Email Templates, Settings base, Import/Export, Company Settings, Pipeline Config, Centro Notifiche |
| **PRO**     | Tutto Starter + Fatture, Spese, Billing, Progetti avanzati, Timesheet, Inbox condivisa, Campagne Email, Forms, Logistica, Magazzino, Fornitori, Ordini Acquisto, Team, Ruoli, Integrazioni, Automazioni |
| **ENTERPRISE** | Tutto Pro + Analytics BI, Pagamenti/Riconciliazione, Firma Digitale, Sicurezza Avanzata, Multi-magazzino, Gantt, Obiettivi Performance |

---

## 🎯 PRIORITÀ IMPLEMENTAZIONE SUGGERITA

### Fase 1 — Core CRM & Sales (massimo impatto)
1. `/deals` — Pipeline vendite (Kanban)
2. `/customers/[id]` — Scheda cliente dettagliata
3. `/contacts` — Rubrica contatti
4. `/companies` — Anagrafica aziende
5. `/quotes` — Preventivi

### Fase 2 — Catalogo & Ordini
6. `/products` — Catalogo prodotti
7. `/orders` — Gestione ordini
8. `/calendar` — Calendario appuntamenti

### Fase 3 — Fatturazione & Finanza
9. `/invoices` — Fatture
10. `/expenses` — Note spese
11. `/billing` — Gestione abbonamento

### Fase 4 — Produttività & Comunicazione
12. `/tasks/board` — Kanban task
13. `/documents` — File manager
14. `/inbox` — Posta condivisa
15. `/email-templates` — Template email

### Fase 5 — Logistica & Ops
16. `/inventory` — Magazzino
17. `/logistics` — Spedizioni
18. `/suppliers` — Fornitori
19. `/timesheet` — Foglio ore

### Fase 6 — Automazione & Enterprise
20. `/settings/automations` — Workflow builder
21. `/settings/integrations` — Integrazioni
22. `/analytics` — BI avanzata
23. `/settings/security` — Audit e sicurezza

---

*Documento generato il 19/02/2026 per DoFlow PaaS*
