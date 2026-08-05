# Tema Luce 1.2.0

Package built-in modulare derivato dal template standalone fornito dall’utente.

- Formato: `modular 1.0`
- Entry: `template.html`
- CSS: `styles/theme.css`
- JavaScript: `scripts/theme.js`
- Asset: `assets/images` e `assets/icons`
- Content profile: `beauty-conversion-v1`
- Runtime adapter: `ready` (`beauty-conversion-v1`)
- Selezionabile: sì; disponibile in Libreria, anteprima, download, nuove proposte, import e cambio tema
- Form demo: presente, intercettato localmente e senza rete
- Recensioni: tre recensioni dimostrative del sorgente

## Contratto

Collections: `about.points` (4), `cta.items` (4), `reviews.items` (3), `services` (5), `trust` (5).
Fixed counts: `services=5`, `results=3`, `reviews=3`, `trustItems=5`, `ctaItems=4`.
Feature: `results`, `reviews`, `newsletter`, `mobileCta`.
Palette: `ink`, `accent`, `peach`, `paper`, `soft`.
Image slots: `logoDefault`, `logoLight`, `hero`, `consultation`, `feature`.
Social slots: `socialLinkedIn`, `socialInstagram`, `socialFacebook`.

## Compilazione standalone

Il compiler backend incorpora CSS, JavaScript e asset in ordine dichiarato dal manifest, sostituisce in sicurezza il solo `template-config` e produce HTML deterministico. Il package sorgente resta immutabile e separato dall’artefatto compilato.

## Normalizzazioni

- template.templateVersion: 1.1.0 → 1.2.0
- content.cta.items[3] reso dinamico preservando testo, icona, ordine e layout

## Provenienza e limiti

SHA-256 template standalone: `9f990c78514508cfe832a69e8a5caec21271085bed8eb977ff9dfce9ce6bd2c2` (347122 byte). I text limits del manifest sono limiti editoriali del Builder e non modificano i contenuti originali. Le licenze degli asset devono essere verificate prima dell’uso pubblico.
