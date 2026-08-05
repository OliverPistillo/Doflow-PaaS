import { NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { getTemplateRegistration, SITE_PROPOSAL_TEMPLATE_REGISTRY } from './tenant-site-proposals-template-registry';
import { TenantSiteProposalsTemplateService } from './tenant-site-proposals-template.service';

describe('site proposal template registry V2',()=>{
  it('registers immutable historical and modular built-in versions',()=>{
    expect(SITE_PROPOSAL_TEMPLATE_REGISTRY.map(x=>`${x.slug}@${x.version}`)).toEqual([
      'colsova@1.0.0','colsova@2.0.0','colsova@2.4.1','aurea@1.2.0','luce@1.2.0',
    ]);
    expect(getTemplateRegistration('colsova').version).toBe('2.4.1');
    expect(getTemplateRegistration('colsova','1.0.0').isLatest).toBe(false);
    expect(getTemplateRegistration('colsova','2.0.0').isLatest).toBe(false);
    for (const slug of ['aurea','luce']) expect(getTemplateRegistration(slug,'1.2.0')).toMatchObject({format:'modular',runtimeAdapterStatus:'ready',selectableForProposal:true,selectableForImport:true,defaultCandidate:true});
  });
  it('rejects unknown slugs and versions',()=>{expect(()=>getTemplateRegistration('unknown')).toThrow(NotFoundException);expect(()=>getTemplateRegistration('colsova','9.0.0')).toThrow(NotFoundException)});
  it.each(['1.0.0','2.0.0'])('matches the standalone source hash and size for %s',(version)=>{const item=getTemplateRegistration('colsova',version);const bytes=fs.readFileSync(path.join(__dirname,'site-proposal-templates',...item.directory.split('/'),'template.html'));expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe(item.sourceSha256);expect(bytes).toHaveLength(item.templateSize)});
  it.each([['colsova','2.4.1'],['aurea','1.2.0'],['luce','1.2.0']])('preserves original provenance for %s@%s',(slug,version)=>{
    const item=getTemplateRegistration(slug,version);
    const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'site-proposal-templates',...item.directory.split('/'),'theme.json'),'utf8'));
    expect(manifest.provenance).toMatchObject({sourceTemplateSha256:item.sourceSha256,sourceTemplateSize:item.templateSize});
  });
  it('lists versions and latest manifest',async()=>{const listed=await new TenantSiteProposalsTemplateService().listTemplates();expect(listed[0]).toMatchObject({version:'2.4.1',latestVersion:'2.4.1',versions:['1.0.0','2.0.0','2.4.1']});expect(listed[0].manifest.fixedCounts).toEqual({services:3,reviews:6,faqs:6,trustItems:4,consultationHighlights:3,processSteps:3})});
  it('keeps cache separated and renders both versions',async()=>{const service=new TenantSiteProposalsTemplateService();const one=await service.getDefaultConfig('colsova','1.0.0'),two=await service.getDefaultConfig('colsova','2.0.0');const [a,b]=await Promise.all([service.renderHtml(one),service.renderHtml(two)]);expect(a.html).toContain('treatment-card');expect(b.html).toContain('Punti di fiducia');expect((service as any).cache.size).toBe(2)});
  it('2.0 retains its sticky header and semantic slots',async()=>{const service=new TenantSiteProposalsTemplateService();const html=(await service.renderHtml(await service.getDefaultConfig('colsova','2.0.0'))).html;expect(html).toContain('position:fixed');expect(html).toContain("scrollY>40");expect(html).toContain('brand.logoDefault');expect(html).toContain('brand.logoLight');expect(html).toContain('noopener noreferrer');expect(html).toContain('noindex,nofollow,noarchive');expect(html.match(/id="template-config"/g)).toHaveLength(1)});
  it('2.4.1 exposes the conversion profile and required image slots',async()=>{const service=new TenantSiteProposalsTemplateService();const config=await service.getDefaultConfig('colsova','2.4.1');expect(getTemplateRegistration('colsova','2.4.1').contentProfile).toBe('colsova-conversion-v1');expect(Object.keys(config.images as object)).toEqual(['logoDefault','logoLight','hero','consultation','feature']);expect((config.features as any).reviewsMode).toBe('demo');expect((config.personalization as any).pageMode).toBe('homepage')});
});
