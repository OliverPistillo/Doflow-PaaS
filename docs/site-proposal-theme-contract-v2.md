# Contratto Tema Proposte web V2

## Scopo e versioning

Un tema è una sorgente HTML standalone registrata dal backend. La struttura è `apps/backend/src/tenant/site-proposal-templates/{slug}/{version}/template.html`; slug e versione seguono un registry tipizzato e ogni versione è immutabile dopo la pubblicazione. Il manifest dichiara nome, slug, versione, schema, hash SHA-256, directory, stato, categorie e versione del contratto. Una nuova versione non modifica le proposte esistenti: l’upgrade è esplicito e crea una versione della proposta.

## Configurazione obbligatoria

Il documento deve contenere esattamente un nodo:

```html
<script id="template-config" type="application/json">{}</script>
```

Il config V2 contiene `template`, `editingContract`, `sourceWebsite`, `brand`, `business`, `seo`, `palette`, `routing`, `images`, `content`, `personalization` e `textLimits`.

`editingContract.contractVersion` vale `2.0` e dichiara:

- campi protetti: identità del template, contratto, conteggi e limiti;
- campi editabili: identità pubblica, contatti, social, testi, palette, immagini e route ammesse;
- conteggi fissi: 3 servizi, 6 punti di fiducia, 6 FAQ;
- image slot: `logoDefault`, `logoLight`, `hero`, `consultation`, `feature`;
- social slot: `socialLinkedIn`, `socialInstagram`, `socialFacebook`.

`textLimits` assegna un limite positivo ai testi editabili. Il renderer e l’output AI devono rispettarlo. Non sono ammessi HTML nei contenuti testuali, chiavi `__proto__`, `prototype` o `constructor`, placeholder tecnici o testimonianze attribuite a persone non verificate.

## Palette, immagini e doppio logo

La palette dichiara almeno `primary`, `secondary`, `accent`, `dark`, `light`, `primaryHover`, `muted` e `textOnPrimary`, usando colori CSS semplici validati. Il contrasto di testo e azioni deve rispettare WCAG AA dove applicabile.

Gli slot fotografici `hero`, `consultation` e `feature` sono obbligatori e non vuoti. Sono accettati URL HTTPS o data URI immagine entro i limiti del backend. Non usare endpoint casuali, rettangoli tratteggiati o testo sostitutivo visibile. Ogni oggetto fotografico dichiara `src`, `alt`, `objectPosition` e `sourceMethod`; i metodi ammessi sono `website`, `catalog`, `catalog_fallback` e `manual`.

Le immagini pubbliche del sito vengono validate con Sharp (almeno 720×480, area minima 450.000 pixel, rapporto fra 0,45 e 2,6) e hanno priorità sul catalogo. Il ranking per hero, consultation e feature considera contesto, rapporto, risoluzione e ordine sorgente in modo deterministico. Le scelte manuali esplicite vengono conservate anche durante una nuova analisi. Per il catalogo viene provata una sequenza deterministica con cache temporanea di raggiungibilità; se nessun URL supera il probe, il primo URL deterministico resta valorizzato come `catalog_fallback` con warning.

`logoDefault` è destinato all’header chiaro; `logoLight` allo stato trasparente sopra una hero scura. Se uno dei due non è sicuro o disponibile il tema deve mostrare il nome testuale dell’attività, senza riquadri “LOGO”. L’header sticky cambia stato dopo lo scroll senza layout shift e mantiene navigazione da tastiera e menu mobile.

## Slot semantici

Gli elementi modificabili dovrebbero esporre `data-doflow-slot`, per esempio:

```html
<img data-doflow-slot="brand.logoDefault" alt="">
<img data-doflow-slot="brand.logoLight" alt="">
<h1 data-doflow-slot="content.hero.title"></h1>
<p data-doflow-slot="content.hero.description"></p>
<img data-doflow-slot="images.hero" alt="">
<a data-doflow-slot="business.socialLinkedIn"></a>
```

Lo stesso criterio si applica a servizi, CTA, contatto, footer e altri social. Gli slot sono un contratto di editing; non autorizzano l’esecuzione dinamica di codice.

## Route, sicurezza e distribuzione

Le route sono ancore locali o percorsi relativi sicuri. Vietati URL JavaScript, traversal, backslash e route assolute. Il tema deve avere `noindex,nofollow,noarchive`, CSP restrittiva, nessun font remoto obbligatorio, nessun CDN JavaScript, nessun form verso origini esterne e nessuna lettura di cookie o token. Deve funzionare in iframe `sandbox="allow-scripts"` e negli artifact HTML/ZIP attuali.

Il JavaScript può leggere soltanto il config validato. Sono vietati `eval`, `new Function`, HTML non sanificato proveniente dall’utente e fetch automatici. I social sono mostrati solo per URL HTTPS validi e usano `target="_blank"` con `rel="noopener noreferrer"` e `aria-label`.

## Requisiti responsive e accessibilità

Verificare almeno 390, 768 e 1440 px. Il menu mobile deve avere stato `aria-expanded`, controllo da tastiera, focus visibile e chiusura dopo la navigazione. Immagini con alt, gerarchia di heading, FAQ native accessibili e rispetto di `prefers-reduced-motion` sono obbligatori.

## Hash, validazione e checklist

Prima della registrazione:

1. calcolare SHA-256 sul file byte per byte e inserirlo nel registry;
2. verificare un solo `template-config` JSON valido;
3. validare campi protetti, conteggi, palette, route, social e slot;
4. renderizzare un config di prova senza alterare struttura o CSP;
5. verificare noindex, responsive, tastiera, contrasto e menu;
6. cercare placeholder, dati cliente, recensioni inventate, script remoti e segreti;
7. eseguire test, type check e build.

## Futuro processo di upload

L’upload da browser non è parte di questa versione. Il futuro flusso dovrà ricevere un archivio in quarantena, controllare estensione e dimensione, impedire traversal/symlink, leggere un manifest dichiarativo, validare HTML e config, calcolare l’hash server-side, eseguire una preview isolata e richiedere approvazione prima dell’attivazione. Non dovrà mai sovrascrivere una versione esistente né rendere attivo un tema che non supera l’intera checklist.

## Configurazione AI opzionale

La personalizzazione può usare Gemini esclusivamente dall’azione esplicita “Analizza e personalizza”. `GEMINI_API_KEY` resta server-side; `SITE_PROPOSALS_AI_MODEL` seleziona il modello e usa `gemini-3.5-flash` come default; `SITE_PROPOSALS_AI_ENABLED` accetta `true`, `false` o `auto` (default). In `auto` il provider viene tentato soltanto con chiave presente. Chiave assente, quota, timeout o output non valido attivano il motore locale deterministico senza bloccare la proposta. Nessun valore reale di queste variabili deve essere inserito nel repository.
