import { selectProposalImages } from './tenant-site-proposals-image-catalog';
import { CanonicalProposalInput, JsonObject, WebsiteSnapshot } from './tenant-site-proposals.types';
import { buildFingerprint, deepClone, initialsFor, normalizePhoneHref, normalizeSlug, sha256 } from './tenant-site-proposals-validation';
import { getTemplateRegistration, SiteProposalTemplateRegistration } from './tenant-site-proposals-template-registry';

const heroVariants = [
  (name: string, category: string) => `${name}: ${category.toLowerCase()}, con un percorso più chiaro.`,
  (name: string, category: string) => `Un modo più semplice per conoscere ${name}.`,
  (name: string, category: string) => `${category} con attenzione, chiarezza e presenza.`,
];
const approachVariants = [
  'Partiamo dall’ascolto e trasformiamo ogni esigenza in passaggi comprensibili, senza complicazioni inutili.',
  'Informazioni ordinate, confronto diretto e indicazioni concrete aiutano a scegliere con maggiore consapevolezza.',
  'Ogni percorso nasce da un primo confronto e prosegue con obiettivi chiari, tempi condivisi e un riferimento accessibile.',
];

function indexFor(fingerprint: string, salt: string, length: number) {
  return parseInt(sha256(`${fingerprint}:${salt}`).slice(0, 8), 16) % length;
}
function choose<T>(items: T[], fingerprint: string, salt: string) { return items[indexFor(fingerprint, salt, items.length)]; }
function firstThree(input: CanonicalProposalInput) {
  const fallback = ['Primo confronto', 'Percorso personalizzato', 'Assistenza e informazioni'];
  return Array.from({ length: 3 }, (_, i) => input.services[i] || fallback[i]);
}

export type DeterministicPackage = { config: JsonObject; analysis: JsonObject; email: { subject: string; body: string } };

