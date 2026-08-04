import * as crypto from 'crypto';

export type ProposalImageCategory = 'medicina_estetica' | 'centro_estetico' | 'studio_professionale' | 'generic';
export type ProposalImageSlot = 'hero' | 'consultation' | 'feature';

const u = (id: string, width: number) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=82`;
export const SITE_PROPOSAL_IMAGE_CATALOG: Record<ProposalImageCategory, Record<ProposalImageSlot, readonly string[]>> = {
  medicina_estetica: {
    hero: [u('photo-1629909613654-28e377c37b09', 1800), u('photo-1576091160399-112ba8d25d1d', 1800), u('photo-1579684385127-1ef15d508118', 1800)],
    consultation: [u('photo-1559839734-2b71ea197ec2', 1200), u('photo-1584982751601-97dcc096659c', 1200), u('photo-1538108149393-fbbd81895907', 1200)],
    feature: [u('photo-1616394584738-fc6e612e71b9', 1200), u('photo-1519494026892-80bbd2d6fd0d', 1200), u('photo-1516841273335-e39b37888115', 1200)],
  },
  centro_estetico: {
    hero: [u('photo-1560750588-73207b1ef5b8', 1800), u('photo-1544161515-4ab6ce6db874', 1800), u('photo-1600334089648-b0d9d3028eb2', 1800)],
    consultation: [u('photo-1570172619644-dfd03ed5d881', 1200), u('photo-1519823551278-64ac92734fb1', 1200), u('photo-1515377905703-c4788e51af15', 1200)],
    feature: [u('photo-1619451334792-150fd785ee74', 1200), u('photo-1616394584738-fc6e612e71b9', 1200), u('photo-1540555700478-4be289fbecef', 1200)],
  },
  studio_professionale: {
    hero: [u('photo-1497366754035-f200968a6e72', 1800), u('photo-1497366811353-6870744d04b2', 1800), u('photo-1524758631624-e2822e304c36', 1800)],
    consultation: [u('photo-1551836022-d5d88e9218df', 1200), u('photo-1521737711867-e3b97375f902', 1200), u('photo-1556761175-b413da4baf72', 1200)],
    feature: [u('photo-1497366216548-37526070297c', 1200), u('photo-1497366412874-3415097a27e7', 1200), u('photo-1556761175-4b46a572b786', 1200)],
  },
  generic: {
    hero: [u('photo-1497366754035-f200968a6e72', 1800), u('photo-1524758631624-e2822e304c36', 1800), u('photo-1497366811353-6870744d04b2', 1800)],
    consultation: [u('photo-1551836022-d5d88e9218df', 1200), u('photo-1521737711867-e3b97375f902', 1200), u('photo-1556761175-b413da4baf72', 1200)],
    feature: [u('photo-1497366216548-37526070297c', 1200), u('photo-1497366412874-3415097a27e7', 1200), u('photo-1522071820081-009f0129c71c', 1200)],
  },
};

export function proposalImageCategory(value?: string): ProposalImageCategory {
  const normalized = String(value || '').toLowerCase();
  if (/medicin|clinic|dermat|odontoiatr|sanitari/.test(normalized)) return 'medicina_estetica';
  if (/estetic|beauty|wellness|benessere|spa/.test(normalized)) return 'centro_estetico';
  if (/studio|profession|consulen|avvocat|commercial/.test(normalized)) return 'studio_professionale';
  return 'generic';
}

export function selectProposalImages(fingerprint: string, category?: string): Record<ProposalImageSlot, string> {
  const selected = {} as Record<ProposalImageSlot, string>;
  const bucket = SITE_PROPOSAL_IMAGE_CATALOG[proposalImageCategory(category)];
  (['hero', 'consultation', 'feature'] as ProposalImageSlot[]).forEach((slot) => {
    const digest = crypto.createHash('sha256').update(`${fingerprint}:${slot}`).digest();
    selected[slot] = bucket[slot][digest.readUInt32BE(0) % bucket[slot].length];
  });
  return selected;
}

export function getProposalImageCandidates(fingerprint: string, category: string | undefined, slot: ProposalImageSlot): string[] {
  const items = [...SITE_PROPOSAL_IMAGE_CATALOG[proposalImageCategory(category)][slot]];
  const digest = crypto.createHash('sha256').update(`${fingerprint}:${slot}`).digest();
  const start = digest.readUInt32BE(0) % items.length;
  return items.map((_, index) => items[(start + index) % items.length]);
}
