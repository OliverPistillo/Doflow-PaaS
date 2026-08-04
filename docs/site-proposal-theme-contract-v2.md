# Contratto temi Proposte web V2

## Pacchetto e versioni

Un tema è un pacchetto ZIP standalone e immutabile. Deve contenere, direttamente o sotto una sola cartella radice:

```text
nome-tema-versione/
├── template.html
├── theme.json
├── README.md               # opzionale
├── NOTE-REVISIONE.md       # opzionale
└── ASSET-CREDITS.md        # opzionale
```

Sono ammessi altri file documentali `.md` o `.txt`, ma non asset separati o eseguibili: immagini, CSS e JavaScript necessari devono essere incorporati nel solo `template.html`. Una coppia `slug + version` non può essere sostituita né sovrascritta; ogni aggiornamento richiede una nuova versione semver.

## Manifest `theme.json`

Campi obbligatori:

- `name`, `slug` sicuro e `version` semver;
- `schemaVersion` e `contractVersion`;
- `entry`, sempre `template.html`;
- `templateSha256` e `size`, calcolati sui byte originali;
- `categories`, array non vuoto;
- `standalone`, sempre `true`.

`contentProfile` è consigliato. Se assente, il backend può inferire prudentemente solo:

- `proposal-basic-v2`, dalla presenza di `content.approach`, `content.benefits` e `content.trustItems`;
- `colsova-conversion-v1`, dalla presenza di `content.consultation`, `content.servicesIntro` e `content.process`.

Strutture arbitrarie o profili sconosciuti sono rifiutati. Il file di esempio è in `docs/site-proposal-theme-package-example/theme.json`.

## Config incorporato e profili

Il documento deve contenere esattamente un nodo:

```html
<script id="template-config" type="application/json">{}</script>
```

Il JSON deve essere valido, privo di chiavi `__proto__`, `prototype` e `constructor`, e coerente con manifest, contratto, conteggi, slot, route e limiti testuali. Il renderer sostituisce esclusivamente il payload di questo nodo, preservando tutti gli altri byte HTML.

`proposal-basic-v2` richiede 3 servizi, 6 punti di fiducia e 6 FAQ. `colsova-conversion-v1` richiede 3 servizi, 6 recensioni demo, 6 FAQ, 4 trust item, 3 highlight di consulenza e 3 passaggi. I due profili non sono distinti dal solo `contractVersion`: Colsova 2.0.0 e 2.4.1 dichiarano entrambi `2.0` ma hanno strutture differenti.

Gli slot immagine V2 sono `logoDefault`, `logoLight`, `hero`, `consultation` e `feature`. Gli slot social sono `socialLinkedIn`, `socialInstagram` e `socialFacebook`. Route, `editingContract`, `textLimits`, feature, asset credit, struttura form e label strutturali sono protetti.

## Palette Colsova conversion

Colsova 2.4.1 usa `ink`, `inkSoft`, `muted`, `ivory`, `cream`, `sand`, `sandSoft`, `gold`, `goldDeep` e `white`. La mappatura del brand è: dark→ink, dark secondario→inkSoft, muted→muted, light→ivory, light secondario→cream, neutral→sand, neutral soft→sandSoft, primary→gold, primary hover→goldDeep e white→white. Il validatore basic (`primary`, `secondary`, `accent` ecc.) non viene applicato al profilo conversion.

## Recensioni e form demo

Le recensioni dimostrative appartengono al tema: testi, nomi, avatar, disclaimer e indicazione “Recensioni dimostrative” non possono essere generati o modificati dall’AI. `features.reviewsMode = demo` deve restare tale. Il passaggio a `real` richiede dati manuali verificati; in loro assenza la sezione deve restare nascosta o il passaggio deve essere bloccato. Le recensioni demo non sono evidenze da inviare al provider AI.

Un form demo è ammesso soltanto senza action esterna, con `form-action 'none'`, submit intercettato tramite `preventDefault()` e una dichiarazione visibile che chiarisca che non invia dati.

## Sicurezza e limiti upload

Il caricamento accetta ZIP fino a 5 MiB, massimo 25 file, massimo 10 MiB non compressi, `template.html` fino a 5 MiB e ogni documento fino a 1 MiB. Il backend rifiuta path assoluti, traversal, file nascosti, symlink, file eseguibili, nomi duplicati case-insensitive, più radici e possibili ZIP bomb.

Il template richiede `noindex,nofollow,noarchive` e CSP con almeno `default-src 'none'`, `connect-src 'none'`, `object-src 'none'`, `frame-src 'none'` e `form-action 'none'`. Sono vietati script e stylesheet esterni, iframe, object, embed, base href, meta refresh, handler inline, `eval`, `new Function`, `document.write`, `fetch`, XMLHttpRequest, WebSocket, localStorage, sessionStorage e URL `javascript:`. I collegamenti web esterni sono soltanto HTTPS; `_blank` richiede `noopener noreferrer`.

I template verificati possono incorporare data URI `image/webp`, `image/png`, `image/jpeg` e SVG sanitizzati. Il limite è 1 MiB codificato per singola immagine fotografica e 3 MiB codificati complessivi. Questa eccezione vale soltanto nel validatore dei pacchetti tema e non amplia il limite degli URL immagine inseriti via API.

## Workflow libreria

L’upload salva una nuova versione come `draft` e restituisce manifest, hash, dimensioni, profilo, warning, report e URL di preview. Un admin, owner o superadmin può attivarla e impostarla come predefinita; un manager può consultare, scaricare e visualizzare l’anteprima. Disattivazione, default ed eliminazione sono registrati nell’attività.

Le versioni built-in, attive, predefinite o già usate non sono eliminabili. Lo storage viene rimosso prima del record DB: un errore storage conserva il record. I temi caricati restano in MinIO sotto `doflow/site-proposal-themes/{slug}/{version}/`, mai nel filesystem del container. Il resolver riceve sempre lo schema tenant validato e separa la cache per schema, slug, versione e hash.

La preview usa il config base tramite API autenticata e un iframe con `sandbox="allow-scripts"`, `referrerPolicy="no-referrer"`, senza same-origin, form, popup o top-navigation.

## Checklist upload

1. Preparare `template.html` e `theme.json` byte-stabili.
2. Calcolare SHA-256 e dimensione sul template definitivo.
3. Dichiarare profilo, conteggi, slot, route, feature e limiti.
4. Verificare standalone, un solo `template-config`, noindex e CSP.
5. Verificare script, link, form demo, SVG e data URI.
6. Cercare PII, segreti, recensioni inventate e claim non verificati.
7. Creare lo ZIP con zero o una cartella radice.
8. Caricare: il risultato deve essere `draft` con report valido.
9. Controllare preview mobile, tablet, desktop e confronto.
10. Attivare e, separatamente, impostare come predefinito.

## Preparazione automatica e AI

Creazione manuale e conferma CSV accodano la preparazione; il worker recupera il sito pubblico, sceglie asset, costruisce il pacchetto locale, prova Gemini, valida semanticamente l’output e genera HTML e ZIP. Qualsiasi errore provider o output incompleto usa il motore locale e produce stato `fallback`, senza falso badge AI.

Per essere valido, l’output AI deve includere analisi interna completa, SEO, contenuto conforme al profilo e una email con oggetto non vuoto, corpo di almeno 250 caratteri e `[LINK_DEMO]`. L’AI non può produrre recensioni, HTML o URL. La chiave Gemini resta server-side e test/build non effettuano chiamate reali.
