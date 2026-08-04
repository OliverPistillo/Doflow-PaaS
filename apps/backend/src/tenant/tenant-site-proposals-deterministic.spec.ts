import { buildDeterministicProposal } from './tenant-site-proposals-deterministic';
import { TenantSiteProposalsTemplateService } from './tenant-site-proposals-template.service';
const input=(name:string,city:string,category:string)=>({businessName:name,city,category,services:['Consulenza','Percorso','Assistenza'],brands:[],extra:{}});
describe('deterministic proposal engine',()=>{
  let base:any;beforeAll(async()=>{base=await new TenantSiteProposalsTemplateService().getDefaultConfig()});
  it('is reproducible for the same prospect',()=>expect(buildDeterministicProposal(base,input('Alfa','Roma','studio professionale'))).toEqual(buildDeterministicProposal(base,input('Alfa','Roma','studio professionale'))));
  it('differentiates three prospects',()=>{const packages=[input('Alfa','Roma','studio professionale'),input('Beta','Milano','centro estetico'),input('Gamma','Torino','medicina estetica')].map(x=>buildDeterministicProposal(base,x));expect(new Set(packages.map(x=>(x.config.content as any).hero.title)).size).toBe(3);expect(new Set(packages.map(x=>x.email.body)).size).toBe(3)});
  it('creates complete counts and images',()=>{const value=buildDeterministicProposal(base,input('Alfa','Roma','centro estetico'));expect((value.config.content as any).services).toHaveLength(3);expect((value.config.content as any).trustItems).toHaveLength(6);expect((value.config.content as any).faq).toHaveLength(6);for(const key of ['hero','consultation','feature'])expect((value.config.images as any)[key].src).toBeTruthy()});
  it('does not invent reviews or medical promises',()=>{const text=JSON.stringify(buildDeterministicProposal(base,input('Alfa','Roma','medicina estetica'))).toLowerCase();expect(text).not.toMatch(/recensione|guarisc|risultati clinici|certificat|anni di esperienza/)});
  it('produces an email with demo link and a reviewable analysis',()=>{const value=buildDeterministicProposal(base,input('Alfa','Roma','studio professionale'));expect(value.email.body).toContain('[LINK_DEMO]');expect(value.analysis.requiresManualReview).toBe(true);expect(value.analysis.improvementAreas).toBeInstanceOf(Array)});
});