function buildBasicDeterministicProposal(base: JsonObject, input: CanonicalProposalInput, snapshot?: WebsiteSnapshot, assets: JsonObject = {}): DeterministicPackage {
  const config = deepClone(base);
  const fingerprint = buildFingerprint(input) || sha256(`${input.businessName}:${input.city || ''}`);
  const category = input.category || input.descriptor || 'Studio professionale';
  const city = input.city || '';
  const services = firstThree(input);
  const images = selectProposalImages(fingerprint, category);
  const resolvedImages = (assets.images || {}) as JsonObject;
  const imageSlot = (slot: 'hero' | 'consultation' | 'feature', manual: string | undefined, fallback: string) => {
    if (manual) return { src: manual, alt: `${input.businessName} - ${slot === 'hero' ? 'ambiente e attività' : slot === 'consultation' ? 'confronto professionale' : 'servizi'}`, objectPosition: 'center', sourceMethod: 'manual' };
    const resolved = resolvedImages[slot];
    if (resolved && typeof resolved === 'object' && !Array.isArray(resolved)) return resolved;
    if (typeof resolved === 'string' && resolved) return { src: resolved, alt: `${input.businessName} - ${slot}`, objectPosition: 'center', sourceMethod: 'website' };
    return { src: fallback, alt: `${input.businessName} - ${slot}`, objectPosition: 'center', sourceMethod: 'catalog' };
  };
  const observed = snapshot?.text ? true : false;
  const hasContacts = Boolean(input.email || input.phone || snapshot?.emails.length || snapshot?.phones.length);
  const strengths = [
    snapshot?.title ? { label: 'Identità online riconoscibile', evidence: `Titolo pubblico: ${snapshot.title}`, confidence: 'high' } : null,
    snapshot?.headings.length ? { label: 'Contenuti organizzati', evidence: `${snapshot.headings.length} intestazioni pubbliche rilevate`, confidence: 'medium' } : null,
    hasContacts ? { label: 'Canali di contatto presenti', evidence: 'Sono disponibili modalità pubbliche per entrare in contatto.', confidence: 'high' } : null,
    city ? { label: 'Presenza locale definita', evidence: `Località dichiarata: ${city}`, confidence: 'high' } : null,
  ].filter(Boolean) as JsonObject[];
  const improvementAreas = [
    !snapshot?.ctas.length ? { label: 'Invito all’azione da rendere più evidente', evidence: observed ? 'Nella homepage analizzata non emerge una CTA chiara.' : 'Dato non verificato: richiede revisione.', businessImpact: 'Un contatto meno visibile può aumentare l’attrito.' } : null,
    !hasContacts ? { label: 'Contatti da rendere immediati', evidence: 'Non sono stati rilevati contatti pubblici completi.', businessImpact: 'Ridurre i passaggi facilita le richieste.' } : null,
    { label: 'Percorso mobile da valorizzare', evidence: 'La demo propone gerarchie e azioni pensate per schermi piccoli.', businessImpact: 'Una lettura più rapida sostiene la conversione.' },
  ].filter(Boolean) as JsonObject[];
  const analysis: JsonObject = {
    mode: observed ? 'website_analysis' : 'deterministic_public_data', status: 'draft',
    summary: observed ? `L’analisi della homepage pubblica di ${input.businessName} evidenzia una base utile da valorizzare con un percorso più diretto verso il contatto.` : `Analisi preliminare di ${input.businessName}, costruita sui soli dati pubblici disponibili e da verificare prima dell’invio.`,
    strengths, improvementAreas,
    opportunities: ['Rendere più immediata la proposta di valore', 'Collegare servizi e contatto in un percorso lineare', 'Curare l’esperienza da smartphone'],
    whyDoflow: ['Demo concreta prima della pubblicazione', 'Contenuti aggiornabili e struttura responsive', 'Percorso commerciale misurabile e progressivo'],
    evidence: strengths, missingData: [!snapshot ? 'Homepage non analizzata' : null, !hasContacts ? 'Contatti completi' : null].filter(Boolean),
    requiresManualReview: true,
  };
  const social = snapshot?.social || {};
  const business = (config.business || {}) as JsonObject;
  config.sourceWebsite = { url: input.websiteUrl || snapshot?.sourceUrl || '', title: snapshot?.title || '', description: snapshot?.description || '', overview: input.overview || '' };
  config.brand = { ...((config.brand || {}) as JsonObject), name: input.businessName, descriptor: input.descriptor || category, professionalTitle: input.professionalTitle || '', initials: initialsFor(input.businessName), logoMethod: assets.logoDefault ? 'website' : 'text', warnings: (assets.warnings as unknown[]) || [] };
  config.business = {
    ...business, city, citySlug: normalizeSlug(city), address: input.address || '', phoneDisplay: input.phone || snapshot?.phones[0] || '',
    phoneHref: normalizePhoneHref(input.phone || snapshot?.phones[0]), email: input.email || snapshot?.emails[0] || '',
    socialLinkedIn: input.extra?.socialLinkedIn || social.linkedin || business.socialLinkedIn || '',
    socialInstagram: input.socialInstagram || social.instagram || business.socialInstagram || '',
    socialFacebook: input.socialFacebook || social.facebook || business.socialFacebook || '',
    copyrightYear: String(new Date().getFullYear()), developerCredit: 'Proposta dimostrativa realizzata da doFlow',
  };
  config.seo = { title: `${input.businessName} | ${category}${city ? ` a ${city}` : ''}`.slice(0, 70), description: `Scopri ${input.businessName}: ${category.toLowerCase()}, informazioni chiare e un contatto semplice${city ? ` a ${city}` : ''}.`.slice(0, 165) };
  config.images = {
    logoDefault: { src: String(assets.logoDefault || input.logoUrl || ''), alt: `Logo ${input.businessName}` },
    logoLight: { src: String(assets.logoLight || ''), alt: `Logo chiaro ${input.businessName}` },
    hero: imageSlot('hero', input.heroImageUrl, images.hero),
    consultation: imageSlot('consultation', input.consultationImageUrl, images.consultation),
    feature: imageSlot('feature', input.productsImageUrl, images.feature),
  };
  const heroTitle = choose(heroVariants, fingerprint, 'hero')(input.businessName, category);
  const intro = choose(approachVariants, fingerprint, 'approach');
  config.content = {
    hero: { eyebrow: `${category}${city ? ` · ${city}` : ''}`, title: heroTitle, description: input.overview || `Scopri un’esperienza pensata per presentare con chiarezza i servizi di ${input.businessName} e rendere il contatto più semplice.`, primaryCta: 'Richiedi informazioni', secondaryCta: 'Scopri i servizi' },
    approach: { title: `Un approccio attento alle esigenze di chi sceglie ${input.businessName}.`, description: intro },
    services: services.map((title, i) => ({ title, description: input.services[i] ? `Informazioni chiare su ${title.toLowerCase()}, con dettagli da confermare direttamente.` : ['Un primo confronto per comprendere esigenze e obiettivi.','Una proposta costruita sui dati condivisi e sulle priorità emerse.','Un riferimento accessibile per chiarimenti e prossimi passi.'][i] })),
    benefits: { title: 'Un percorso semplice, dal primo interesse al contatto.', description: 'Ogni elemento aiuta a orientarsi e scegliere il passo successivo.', items: ['Informazioni essenziali ben organizzate', 'Navigazione comoda da smartphone', 'Contatti visibili nel momento giusto'] },
    trustItems: [
      { title: 'Contatto diretto', description: hasContacts ? 'Canali pubblici disponibili per richiedere informazioni.' : 'Spazio predisposto per inserire contatti verificati.' },
      { title: 'Percorso chiaro', description: 'Servizi e prossimi passi presentati senza ambiguità.' },
      { title: 'Attenzione personale', description: 'La proposta parte dalle esigenze condivise.' },
      { title: city ? `Presenza a ${city}` : 'Presenza locale', description: city ? 'La località dichiarata è valorizzata nel percorso.' : 'Località da confermare prima della pubblicazione.' },
      { title: 'Informazioni prudenti', description: 'Nessuna promessa o attribuzione non supportata dai dati.' },
      { title: 'Esperienza mobile', description: 'Azioni e contenuti restano accessibili su ogni schermo.' },
    ],
    faq: [
      ['Come posso richiedere informazioni?', 'Usa i contatti presenti nella pagina per avviare un primo confronto.'],
      ['Qual è il primo passo?', 'Racconta la tua esigenza: riceverai indicazioni sui possibili passi successivi.'],
      ['Il percorso è personalizzato?', 'Le opzioni vengono definite sulla base delle necessità condivise.'],
      ['Posso consultare il sito da smartphone?', 'Sì, contenuti e contatti sono progettati per schermi di ogni dimensione.'],
      ['Dove trovo i dettagli dei servizi?', 'La sezione servizi offre una panoramica; i dettagli vanno confermati direttamente.'],
      ['Le informazioni sono definitive?', 'La demo è una proposta non pubblica e va verificata prima dell’uso finale.'],
    ].map(([question, answer]) => ({ question, answer })),
    contact: { title: `Parliamo delle tue esigenze con ${input.businessName}.`, description: 'Un primo contatto aiuta a chiarire obiettivi, domande e prossimi passi.', cta: hasContacts ? 'Contattaci' : 'Richiedi informazioni' },
    footer: { text: `${input.businessName}${city ? ` · ${city}` : ''} — informazioni da verificare prima della pubblicazione.` },
  };
  config.personalization = { status: observed ? 'completed' : 'idle', provider: 'local', model: '', sourceUrl: snapshot?.finalUrl || input.websiteUrl || '', snapshotHash: '', completedAt: '', warnings: [], assetMethod: assets.logoDefault ? 'website+catalog' : 'catalog', copyMethod: 'deterministic' };
  const positive = strengths[0]?.label ? String(strengths[0].label).toLowerCase() : 'la presenza e l’identità dell’attività';
  const email = {
    subject: `Una proposta digitale su misura per ${input.businessName}`,
    body: `Buongiorno,\n\nho analizzato ${positive} e preparato una demo non pubblica per ${input.businessName}.\n\nLa base attuale può essere valorizzata rendendo più immediata la proposta di valore, più visibili i contatti e più lineare il percorso da smartphone. Questi interventi aiutano chi visita il sito a capire prima cosa può trovare e come compiere il passo successivo.\n\nLa demo mostra una gerarchia più chiara, tre servizi centrali e call to action accessibili. Con doFlow i contenuti restano aggiornabili e il percorso può evolvere in modo progressivo, senza perdere l’identità esistente.\n\nLink alla demo:\n[LINK_DEMO]\n\nSe la direzione le sembra interessante, risponda pure a questa email: possiamo confrontarci sui contenuti da confermare e sui prossimi passi.\n\nOliver\ndoFlow`,
  };
  return { config, analysis, email };
}

