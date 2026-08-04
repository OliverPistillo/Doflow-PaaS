import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { JsonObject, WebsiteSnapshot } from './tenant-site-proposals.types';
import { TenantSiteProposalsWebsiteFetcherService } from './tenant-site-proposals-website-fetcher.service';

const MAX_LOGO = 150 * 1024;
const colorHex = (r: number, g: number, b: number) => `#${[r,g,b].map((v) => Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('')}`;
function luminance(hex: string) { const c = [1,3,5].map((i) => parseInt(hex.slice(i,i+2),16)/255).map((v) => v <= .03928 ? v/12.92 : ((v+.055)/1.055)**2.4); return .2126*c[0]+.7152*c[1]+.0722*c[2]; }
function contrast(a: string,b: string) { const [x,y]=[luminance(a),luminance(b)].sort((m,n)=>n-m); return (x+.05)/(y+.05); }
function darken(hex: string, ratio=.72) { return colorHex(parseInt(hex.slice(1,3),16)*ratio,parseInt(hex.slice(3,5),16)*ratio,parseInt(hex.slice(5,7),16)*ratio); }
function sanitizeSvg(buffer: Buffer): Buffer {
  let value = buffer.toString('utf8');
  value = value.replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi,'').replace(/\son\w+\s*=\s*(["']).*?\1/gi,'').replace(/\s(?:href|xlink:href)\s*=\s*(["'])(?:javascript:|https?:|\/\/).*?\1/gi,'');
  if (!/<svg\b/i.test(value) || /javascript:/i.test(value)) throw new Error('SVG logo non sicuro');
  return Buffer.from(value);
}
@Injectable()
export class TenantSiteProposalsBrandService {
  constructor(private readonly fetcher: TenantSiteProposalsWebsiteFetcherService) {}

  async extract(snapshot: WebsiteSnapshot): Promise<JsonObject> {
    const warnings: string[] = [];
    for (const candidate of snapshot.logoCandidates) {
      try {
        const input = candidate.startsWith('data:image/svg+xml;base64,') ? sanitizeSvg(Buffer.from(candidate.split(',')[1], 'base64')) : await this.downloadLogo(candidate);
        const processed = await this.processLogo(input);
        return { ...processed, warnings, logoSource: candidate.startsWith('data:') ? 'inline-svg' : 'website' };
      } catch { warnings.push('Un candidato logo pubblico non era utilizzabile in sicurezza.'); }
    }
    return { logoDefault: '', logoLight: '', warnings: [...warnings, 'Logo non rilevato: usato il fallback testuale.'], palette: this.paletteFromColors(snapshot.colors), logoSource: 'text' };
  }

  async processLogo(input: Buffer): Promise<JsonObject> {
    const sanitized = input.slice(0,100).toString().includes('<svg') ? sanitizeSvg(input) : input;
    const base = sharp(sanitized, { limitInputPixels: 20_000_000 }).trim({ background: '#ffffff' }).resize({ width: 800, height: 400, fit: 'inside', withoutEnlargement: true }).ensureAlpha();
    let defaultBuffer = await base.clone().webp({ quality: 88, alphaQuality: 95 }).toBuffer();
    if (defaultBuffer.length > MAX_LOGO) defaultBuffer = await base.clone().resize({ width: 520, height: 260, fit: 'inside' }).webp({ quality: 72, alphaQuality: 85 }).toBuffer();
    if (defaultBuffer.length > MAX_LOGO) throw new Error('Logo oltre il limite');
    const { data, info } = await base.clone().raw().toBuffer({ resolveWithObject: true });
    for (let i=0;i<data.length;i+=info.channels) { data[i]=255; data[i+1]=255; data[i+2]=255; }
    let lightBuffer = await sharp(data,{raw:info}).webp({quality:88,alphaQuality:95}).toBuffer();
    if (lightBuffer.length > MAX_LOGO) lightBuffer = await sharp(data,{raw:info}).resize({width:520,height:260,fit:'inside'}).webp({quality:72}).toBuffer();
    if (lightBuffer.length > MAX_LOGO) throw new Error('Logo light oltre il limite');
    return { logoDefault: `data:image/webp;base64,${defaultBuffer.toString('base64')}`, logoLight: `data:image/webp;base64,${lightBuffer.toString('base64')}`, palette: await this.paletteFromImage(sanitized) };
  }

  async paletteFromImage(input: Buffer): Promise<JsonObject> {
    const { data, info } = await sharp(input,{limitInputPixels:20_000_000}).resize({width:64,height:64,fit:'inside'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const buckets = new Map<string,{count:number,r:number,g:number,b:number}>();
    for(let i=0;i<data.length;i+=info.channels){const [r,g,b,a]=[data[i],data[i+1],data[i+2],data[i+3]];if(a<80||r+g+b>720||r+g+b<75)continue;const max=Math.max(r,g,b),min=Math.min(r,g,b);if(max-min<22)continue;const key=`${r>>5}-${g>>5}-${b>>5}`;const x=buckets.get(key)||{count:0,r:0,g:0,b:0};x.count++;x.r+=r;x.g+=g;x.b+=b;buckets.set(key,x)}
    const colors=[...buckets.values()].sort((a,b)=>b.count-a.count).slice(0,4).map(x=>colorHex(x.r/x.count,x.g/x.count,x.b/x.count));
    return this.buildPalette(colors[0]||'#7b5c43',colors[1]||'#ba9270',colors[2]||'#d7b37d');
  }
  paletteFromColors(colors: string[]) { const safe=colors.filter((v)=>/^#[0-9a-f]{6}$/i.test(v));return this.buildPalette(safe[0]||'#7b5c43',safe[1]||'#ba9270',safe[2]||'#d7b37d'); }
  private buildPalette(primary:string,secondary:string,accent:string){let p=primary.toLowerCase();let text=contrast(p,'#ffffff')>=4.5?'#ffffff':'#17211e';if(contrast(p,text)<4.5){p=darken(p);text=contrast(p,'#ffffff')>=4.5?'#ffffff':'#17211e'}return {primary:p,secondary:secondary.toLowerCase(),accent:accent.toLowerCase(),dark:'#17211e',light:'#fbf9f5',primaryHover:darken(p,.78),muted:'#6d746f',textOnPrimary:text};}
  private async downloadLogo(url:string){const result=await this.fetcher.fetchImage(url);if(/svg/i.test(result.contentType))return sanitizeSvg(result.body);return result.body;}
}
