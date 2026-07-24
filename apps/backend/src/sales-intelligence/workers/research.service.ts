// apps/backend/src/sales-intelligence/workers/research.service.ts
//
// Sintetizza il contesto aziendale partendo esclusivamente dai dati
// restituiti da Apollo.io nell'enrichment step — nessuna API esterna aggiuntiva.
//
// Produce un `synthesizedContext` ottimizzato per il prompt di Gemini:
// strutturato, denso di fatti concreti, entro ~3000 caratteri.
//
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResearchData } from '../entities/research-data.entity';
import { EnrichedProspect } from './enrichment.service';

@Injectable()
export class ResearchService {
  private readonly logger = new Logger(ResearchService.name);

  constructor(
    @InjectRepository(ResearchData)
    private readonly researchRepo: Repository<ResearchData>,
  ) {}

  async research(prospect: EnrichedProspect, prospectId: string): Promise<ResearchData> {
    this.logger.log(`[Research] Sintesi contesto per: ${prospect.company.name}`);

    const synthesizedContext = this.buildContext(prospect);

    const research = await this.researchRepo.save({
      prospectId,
      newsItems:          [],   // nessun web scraping — placeholder per futura espansione
      pressReleases:      [],
      synthesizedContext,
      searchQueries:      [],
    });

    this.logger.log(`[Research] Contesto sintetizzato: ${synthesizedContext.length} caratteri`);
    return research;
  }

  // ─── Context builder ─────────────────────────────────────────────────────
  //
  // Costruisce un testo strutturato da usare come `{{synthesized_research_context}}`
  // nel System Prompt di Gemini. Ogni sezione è inclusa solo se il dato esiste.
  //
  private buildContext(p: EnrichedProspect): string {
    const co = p.company;
    const sections: string[] = [];

    // ── 1. Header azienda ──
    sections.push(
      `AZIENDA: ${co.name} (${co.domain})` +
      (co.country ? ` — ${co.country}` : '') +
      (co.industry ? ` | Settore: ${co.industry}` : '')
    );

    // ── 2. Dimensione e fatturato ──
    const size: string[] = [];
    if (co.employeeCount) size.push(`${co.employeeCount.toLocaleString('it')} dipendenti`);
    if (co.annualRevenue)  size.push(`Fatturato: ${co.annualRevenue}`);
    if (size.length) sections.push(`Dimensione: ${size.join(' | ')}`);

    // ── 3. Descrizione breve (Apollo short_description) ──
    if (co.shortDescription) {
      sections.push(`Descrizione: ${co.shortDescription.slice(0, 300)}`);
    }

    // ── 4. Funding & investimenti ──
    if (co.fundingStage || co.totalFunding) {
      const funding: string[] = [];
      if (co.fundingStage)  funding.push(`Stage: ${co.fundingStage}`);
      if (co.totalFunding)  funding.push(`Totale raccolto: ${co.totalFunding}`);
      sections.push(`Funding: ${funding.join(' | ')}`);
    }

    // Ultimi funding events (max 3) con data e investor
    if (co.fundingEvents && co.fundingEvents.length > 0) {
      const events = co.fundingEvents
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 3)
        .map(ev => {
          const parts = [`${ev.series || 'Round'} (${ev.date.slice(0, 7)})`];
          if (ev.amount)    parts.push(`$${(ev.amount / 1_000_000).toFixed(1)}M`);
          if (ev.investors?.length) parts.push(`Lead: ${ev.investors.slice(0, 2).join(', ')}`);
          return parts.join(' — ');
        });
      sections.push(`Investimenti recenti:\n${events.map(e => `  • ${e}`).join('\n')}`);
    }

    // ── 5. Tech stack ──
    if (co.techStack && co.techStack.length > 0) {
      // Raggruppa in categorie se possibile — altrimenti lista flat (max 20)
      const stack = co.techStack.slice(0, 20).join(', ');
      sections.push(`Tech stack: ${stack}`);

      // Segnala eventuali tecnologie competitor/di interesse
      const crms        = co.techStack.filter(t => /salesforce|hubspot|pipedrive|dynamics/i.test(t));
      const cms         = co.techStack.filter(t => /wordpress|webflow|squarespace|wix|drupal/i.test(t));
      const marketing   = co.techStack.filter(t => /mailchimp|klaviyo|marketo|activecampaign/i.test(t));

      if (crms.length)      sections.push(`CRM attuale: ${crms.join(', ')}`);
      if (cms.length)       sections.push(`CMS attuale: ${cms.join(', ')}`);
      if (marketing.length) sections.push(`Marketing automation: ${marketing.join(', ')}`);
    }

    // ── 6. Profilo prospect ──
    sections.push(
      `\nPROSPECT: ${p.fullName}` +
      (p.jobTitle  ? ` — ${p.jobTitle}`  : '') +
      (p.seniority ? ` (${p.seniority})` : '')
    );
    if (p.email)       sections.push(`Email: ${p.email}`);
    if (p.linkedinUrl) sections.push(`LinkedIn: ${p.linkedinUrl}`);

    // ── 7. Segnali impliciti da inferire ──
    const signals = this.deriveImplicitSignals(p);
    if (signals.length > 0) {
      sections.push(`\nSEGNALI RILEVANTI:\n${signals.map(s => `  • ${s}`).join('\n')}`);
    }

    return sections.join('\n').slice(0, 3500);
  }

  // ─── Implicit signal inference ───────────────────────────────────────────
  //
  // Deduce osservazioni strategiche dai dati strutturali:
  // es. "usa WordPress ma non ha una soluzione CMS scalabile",
  //     "ha appena chiuso un round Serie A → fase di scaling rapido"
  //
  private deriveImplicitSignals(p: EnrichedProspect): string[] {
    const signals: string[] = [];
    const co = p.company;

    // Crescita post-funding
    if (co.fundingStage) {
      const growthStages = ['series_a', 'series_b', 'series_c', 'series a', 'series b'];
      if (growthStages.some(s => co.fundingStage!.toLowerCase().includes(s))) {
        signals.push(`Ha appena chiuso un round ${co.fundingStage} → probabile fase di scaling rapido e hiring aggressivo`);
      }
    }

    // Azienda mid-market senza tech sofisticata
    if (co.employeeCount && co.employeeCount >= 50 && co.employeeCount <= 500) {
      if (!co.techStack?.some(t => /salesforce|hubspot/i.test(t))) {
        signals.push(`Mid-market (${co.employeeCount} dipendenti) senza CRM enterprise evidente — probabile gap nella gestione commerciale`);
      }
    }

    // CMS legacy
    if (co.techStack?.some(t => /wordpress/i.test(t)) && co.employeeCount && co.employeeCount > 20) {
      signals.push(`Usa WordPress in un contesto aziendale strutturato — possibile necessità di soluzione più scalabile/gestita`);
    }

    // Nessun marketing automation
    if (co.employeeCount && co.employeeCount > 30) {
      const hasMarketingAuto = co.techStack?.some(t =>
        /mailchimp|klaviyo|marketo|activecampaign|hubspot/i.test(t)
      );
      if (!hasMarketingAuto) {
        signals.push(`Nessun marketing automation tool rilevato nonostante le dimensioni — probabile gestione manuale dei lead`);
      }
    }

    // C-Level in azienda piccola = decisore diretto
    if (p.seniority === 'C-Level' && co.employeeCount && co.employeeCount < 50) {
      signals.push(`${p.jobTitle} in un team di ${co.employeeCount} persone → è lui il decisore finale, approccio diretto`);
    }

    return signals;
  }
}