function conversionAnalysis(input: CanonicalProposalInput, snapshot?: WebsiteSnapshot): JsonObject {
  const observed = Boolean(snapshot?.text);
  const hasContacts = Boolean(input.email || input.phone || snapshot?.emails.length || snapshot?.phones.length);
  const strengths: JsonObject[] = [
    snapshot?.title ? { label: 'Identità online riconoscibile', evidence: `Titolo pubblico rilevato: ${snapshot.title}`, confidence: 'high' } : null,
    snapshot?.headings.length ? { label: 'Contenuti già presenti', evidence: `${snapshot.headings.length} intestazioni pubbliche rilevate`, confidence: 'medium' } : null,
    hasContacts ? { label: 'Canali di contatto disponibili', evidence: 'Sono presenti recapiti pubblici o dichiarati.', confidence: 'high' } : null,
  ].filter(Boolean) as JsonObject[];
  if (!strengths.length) strengths.push({ label: 'Identità dell’attività disponibile', evidence: `Nome pubblico o dichiarato: ${input.businessName}`, confidence: 'medium' });
  const improvementAreas: JsonObject[] = [
    { label: 'Proposta di valore più immediata', evidence: observed ? 'I contenuti pubblici possono essere sintetizzati in una gerarchia più diretta.' : 'Valutazione prudente basata sui dati disponibili.', businessImpact: 'Una promessa chiara aiuta il visitatore a capire prima il valore offerto.' },
    { label: 'Percorso verso il contatto', evidence: snapshot?.ctas.length ? 'Le CTA esistenti possono essere rese più coerenti nel percorso.' : 'Non è emersa una CTA pubblica inequivocabile.', businessImpact: 'Ridurre i passaggi può aumentare le richieste qualificate.' },
    { label: 'Esperienza mobile', evidence: 'La demo organizza contenuti e azioni per una lettura rapida da smartphone.', businessImpact: 'Una navigazione più semplice riduce l’abbandono.' },
  ];
  return {
    mode: observed ? 'website_analysis' : 'deterministic_public_data', status: 'draft',
    summary: observed
      ? `L’analisi dei contenuti pubblici di ${input.businessName} mostra una base concreta da valorizzare con una gerarchia più chiara, un percorso mobile lineare e inviti al contatto più coerenti.`
      : `Analisi preliminare di ${input.businessName} costruita sui dati disponibili: la proposta valorizza identità, servizi e contatti con un percorso commerciale chiaro, da verificare prima dell’invio.`,
    strengths, improvementAreas,
    opportunities: [{ label: 'Chiarezza commerciale', evidence: 'Messaggio principale, servizi e CTA sono collegati in sequenza.' }],
    whyDoflow: [{ label: 'Demo concreta', evidence: 'Il prospect può valutare un risultato navigabile prima di decidere.' }],
    evidence: strengths,
    requiresManualReview: true,
  };
}

