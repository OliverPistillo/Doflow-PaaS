# Manifest dei riferimenti visuali

## Regole

- Tutte le immagini si applicano esclusivamente al tenant `doflow`.
- La pagina di login è esclusa dal lavoro corrente e non compare nel manifest.
- Codex deve verificare nel codice corrente la route e il componente reali; i path non vanno inventati.
- I dati visibili nei mockup sono dimostrativi. Non è richiesto copiarli letteralmente.
- Layout, gerarchia, proporzioni, componenti, spacing, tab, azioni e comportamento costituiscono invece il riferimento visuale.

## Immagini attese

| ID | File | Contesto | Viewport riferimento |
|---|---|---|---|
| `client-overview` | `references/client-overview.png` | Pannello cliente — Riepilogo | `1672x941` |
| `client-activity-communications` | `references/client-activity-communications.png` | Pannello cliente — Attività e comunicazioni | `1672x941` |
| `client-files` | `references/client-files.png` | Pannello cliente — File | `1672x941` |
| `client-administration` | `references/client-administration.png` | Pannello cliente — Amministrazione | `1672x941` |
| `project-overview` | `references/project-overview.png` | Scheda/pannello progetto — Panoramica | `1675x939` |
| `project-flow` | `references/project-flow.png` | Scheda/pannello progetto — Flusso | `1675x939` |
| `project-activities` | `references/project-activities.png` | Scheda/pannello progetto — Attività | `1675x939` |
| `project-files` | `references/project-files.png` | Scheda/pannello progetto — File | `1675x939` |

## Mappatura funzionale

### Cliente

Le quattro immagini cliente descrivono lo stesso pannello riutilizzabile con intestazione e tab persistenti. Il passaggio tra tab non deve cambiare pagina e non deve perdere lo stato dell'elenco sottostante.

### Progetto

Le quattro immagini progetto descrivono la stessa esperienza operativa del progetto. Il contenitore può condividere la shell del pannello cliente, ma i dati e le azioni devono essere adattati al record progetto.

### Responsive

I mockup sono desktop. Il confronto esatto viene effettuato alla viewport del riferimento. Sono inoltre obbligatorie verifiche funzionali e stilistiche a:

```text
tablet 1024x768
mobile 390x844
```

Su mobile il pannello può diventare una vista a tutto schermo.

## Aggiornamento del manifest

Quando viene aggiunto un nuovo mockup:

1. rinominare il file con un nome stabile, minuscolo e senza spazi;
2. inserirlo nella cartella `references/`;
3. aggiungere una riga alla tabella;
4. indicare il flusso e la viewport;
5. aggiornare i criteri di accettazione se introduce nuovi requisiti.
