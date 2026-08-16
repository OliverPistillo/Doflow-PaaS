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