function conversionEmail(input: CanonicalProposalInput, analysis: JsonObject) {
  const positive = String(((analysis.strengths as JsonObject[])?.[0] || {}).label || 'l’identità della vostra attività').toLowerCase();
  return {
    subject: `Una demo su misura per ${input.businessName}`.slice(0, 120),
    body: `Buongiorno,\n\nho osservato ${positive} e ho preparato una proposta dimostrativa riservata per ${input.businessName}.\n\nLa base attuale può essere valorizzata rendendo più immediata la proposta di valore, più coerente il percorso verso il contatto e più semplice la consultazione da smartphone. In termini commerciali significa aiutare chi visita il sito a capire prima cosa offrite, trovare rapidamente le informazioni essenziali e compiere il passo successivo con meno attrito.\n\nLa demo mostra una homepage completa con messaggio iniziale chiaro, tre servizi centrali, elementi di fiducia, un percorso in tre passaggi, FAQ e un contatto ben visibile. Con doflow il progetto resta aggiornabile e può evolvere senza perdere l’identità esistente, partendo da un risultato concreto da valutare insieme.\n\nPuò vedere la demo qui:\n[LINK_DEMO]\n\nSe questa direzione le sembra interessante, risponda pure a questa email: sarò felice di confrontarmi sui contenuti da confermare e sui prossimi passi.\n\nOliver\ndoflow`,
  };
}

