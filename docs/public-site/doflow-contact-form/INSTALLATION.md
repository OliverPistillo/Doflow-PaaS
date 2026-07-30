# Installazione Form Contatto DoFlow

## 1. Tag iniziale del form

Sostituire il solo tag iniziale `<form ...>` del form contatto con il contenuto di `form-opening-tag.html`.

Il tag pronto usa:

```html
<form class="dfq-card" data-dfq-form data-endpoint="https://api.doflow.it/api/public/lead-intake/doflow" data-form-version="doflow-contact-v1" method="post" novalidate>
```

## 2. Endpoint

L'endpoint pubblico esatto e:

```text
https://api.doflow.it/api/public/lead-intake/doflow
```

Il form deve mantenere l'attributo:

```html
data-form-version="doflow-contact-v1"
```

## 3. Script

Rimuovere il vecchio IIFE inline dalla pagina WordPress e caricare lo script mantenuto dal backend:

```html
<script src="https://api.doflow.it/public/forms/doflow-lead-intake.v1.js" defer></script>
```

HTML dei campi, struttura a step e CSS visuali restano invariati.

## 4. Ordine di deploy

1. Deploy backend.
2. Verifica variabili backend in Coolify:

```text
TRUST_PROXY=loopback,linklocal,uniquelocal
CORS_PUBLIC_ORIGINS=https://doflow.it,https://www.doflow.it
PUBLIC_LEAD_INTAKE_TENANTS=doflow
```

`api.doflow.it` passa tramite Cloudflare Tunnel e proxy Coolify. Il backend accetta `CF-Connecting-IP` solo se la connessione arriva da un proxy fidato secondo `TRUST_PROXY`; `X-Forwarded-For` non viene letto direttamente dal public lead intake. L'IP visitatore viene usato solo in forma hash SHA-256 per il rate limit e non viene salvato nel CRM.

3. Verifica endpoint API e script statico:

```powershell
Invoke-WebRequest "https://api.doflow.it/public/forms/doflow-lead-intake.v1.js" -Method GET
```

4. Aggiornamento WordPress del tag form e dello script.
5. Smoke test da browser sul sito pubblico.

## 5. Smoke Test

Eseguire lo script:

```powershell
.\docs\public-site\doflow-contact-form\smoke-test.ps1
```

Verificare che la prima chiamata restituisca `duplicate: false` e la seconda `duplicate: true`.

Dopo il test, archiviare manualmente nel CRM il lead chiaramente marcato come smoke test.

## 6. Rollback WordPress

In caso di rollback, ripristinare solo lo script precedente nella pagina WordPress. Non e necessario modificare dati CRM o backend se il deploy backend e gia attivo.
