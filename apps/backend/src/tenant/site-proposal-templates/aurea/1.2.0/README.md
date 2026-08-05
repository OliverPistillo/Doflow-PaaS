# Tema Aurea 1.2.0

Package built-in modulare derivato dal template standalone fornito dall’utente.

- Formato: `modular 1.0`
- Entry: `template.html`
- CSS: `styles/theme.css`
- JavaScript: `scripts/theme.js`
- Asset: `assets/images` e `assets/icons`
- Content profile: `beauty-editorial-v1`
- Runtime adapter: `ready` (`beauty-editorial-v1`)
- Selezionabile: sì; disponibile in Libreria, anteprima, download, nuove proposte, import e cambio tema
- Form demo: presente, intercettato localmente e senza rete
- Recensioni: non previste

## Contratto

Collections: `results.items` (3), `services` (4), `trust` (4).
Fixed counts: `services=4`, `results=3`, `trustItems=4`.
Feature: `results`, `newsletter`, `mobileCta`.
Palette: `ink`, `gold`, `cream`, `paper`, `dark`.
Image slots: `logoDefault`, `logoLight`, `hero`, `consultation`, `feature`.
Social slots: `socialLinkedIn`, `socialInstagram`, `socialFacebook`.

## Compilazione standalone

Il compiler backend incorpora CSS, JavaScript e asset in ordine dichiarato dal manifest, sostituisce in sicurezza il solo `template-config` e produce HTML deterministico. Il package sorgente resta immutabile e separato dall’artefatto compilato.

## Normalizzazioni

- template.templateVersion: 1.1.0 → 1.2.0

## Provenienza e limiti

SHA-256 template standalone: `cdc959eaa870485134fc2e93bade901eebf20e0af54d2d8d4113c904790da5a6` (384117 byte). I text limits del manifest sono limiti editoriali del Builder e non modificano i contenuti originali. Le licenze degli asset devono essere verificate prima dell’uso pubblico.