function buildColsovaConversionProposal(base: JsonObject, input: CanonicalProposalInput, snapshot?: WebsiteSnapshot, assets: JsonObject = {}): DeterministicPackage {
  const config = deepClone(base);
  const fingerprint = buildFingerprint(input) || sha256(`${input.businessName}:${input.city || ''}`);
  const category = input.category || input.descriptor || 'Studio professionale';
  const city = input.city || '';
  const services = firstThree(input);
  const baseContent = config.content as JsonObject;
  const baseImages = config.images as JsonObject;
  const resolvedImages = (assets.images || {}) as JsonObject;
  const image = (slot: 'hero'|'consultation'|'feature', manual?: string) => {
    const resolved = resolvedImages[slot];
    if (manual) return { ...((baseImages[slot] || {}) as JsonObject), src: manual, sourceMethod: 'manual' };
    if (resolved && typeof resolved === 'object' && !Array.isArray(resolved)) return { ...((baseImages[slot] || {}) as JsonObject), ...(resolved as JsonObject) };
    if (typeof resolved === 'string' && resolved) return { ...((baseImages[slot] || {}) as JsonObject), src: resolved, sourceMethod: 'website' };
    return deepClone((baseImages[slot] || {}) as JsonObject);
  };
  const analysis = conversionAnalysis(input, snapshot);
  const currentBusiness = (config.business || {}) as JsonObject;
  const social = snapshot?.social || {};
  config.sourceWebsite = { url: input.websiteUrl || snapshot?.sourceUrl || '', title: snapshot?.title || '', description: snapshot?.description || '', overview: input.overview || '' };
  config.brand = { ...((config.brand || {}) as JsonObject), name: input.businessName, descriptor: input.descriptor || category, monogram: initialsFor(input.businessName), logoMethod: assets.logoDefault ? 'website' : 'text-fallback', warnings: (assets.warnings as unknown[]) || [] };
  config.business = {
    ...currentBusiness, city, citySlug: normalizeSlug(city), address: input.address || currentBusiness.address || '',
    phoneDisplay: input.phone || snapshot?.phones[0] || currentBusiness.phoneDisplay || '', phoneHref: normalizePhoneHref(input.phone || snapshot?.phones[0]),
    email: input.email || snapshot?.emails[0] || currentBusiness.email || '', hours: input.openingHours || currentBusiness.hours || '',
    socialLinkedIn: input.socialLinkedIn || social.linkedin || currentBusiness.socialLinkedIn || '',
    socialInstagram: input.socialInstagram || social.instagram || currentBusiness.socialInstagram || '',
    socialFacebook: input.socialFacebook || social.facebook || currentBusiness.socialFacebook || '',
    copyrightYear: String(new Date().getFullYear()), developerCredit: 'doflow~', developerUrl: 'https://doflow.it/',
  };
  config.seo = {
    title: `${input.businessName} | ${category}${city ? ` a ${city}` : ''}`.slice(0, 70),
    description: `Scopri ${input.businessName}: ${category.toLowerCase()}, servizi presentati con chiarezza e un contatto semplice${city ? ` a ${city}` : ''}.`.slice(0, 165),
  };
  config.images = {
    ...baseImages,
    logoDefault: { ...((baseImages.logoDefault || {}) as JsonObject), src: String(assets.logoDefault || input.logoUrl || ((baseImages.logoDefault as JsonObject)?.src || '')), alt: `Logo ${input.businessName}` },
    logoLight: { ...((baseImages.logoLight || {}) as JsonObject), src: String(assets.logoLight || ((baseImages.logoLight as JsonObject)?.src || '')), alt: `Logo chiaro ${input.businessName}` },
    hero: image('hero', input.heroImageUrl), consultation: image('consultation', input.consultationImageUrl), feature: image('feature', input.productsImageUrl),
  };
  const serviceDescriptions = [
    'Un percorso presentato con chiarezza, indicazioni prudenti e un primo contatto semplice.',
    'Informazioni ordinate per comprendere opzioni, priorità e prossimi passi.',
    'Un servizio valorizzato con contenuti essenziali e un invito all’azione coerente.',
  ];
  config.content = {
    ...baseContent,
    hero: { eyebrow: `${category}${city ? ` · ${city}` : ''}`, title: `${input.businessName}, più vicino alle persone`, titleAccent: 'con un percorso chiaro', description: input.overview || `${input.businessName} presenta servizi e competenze con un percorso chiaro, personale e facile da consultare da ogni dispositivo.`, primaryCta: 'Richiedi informazioni', secondaryCta: 'Scopri il metodo', stampText: 'ASCOLTO • CHIAREZZA • VALORE • ', proofs: ['Consulenza personalizzata','Percorso chiaro','Contatto diretto'] },
    consultation: { eyebrow: 'Approccio e metodo', title: 'Prima le esigenze,', titleAccent: 'poi il percorso', paragraphs: [`Ogni richiesta parte dall’ascolto e da informazioni comprensibili, per aiutare chi visita ${input.businessName} a orientarsi con fiducia.`, 'Obiettivi, alternative e prossimi passi vengono presentati senza promesse eccessive, con un contatto semplice per approfondire i dettagli.'], cta: 'Scopri il metodo', highlights: ['Valutazione individuale','Informazioni chiare','Follow-up dedicato'] },
    servicesIntro: { eyebrow: 'Servizi', title: 'Soluzioni costruite', titleAccent: 'intorno alle esigenze', description: `Tre aree centrali di ${input.businessName}, presentate in modo semplice per accompagnare dalla scoperta al contatto.` },
    services: services.map((title, index) => ({ number: `0${index + 1} / Servizio`, title, description: serviceDescriptions[index], cta: `Scopri ${title.toLowerCase()}` })),
    feature: { eyebrow: 'Esperienza', title: 'Un riferimento chiaro', titleAccent: 'in ogni momento', description: `Contenuti, servizi e contatti di ${input.businessName} restano accessibili in un percorso ordinato, pensato per ridurre dubbi e passaggi inutili.`, cta: 'Richiedi informazioni' },
    trust: { items: [
      { title: 'Percorso personalizzato', description: 'Ogni richiesta parte da esigenze e priorità reali.' },
      { title: 'Informazioni prudenti', description: 'Nessuna promessa o dato non supportato dalle fonti.' },
      { title: city ? `Presenza a ${city}` : 'Presenza locale', description: city ? 'La sede dichiarata è valorizzata nel percorso.' : 'La sede può essere confermata prima della pubblicazione.' },
      { title: 'Contatto diretto', description: 'Il passo successivo è sempre visibile e comprensibile.' },
    ] },
    process: { eyebrow: 'Come funziona', title: 'Dalla prima richiesta', titleAccent: 'al passo successivo', description: 'Tre passaggi semplici per sapere sempre cosa succede e perché.', steps: [
      { number: '01', title: 'Condividi la tua esigenza', description: 'Racconta obiettivi e priorità attraverso il canale che preferisci.' },
      { number: '02', title: 'Valutiamo le opzioni', description: 'Informazioni e alternative vengono organizzate in modo chiaro e prudente.' },
      { number: '03', title: 'Definiamo il percorso', description: 'Confermiamo insieme tempi, contenuti e passo successivo più adatto.' },
    ], cta: 'Inizia dal primo contatto' },
    faqIntro: { eyebrow: 'Domande frequenti', title: 'Le informazioni utili prima di iniziare', description: 'Risposte chiare per orientarsi; i dettagli specifici vengono sempre confermati direttamente.' },
    faq: [
      ['Come posso richiedere informazioni?', 'Usa i contatti presenti nella pagina per avviare un primo confronto senza impegno.'],
      ['Qual è il primo passo?', 'Condividi la tua esigenza: riceverai indicazioni prudenti sui possibili passi successivi.'],
      ['Il percorso è personalizzato?', 'Le opzioni vengono definite sulla base delle necessità, dei dati disponibili e delle priorità condivise.'],
      ['Posso consultare il sito da smartphone?', 'Sì, contenuti e azioni sono progettati per restare chiari su schermi di ogni dimensione.'],
      ['Dove trovo i dettagli dei servizi?', 'La sezione servizi offre una panoramica; i dettagli vengono confermati nel contatto diretto.'],
      ['Le informazioni della demo sono definitive?', 'No, la demo è una proposta riservata e va verificata prima di qualsiasi pubblicazione.'],
    ].map(([question, answer]) => ({ question, answer })),
    contact: { ...((baseContent.contact || {}) as JsonObject), eyebrow: 'Richiedi informazioni', title: 'Parliamo di ciò', titleAccent: 'che stai cercando', description: `Lascia i recapiti essenziali per entrare in contatto con ${input.businessName}. Questa demo non invia dati e mostra soltanto il percorso previsto.`, phoneLabel: 'Telefono', emailLabel: 'Email', addressLabel: 'Sede', hoursLabel: 'Orari', formTitle: 'Richiedi informazioni', formDescription: 'Compila i campi essenziali per simulare la richiesta.', demoNotice: 'Modalità demo: il modulo non invia dati.', submit: 'Invia la richiesta', success: 'Richiesta dimostrativa acquisita. Nel sito definitivo sarà collegata al canale concordato.' },
    footer: { ...((baseContent.footer || {}) as JsonObject), description: `${input.businessName}${city ? ` · ${city}` : ''}. Informazioni da verificare prima della pubblicazione.`, copyright: `© ${new Date().getFullYear()} ${input.businessName}. Tutti i diritti riservati.` },
    headerCta: 'Richiedi informazioni',
  };
  config.personalization = { ...((config.personalization || {}) as JsonObject), status: snapshot ? 'completed' : 'idle', provider: 'local', model: '', sourceUrl: snapshot?.finalUrl || input.websiteUrl || '', snapshotHash: '', completedAt: '', warnings: [], assetMethod: assets.logoDefault ? 'website+stock-local' : 'stock-local', copyMethod: 'deterministic', pageMode: 'homepage' };
  return { config, analysis, email: conversionEmail(input, analysis) };
}

