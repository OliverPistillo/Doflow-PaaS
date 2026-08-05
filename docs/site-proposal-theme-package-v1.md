# Package modulare temi Proposte web v1

## Struttura e manifest

Un package modulare immutabile contiene `theme.json`, `template.html`, entry CSS/JavaScript locali, asset separati e documentazione. Tutti i path sono POSIX relativi, case-insensitive univoci, privi di traversal, file nascosti e symlink. `formatVersion` è `1.0`; schema `2.0` e contratto `2.1` sono le sole versioni attualmente supportate.

Il manifest dichiara entry, `contentProfile`, stato adapter, categorie e recommendation tag, `collections`, `fixedCounts`, feature, palette, image/social slot, path editabili e protetti, limiti testuali, sicurezza, provenienza e `assetMap`. Conteggi e percorsi sono validati dal manifest, mai dallo slug. Lo stato runtime degli upload è sempre deciso server-side.

## HTML, CSS e JavaScript

`template.html` è un documento completo con un solo `script#template-config` JSON, meta robots `noindex,nofollow,noarchive`, CSP strutturata, link e script corrispondenti esattamente alle entry del manifest. CSS applicativo e JavaScript applicativo non restano inline nel sorgente modulare.

CSS vieta import, expression/behavior, URL esterni, file URL, path assoluti e traversal. JavaScript non viene eseguito durante la validazione e vieta eval, Function dinamica, storage browser e primitive di rete. HTML vieta risorse eseguibili esterne, iframe/object/embed/base, refresh, handler inline e form esterne.

## Asset e deduplicazione

Raster e SVG sono denominati con SHA-256 completo. Byte identici producono un solo file. `assetMap` collega ruoli logici ai file e registra MIME, hash e dimensione; il validatore controlla magic byte, referenze, asset mancanti, vuoti, duplicati e orfani. Gli asset non sono ricompressi, ridimensionati o convertiti.

## Compilazione standalone

Il compilatore valida il package, incorpora CSS e JavaScript nell’ordine del manifest, converte gli asset locali in data URI e sostituisce facoltativamente soltanto il payload di `template-config`. La serializzazione JSON protegge `<`, `>`, `&`, U+2028 e U+2029. La CSP compilata disabilita connessioni e form; immagini data e HTTPS dinamiche restano ammesse.

L’output non contiene timestamp, path locali, host, username o nonce. Inventari e report sono ordinati: stesso package e stesso SiteConfig producono byte, dimensione e SHA-256 identici. Il ZIP sorgente built-in usa entry ordinate e timestamp fisso.

## Runtime, storage e compatibilità

Colsova 1.0.0 e 2.0.0 restano standalone legacy. Colsova 2.4.1 è modulare e runtime-ready. Aurea/Luce 1.2.0 sono modulari visibili, scaricabili e disponibili in preview, ma pending e quindi non selezionabili né impostabili come default.

Gli upload modulari conservano `source.zip`, i file sorgente e `compiled.html` sotto un prefisso server-side. Preview e rendering usano l’HTML compilato; il download restituisce il package sorgente. Cleanup DB-first, recovery e isolamento tenant restano invariati. Le versioni sono immutabili.

## Workflow futuro

Un nuovo profilo diventa selezionabile solo dopo un adapter registrato, test di validazione/generazione e attivazione server-side. L’upload non può autoassegnarsi fiducia, built-in, adapter ready, default o eccezioni di rete.
