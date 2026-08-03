import { Injectable } from '@nestjs/common';
import archiver from 'archiver';
import { PassThrough } from 'stream';
import { GeneratedZip } from './tenant-site-proposals.types';
import { sha256 } from './tenant-site-proposals-validation';

const README = `ANTEPRIMA DEMO DOFLOW

Aprire index.html per visualizzare la demo.

Questa demo e non pubblica. Form, acquisti, account e pagamenti non sono attivi.
Testi, immagini e recensioni placeholder devono essere verificati prima di qualsiasi utilizzo esterno.
Il file e destinato a una valutazione grafica e commerciale.
E consigliato valutarlo sia da desktop sia da smartphone.
`;

@Injectable()
export class TenantSiteProposalsArtifactService {
  async createZip(html: string, redirects: { path: string; html: string }[]): Promise<GeneratedZip> {
    const entries = ['index.html', ...redirects.map((r) => r.path), 'README-ANTEPRIMA.txt'];
    const chunks: Buffer[] = [];
    const archive = archiver('zip', { zlib: { level: 9 } });
    const stream = new PassThrough();
    archive.pipe(stream);
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    const done = new Promise<void>((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
      archive.on('error', reject);
    });
    archive.append(html, { name: 'index.html' });
    for (const redirect of redirects) archive.append(redirect.html, { name: redirect.path });
    archive.append(README, { name: 'README-ANTEPRIMA.txt' });
    await archive.finalize();
    await done;
    const buffer = Buffer.concat(chunks);
    return { buffer, sha256: sha256(buffer), size: buffer.length, entries };
  }
}
