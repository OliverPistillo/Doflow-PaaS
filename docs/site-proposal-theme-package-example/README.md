# Esempio pacchetto tema

Questa cartella documenta la struttura minima di uno ZIP. Copiare `theme.json` accanto a un `template.html` standalone conforme al contratto, quindi sostituire hash e dimensione con quelli calcolati sui byte definitivi.

```text
tema-esempio-1.0.0/
├── template.html
├── theme.json
├── README.md
└── ASSET-CREDITS.md
```

Non aggiungere binari: immagini, CSS e JavaScript devono essere incorporati nel template entro i limiti documentati. L’upload crea una bozza immutabile; attivazione e scelta come default sono azioni separate.
