# Tema Colsova 2.4.1

Package built-in modulare derivato dal template standalone fornito dall’utente.

- Formato: `modular 1.0`
- Entry: `template.html`
- CSS: `styles/theme.css`
- JavaScript: `scripts/theme.js`
- Asset: `assets/images` e `assets/icons`
- Content profile: `colsova-conversion-v1`
- Runtime adapter: `ready`
- Selezionabile: sì
- Form demo: presente, intercettato localmente e senza rete
- Recensioni: sei recensioni esclusivamente dimostrative; disclaimer e avatar preservati

## Contratto

Collections: `consultation.highlights` (3), `consultation.paragraphs` (2), `faq` (6), `hero.proofs` (3), `process.steps` (3), `reviews` (6), `services` (3), `trust.items` (4).
Fixed counts: `services=3`, `reviews=6`, `faqs=6`, `trustItems=4`, `consultationHighlights=3`, `processSteps=3`.
Feature: `showProducts`, `showAccount`, `showCart`, `showReviews`, `showFaq`, `showContactForm`, `showMobileCta`, `reviewsMode`.
Palette: `ink`, `inkSoft`, `muted`, `ivory`, `cream`, `sand`, `sandSoft`, `gold`, `goldDeep`, `white`.
Image slots: `logoDefault`, `logoLight`, `hero`, `consultation`, `feature`.
Social slots: `socialLinkedIn`, `socialInstagram`, `socialFacebook`.

## Compilazione standalone

Il compiler backend incorpora CSS, JavaScript e asset in ordine dichiarato dal manifest, sostituisce in sicurezza il solo `template-config` e produce HTML deterministico. Il package sorgente resta immutabile e separato dall’artefatto compilato.

## Normalizzazioni

- Separazione meccanica HTML/CSS/JavaScript/asset senza modifica dei contenuti

## Provenienza e limiti

SHA-256 template standalone: `395a7f9e77d120558e5e45d3485c65f07be0cb339ad6a207a5562ec8b491d263` (2276156 byte). I text limits del manifest sono limiti editoriali del Builder e non modificano i contenuti originali. Le licenze degli asset devono essere verificate prima dell’uso pubblico.

## Documentazione originale preservata

# Tema Colsova 2.4.1 — homepage orientata alla conversione

Questa versione mantiene l'estetica premium e il percorso commerciale della 2.4.0, eliminando gli elementi che appesantivano la pagina e uniformando la gerarchia tipografica.

## Struttura predefinita

1. header trasparente e sticky con CTA testuale coerente con la navigazione;
2. hero con promessa locale e doppia azione;
3. fascia di fiducia;
4. metodo e consulenza, senza riquadro anagrafico sovrapposto;
5. trattamenti principali;
6. percorso in tre passaggi;
7. recensioni dichiarate dimostrative;
8. FAQ;
9. contatti, mappa grafica e modulo demo;
10. footer completo con credito doflow.

## Coerenza grafica

Tutti i piccoli titoli introduttivi delle sezioni (`.eyebrow`) condividono lo stesso font, peso, dimensione, interlinea e spaziatura tra lettere. Cambiano soltanto colore e allineamento quando richiesto dal fondo della sezione.

## Funzioni configurabili

Nel solo `script#template-config` sono presenti:

- `features.showProducts`: mostra o nasconde la sezione prodotti, disattivata di default;
- `features.showAccount` e `features.showCart`: disattivati di default;
- `features.showReviews`, `features.showFaq`, `features.showContactForm`;
- `features.showMobileCta`;
- `features.reviewsMode`: `demo` o `real`;
- `personalization.pageMode`: `homepage` o `landing`.

## Regole conservate

- un solo `script#template-config`;
- `noindex,nofollow,noarchive`;
- CSP restrittiva;
- slot `data-doflow-slot`;
- logo `logoDefault` e `logoLight`;
- immagini incorporate nel file standalone;
- social LinkedIn, Instagram e Facebook;
- nessun dato reale del prospect;
- link sviluppatore `https://doflow.it/`.
