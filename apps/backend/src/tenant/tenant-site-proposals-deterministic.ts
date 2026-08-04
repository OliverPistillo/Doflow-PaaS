import { selectProposalImages } from './tenant-site-proposals-image-catalog';
import { CanonicalProposalInput, JsonObject, WebsiteSnapshot } from './tenant-site-proposals.types';
import { buildFingerprint, deepClone, initialsFor, normalizePhoneHref, normalizeSlug, sha256 } from './tenant-site-proposals-validation';

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

export function buildDeterministicProposal(base: JsonObject, input: CanonicalProposalInput, snapshot?: WebsiteSnapshot, assets: JsonObject = {}): DeterministicPackage {
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
