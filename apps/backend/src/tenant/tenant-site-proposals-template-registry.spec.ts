import { NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { getTemplateRegistration, SITE_PROPOSAL_TEMPLATE_REGISTRY } from './tenant-site-proposals-template-registry';
import { TenantSiteProposalsTemplateService } from './tenant-site-proposals-template.service';

describe('site proposal template registry V2',()=>{
  it('registers immutable 1.0 and latest 2.0',()=>{expect(SITE_PROPOSAL_TEMPLATE_REGISTRY.map(x=>x.version)).toEqual(['1.0.0','2.0.0']);expect(getTemplateRegistration('colsova').version).toBe('2.0.0');expect(getTemplateRegistration('colsova','1.0.0').isLatest).toBe(false)});
  it('rejects unknown slugs and versions',()=>{expect(()=>getTemplateRegistration('unknown')).toThrow(NotFoundException);expect(()=>getTemplateRegistration('colsova','9.0.0')).toThrow(NotFoundException)});
  it.each(['1.0.0','2.0.0'])('matches the source hash for %s',(version)=>{const item=getTemplateRegistration('colsova',version);const bytes=fs.readFileSync(path.join(__dirname,'site-proposal-templates',...item.directory.split('/'),'template.html'));expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe(item.sourceSha256)});
  it('lists versions and latest manifest',async()=>{const listed=await new TenantSiteProposalsTemplateService().listTemplates();expect(listed[0]).toMatchObject({version:'2.0.0',latestVersion:'2.0.0',versions:['1.0.0','2.0.0']});expect(listed[0].manifest.fixedCounts).toEqual({services:3,trustItems:6,faqs:6})});
  it('keeps cache separated and renders both versions',async()=>{const service=new TenantSiteProposalsTemplateService();const one=await service.getDefaultConfig('colsova','1.0.0'),two=await service.getDefaultConfig('colsova','2.0.0');const [a,b]=await Promise.all([service.renderHtml(one),service.renderHtml(two)]);expect(a.html).toContain('treatment-card');expect(b.html).toContain('Punti di fiducia');expect((service as any).cache.size).toBe(2)});
  it('V2 has security, sticky header, dual logo and semantic slots',async()=>{const html=(await new TenantSiteProposalsTemplateService().renderHtml(await new TenantSiteProposalsTemplateService().getDefaultConfig())).html;expect(html).toContain('position:fixed');expect(html).toContain("scrollY>40");expect(html).toContain('brand.logoDefault');expect(html).toContain('brand.logoLight');expect(html).toContain('noopener noreferrer');expect(html).toContain('noindex,nofollow,noarchive');expect(html.match(/id="template-config"/g)).toHaveLength(1)});
});
