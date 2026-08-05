# Report modularizzazione temi PW-3B1

## Sorgenti verificati

| Tema | ZIP SHA-256 | ZIP byte | Entry | Byte non compressi | Template SHA-256 | Template byte |
|---|---:|---:|---:|---:|---:|---:|
| Aurea 1.2.0 | `81a3bf54055b813278874bd5a4ba965664042aefce7aeffacfd68a1f74d0672e` | 270424 | 2 | 384117 | `cdc959eaa870485134fc2e93bade901eebf20e0af54d2d8d4113c904790da5a6` | 384117 |
| Luce 1.2.0 | `72a60796aab7bc1f66427be036669bf0c0913d32d0e4cf9f766181eeed11e355` | 239836 | 2 | 347122 | `9f990c78514508cfe832a69e8a5caec21271085bed8eb977ff9dfce9ce6bd2c2` | 347122 |
| Colsova 2.4.1 | `bc9be4d9249e06ee113331b0890b8d3c4efc8140bbadcd237a1cd68040549ad6` | 1673508 | 6 | 2279757 | `395a7f9e77d120558e5e45d3485c65f07be0cb339ad6a207a5562ec8b491d263` | 2276156 |

Gli archivi hanno una singola root directory, nessun symlink e nessun path non sicuro. I file `_reference` non sono stati modificati né aggiunti al repository.

## Estrazione e normalizzazioni

| Tema | Data URI originali | Asset unici | Duplicati deduplicati | Profilo | Adapter |
|---|---:|---:|---:|---|---|
| Aurea | 12 | 11 | 1 | `beauty-editorial-v1` | pending |
| Luce | 13 | 12 | 1 | `beauty-conversion-v1` | pending |
| Colsova | 12 | 9 | 3 | `colsova-conversion-v1` | ready |

Gli asset sono stati decodificati senza ricompressione, conversione o ridimensionamento e nominati col loro SHA-256. CSS e JavaScript sono stati estratti preservando ordine e contenuto, salvo riferimenti locali necessari.

Aurea e Luce normalizzano `templateVersion` da 1.1.0 a 1.2.0. Luce aggiunge al config il quarto CTA già visibile, `Supporto costante e dedicato`, e il relativo slot dinamico, senza modificarne icona, posizione o layout. Colsova non modifica contenuti: conserva sei recensioni demo, avatar, disclaimer e form locale.

## Licenze e sicurezza

Per Aurea e Luce origine e licenza degli asset non erano documentate nel package; serve verifica prima dell’uso pubblico. Colsova conserva i crediti originari e aggiunge l’inventario tecnico.

I tre package superano validazione manifest-driven, CSP strutturata e blocco rete. L’HTML standalone è prodotto deterministicamente; gli hash finali degli artifact compilati sono verificati dalle suite e non incorporano path o timestamp locali.

## Hash package e artifact compilati

| Tema | SHA-256 package modulare | SHA-256 HTML compilato | Byte HTML compilato |
|---|---|---|---:|
| Aurea | `2607c232e147563bfda0e26f3787246188ee3279c9ae42a9316e6a24df7318a7` | `3dee82167b3380211955f5467885f14f0c93ba0e27ce7278592eaabc251c8024` | 384222 |
| Luce | `f91511ab4252161291f154733c3ffbef23e5484fe3b4a9e9a3e791b1135be89f` | `4cb71bda02b1d3602ddeaa6af3da4ba530fc6b800445869fbc6f5ebf40683bd3` | 347292 |
| Colsova | `dc5deb74b6bb02aa4e105cc9883963a0c591e804486d4eedace6e93cf862b8b4` | `13a1611c1eb9dcd77580913ff4fac103f6943de1fb17ab4c35645e4b20a86364` | 2273071 |
