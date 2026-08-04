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
