import { getProposalImageCandidates, proposalImageCategory, selectProposalImages, SITE_PROPOSAL_IMAGE_CATALOG } from './tenant-site-proposals-image-catalog';
describe('proposal image catalog',()=>{
  it.each([['medicina estetica','medicina_estetica'],['centro estetico','centro_estetico'],['studio legale','studio_professionale'],['altro','generic']])('maps %s', (input,expected)=>expect(proposalImageCategory(input)).toBe(expected));
  it('has three values for every slot/category',()=>Object.values(SITE_PROPOSAL_IMAGE_CATALOG).forEach(group=>Object.values(group).forEach(items=>expect(items).toHaveLength(3))));
  it('always returns fixed HTTPS Unsplash URLs',()=>Object.values(selectProposalImages('fingerprint','centro estetico')).forEach(url=>expect(url).toMatch(/^https:\/\/images\.unsplash\.com\/.+w=\d+&q=82$/)));
  it('is deterministic for the same fingerprint',()=>expect(selectProposalImages('same','generic')).toEqual(selectProposalImages('same','generic')));
  it('varies selections when possible',()=>expect(new Set(Array.from({length:12},(_,i)=>selectProposalImages(`business-${i}`,'generic').hero)).size).toBeGreaterThan(1));
  it('returns every candidate once in deterministic cyclic order',()=>{const first=getProposalImageCandidates('same','generic','hero');expect(first).toHaveLength(3);expect(new Set(first).size).toBe(3);expect(first).toEqual(getProposalImageCandidates('same','generic','hero'))});
  it('changes candidate order for different fingerprints when possible',()=>expect(new Set(Array.from({length:12},(_,i)=>getProposalImageCandidates(`fp-${i}`,'generic','hero')[0])).size).toBeGreaterThan(1));
});
