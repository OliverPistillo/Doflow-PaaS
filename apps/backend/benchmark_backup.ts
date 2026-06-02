import { BackupService } from './src/superadmin/backup.service';
// Let's create a quick mock to test the execution time
const mockDeleteBackup = async (id: string) => {
    return new Promise(resolve => setTimeout(resolve, 50));
};

async function benchmark() {
    const old = Array.from({length: 20}, (_, i) => ({ id: `id-${i}` }));

    console.time('Sequential');
    for (const b of old) {
        try { await mockDeleteBackup(b.id); } catch {}
    }
    console.timeEnd('Sequential');

    console.time('Parallel');
    await Promise.allSettled(old.map(b => mockDeleteBackup(b.id)));
    console.timeEnd('Parallel');
}

benchmark();