export function buildDeterministicProposalForTemplate(base: JsonObject, registration: SiteProposalTemplateRegistration, input: CanonicalProposalInput, snapshot?: WebsiteSnapshot, assets: JsonObject = {}): DeterministicPackage {
  return registration.contentProfile === 'colsova-conversion-v1'
    ? buildColsovaConversionProposal(base, input, snapshot, assets)
    : buildBasicDeterministicProposal(base, input, snapshot, assets);
}

export function buildDeterministicProposal(base: JsonObject, input: CanonicalProposalInput, snapshot?: WebsiteSnapshot, assets: JsonObject = {}): DeterministicPackage {
  const template = (base.template || {}) as JsonObject;
  const registration = getTemplateRegistration(String(template.slug || 'colsova'), String(template.templateVersion || ''));
  return buildDeterministicProposalForTemplate(base, registration, input, snapshot, assets);
}

export function applyAiOutputForProfile(built: DeterministicPackage, output: JsonObject, registration: SiteProposalTemplateRegistration): DeterministicPackage {
  const next = { ...built, config: deepClone(built.config), analysis: deepClone(output.analysis as JsonObject), email: deepClone(output.email as { subject: string; body: string }) };
  const generated = output.content as JsonObject;
  const baseContent = next.config.content as JsonObject;
  if (registration.contentProfile === 'colsova-conversion-v1') {
    const allowed = ['hero','consultation','servicesIntro','services','feature','trust','process','faqIntro','faq','contact','footer','headerCta'];
    next.config.content = { ...baseContent };
    for (const key of allowed) if (Object.prototype.hasOwnProperty.call(generated, key)) (next.config.content as JsonObject)[key] = deepClone(generated[key]);
    const footer = (next.config.content as JsonObject).footer as JsonObject;
    const baseBusiness = built.config.business as JsonObject;
    (next.config.business as JsonObject).developerCredit = baseBusiness.developerCredit;
    (next.config.business as JsonObject).developerUrl = baseBusiness.developerUrl;
    if (footer && isObject(baseContent.footer)) {
      const originalFooter = baseContent.footer as JsonObject;
      for (const key of ['developerCredit','developerUrl']) if (originalFooter[key] !== undefined) footer[key] = originalFooter[key];
    }
  } else {
    next.config.content = deepClone(generated);
  }
  next.config.seo = deepClone(output.seo as JsonObject);
  return next;
}

function isObject(value: unknown): value is JsonObject { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
