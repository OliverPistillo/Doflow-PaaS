import { PageShell, PageHeader } from "@/components/ui/page-shell";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <PageShell padded={false} className="gap-8">
          <PageHeader
            title="Termini di Servizio"
            description="Condizioni generali di utilizzo della piattaforma Doflow"
          />

          <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none space-y-6 text-muted-foreground">
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground">1. Accettazione dei Termini</h2>
              <p>
                Utilizzando i servizi offerti da <strong>Doflow</strong>, l'utente accetta integralmente i presenti Termini di Servizio. Qualora non si accettino tali condizioni, si è pregati di non utilizzare la piattaforma.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground">2. Descrizione del Servizio</h2>
              <p>
                Doflow fornisce una piattaforma gestionale software-as-a-service (SaaS) per la gestione di workspace, progetti e team. Il servizio viene fornito "così com'è" ("as is") e Doflow si riserva il diritto di modificare, sospendere o interrompere qualsiasi funzionalità della piattaforma in qualsiasi momento.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground">3. Registrazione e Account</h2>
              <p>
                Per utilizzare Doflow, l'utente deve creare un account, fornendo informazioni accurate, complete e aggiornate. L'utente è responsabile di:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Mantenere la riservatezza delle proprie credenziali di accesso.</li>
                <li>Qualsiasi attività che avvenga sotto il proprio account.</li>
                <li>Comunicare tempestivamente a Doflow qualsiasi uso non autorizzato dell'account.</li>
              </ul>
              <p>È possibile registrarsi anche utilizzando provider di identità di terze parti (es. Google). In tal caso, si applicano anche le condizioni di servizio di tali provider.</p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground">4. Pagamenti e Fatturazione</h2>
              <p>
                Alcuni servizi di Doflow sono a pagamento e richiedono un abbonamento.
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>I pagamenti vengono elaborati in modo sicuro tramite il nostro partner <strong>Stripe</strong>.</li>
                <li>L'abbonamento si rinnova automaticamente alla fine del ciclo di fatturazione, a meno che non venga annullato prima della data di rinnovo.</li>
                <li>Le tariffe possono essere soggette a modifiche, che verranno comunicate agli utenti con un preavviso ragionevole.</li>
                <li>L'utente accetta di fornire informazioni di fatturazione valide e autorizza Doflow ad addebitare i costi previsti sul metodo di pagamento indicato.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground">5. Utilizzo Consentito e Restrizioni</h2>
              <p>
                L'utente accetta di utilizzare Doflow in conformità alle leggi vigenti e di <strong>non</strong> utilizzare la piattaforma per:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Caricare, trasmettere o distribuire contenuti illegali, offensivi, diffamatori o che violino i diritti di proprietà intellettuale di terzi.</li>
                <li>Tentare di ottenere accesso non autorizzato ai sistemi informatici di Doflow o di altri utenti.</li>
                <li>Interferire con il corretto funzionamento della piattaforma (es. tramite invio di virus, sovraccarico dei server, ecc.).</li>
                <li>Rivendere, noleggiare o sublicenziare i servizi di Doflow senza esplicita autorizzazione scritta.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground">6. Proprietà Intellettuale</h2>
              <p>
                Tutti i diritti di proprietà intellettuale relativi a Doflow (inclusi, a titolo esemplificativo ma non esaustivo, software, design, loghi e testi) sono di esclusiva proprietà di Doflow o dei suoi licenziatari. Nessun diritto viene trasferito all'utente, se non la licenza limitata di utilizzo del servizio secondo i presenti Termini.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground">7. Limitazione di Responsabilità</h2>
              <p>
                Nei limiti previsti dalla legge applicabile, Doflow non sarà responsabile per danni diretti, indiretti, incidentali, consequenziali o punitivi derivanti dall'utilizzo o dall'impossibilità di utilizzare il servizio. Doflow non garantisce che il servizio sarà ininterrotto, tempestivo, sicuro o privo di errori.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground">8. Risoluzione</h2>
              <p>
                Doflow si riserva il diritto di sospendere o chiudere l'account dell'utente in qualsiasi momento e senza preavviso, qualora si ritenga che l'utente abbia violato i presenti Termini di Servizio o per altre ragioni legittime.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground">9. Modifiche ai Termini</h2>
              <p>
                Doflow può aggiornare o modificare periodicamente i presenti Termini di Servizio. L'uso continuato della piattaforma dopo la pubblicazione delle modifiche costituisce accettazione dei nuovi termini.
              </p>
            </section>

            <p className="pt-8 text-sm italic">Ultimo aggiornamento: Giugno 2026</p>
          </div>
        </PageShell>
      </div>
    </main>
  );
}
