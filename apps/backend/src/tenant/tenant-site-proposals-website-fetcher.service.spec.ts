import { BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { promises as dns } from 'dns';
import { TenantSiteProposalsWebsiteFetcherService, isUnsafeNetworkAddress } from './tenant-site-proposals-website-fetcher.service';

jest.mock('axios',()=>({__esModule:true,default:{get:jest.fn(),post:jest.fn(),isAxiosError:(e:any)=>Boolean(e?.isAxiosError)}}));
describe('SSRF-safe website fetcher',()=>{
  const service=new TenantSiteProposalsWebsiteFetcherService();const get=axios.get as jest.Mock;
  beforeEach(()=>{jest.restoreAllMocks();get.mockReset();jest.spyOn(dns,'lookup').mockResolvedValue([{address:'93.184.216.34',family:4}] as any)});
  it.each(['127.0.0.1','10.1.2.3','172.16.0.1','192.168.1.1','169.254.169.254','::1','fe80::1','fc00::1'])('classifies %s as unsafe',(ip)=>expect(isUnsafeNetworkAddress(ip)).toBe(true));
  it('allows a resolved public HTTPS URL',async()=>await expect(service.assertSafeUrl('https://example.com/path')).resolves.toMatchObject({hostname:'example.com'}));
  it.each(['http://localhost','https://singlelabel','ftp://example.com/file','file:///tmp/a','https://user:pass@example.com'])('blocks %s',async(url)=>await expect(service.assertSafeUrl(url)).rejects.toBeInstanceOf(BadRequestException));
  it('blocks when any DNS result is private',async()=>{(dns.lookup as jest.Mock).mockResolvedValue([{address:'93.184.216.34',family:4},{address:'10.0.0.2',family:4}]);await expect(service.assertSafeUrl('https://example.com')).rejects.toThrow('Destinazione')});
  it('accepts an HTML response with limits and no auth headers',async()=>{get.mockResolvedValue({status:200,headers:{'content-type':'text/html; charset=utf-8'},data:Buffer.from('<h1>ok</h1>')});const result=await service.fetchHomepage('https://example.com');expect(result.body.toString()).toContain('ok');expect(get.mock.calls[0][1].headers.Authorization).toBeUndefined();expect(get.mock.calls[0][1].maxRedirects).toBe(0)});
  it('revalidates and blocks a redirect to private IP',async()=>{get.mockResolvedValueOnce({status:302,headers:{location:'http://127.0.0.1/admin'},data:Buffer.alloc(0)});(dns.lookup as jest.Mock).mockImplementation((host:string)=>Promise.resolve([{address:host==='127.0.0.1'?'127.0.0.1':'93.184.216.34',family:4}]));await expect(service.fetchHomepage('https://example.com')).rejects.toThrow('Destinazione')});
  it('rejects wrong content type and oversized payload',async()=>{get.mockResolvedValueOnce({status:200,headers:{'content-type':'application/json'},data:Buffer.from('{}')});await expect(service.fetchHomepage('https://example.com')).rejects.toThrow('Content-Type');get.mockResolvedValueOnce({status:200,headers:{'content-type':'text/html'},data:Buffer.alloc(1.5*1024*1024+1)});await expect(service.fetchHomepage('https://example.com')).rejects.toThrow('dimensione')});
  it('sanitizes timeouts',async()=>{get.mockRejectedValue({isAxiosError:true,code:'ECONNABORTED'});await expect(service.fetchHomepage('https://example.com')).rejects.toThrow('tempo massimo')});
  it('limits redirects to three',async()=>{get.mockResolvedValue({status:302,headers:{location:'https://example.com/next'},data:Buffer.alloc(0)});await expect(service.fetchHomepage('https://example.com')).rejects.toThrow('Troppi reindirizzamenti');expect(get).toHaveBeenCalledTimes(4)});
});
