export const ITALIAN_CSV_HEADER = 'Città;Ambito;Nome azienda / struttura;Nome e cognome pubblico;Ruolo pubblico;Telefono;Email;Indirizzo;Sito web;Fonte contatti;Fonte persona / ruolo;Completezza;Note;Data verifica';

export const ITALIAN_CSV_FIXTURE = `\uFEFF${ITALIAN_CSV_HEADER}\r\n${[
  `Reggio Emilia;Centro estetico;Studio Aurora;Giulia Verdi;Titolare;+39 0522 100001;info@studio-aurora.it;Via Roma 1;https://studio-aurora.it;Sito web;Pagina staff;Completo;"L'accoglienza / percorso; follow-up";05/08/2026`,
  'Reggio Emilia;Centro estetico;Centro Luce;Non pubblicato;Non pubblicato;+39 0522 100002;info@centro-luce.it;Via Emilia 2;https://centro-luce.it;Directory pubblica;;Parziale;Referente non pubblicato;05/08/2026',
  'Reggio Emilia;Centro estetico;Istituto Armonia;Non disponibile;N/D;+39 0522 100003;info@istituto-armonia.it;Via Dante 3;https://istituto-armonia.it;Sito web;Non disponibile;Completo;Viso / corpo, consulenza.;05/08/2026',
  'Reggio Emilia;Centro estetico;Atelier Benessere;Anna Neri;Responsabile;+39 0522 100004;info@atelier-benessere.it;Via Po 4;https://atelier-benessere.it;Sito web;Pagina contatti;Completo;"Percorso ""premium"" / viso, corpo.";05/08/2026',
].join('\r\n')}\r\n`;
