import { PageShell, PageHeader } from "@/components/ui/page-shell";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <PageShell padded={false} className="gap-8">
          <PageHeader
            title="Privacy Policy"
            description="Informativa sul trattamento dei dati personali (art. 13 D.Lgs. 196/2003 e art. 13 Regolamento UE 2016/679 - GDPR)"
          />

          <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none space-y-6 text-muted-foreground">
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground">1. Titolare del Trattamento</h2>
              <p>
                Il Titolare del trattamento dei dati personali è <strong>Doflow</strong>. Per qualsiasi richiesta relativa alla privacy o per esercitare i diritti previsti dalla normativa, è possibile contattare il Titolare.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground">2. Tipologia di Dati Trattati</h2>
              <p>
                Doflow raccoglie e tratta le seguenti categorie di dati:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Dati di navigazione:</strong> indirizzi IP, nomi a dominio dei computer utilizzati dagli utenti che si connettono al sito, orari delle richieste e altri parametri relativi al sistema operativo e all'ambiente informatico dell'utente.</li>
                <li><strong>Dati forniti volontariamente dall'utente:</strong> indirizzo email, nome, cognome e altre informazioni fornite durante la registrazione o l'utilizzo dei servizi.</li>
                <li><strong>Dati di autenticazione:</strong> in caso di utilizzo di servizi di Single Sign-On (es. Google), raccogliamo i dati strettamente necessari all'autenticazione.</li>
                <li><strong>Dati di pagamento:</strong> per la gestione degli abbonamenti, ci avvaliamo di fornitori terzi (es. Stripe) che elaborano i dati di fatturazione e le carte di credito. Doflow non memorizza direttamente i dati completi delle carte di credito.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground">3. Finalità del Trattamento</h2>
              <p>I dati raccolti vengono utilizzati per le seguenti finalità:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Erogazione dei servizi offerti dalla piattaforma Doflow.</li>
                <li>Gestione degli account utente e delle procedure di autenticazione, anche tramite provider esterni come Google.</li>
                <li>Gestione dei pagamenti e fatturazione tramite provider specializzati (Stripe).</li>
                <li>Comunicazioni di servizio, aggiornamenti tecnici e supporto al cliente.</li>
                <li>Adempimento di obblighi previsti dalla legge, da regolamenti o dalla normativa comunitaria.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground">4. Fornitori di Servizi Terzi</h2>
              <p>
                Per poter offrire i nostri servizi, condividiamo alcuni dati con partner tecnologici selezionati che operano in qualità di Responsabili del trattamento, garantendo standard di sicurezza adeguati:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Google LLC:</strong> Utilizzato per i servizi di autenticazione (OAuth) e infrastruttura.</li>
                <li><strong>Stripe Inc.:</strong> Utilizzato per l'elaborazione sicura dei pagamenti e la gestione degli abbonamenti. Stripe raccoglie e processa i dati di pagamento in conformità ai propri standard di sicurezza (PCI-DSS).</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground">5. Modalità e Tempi di Conservazione</h2>
              <p>
                Il trattamento è effettuato mediante strumenti informatici e/o telematici, con logiche strettamente correlate alle finalità indicate e, in ogni caso, in modo da garantire la sicurezza e la riservatezza dei dati stessi. I dati sono conservati per il tempo strettamente necessario a conseguire gli scopi per cui sono stati raccolti, o fino a quando l'utente non richiede la cancellazione del proprio account, fatto salvo l'obbligo di conservazione dettato da normative fiscali o legali.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground">6. Diritti dell'Interessato</h2>
              <p>
                Ai sensi degli artt. 15-22 del GDPR, l'utente ha il diritto di:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Ottenere la conferma dell'esistenza o meno di dati personali che lo riguardano e l'accesso agli stessi.</li>
                <li>Ottenere l'aggiornamento, la rettifica o l'integrazione dei dati.</li>
                <li>Richiedere la cancellazione, la trasformazione in forma anonima o il blocco dei dati trattati in violazione di legge.</li>
                <li>Opporsi in tutto o in parte al trattamento.</li>
                <li>Esercitare il diritto alla portabilità dei dati.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-foreground">7. Modifiche a questa Policy</h2>
              <p>
                Doflow si riserva il diritto di apportare modifiche alla presente Privacy Policy in qualunque momento, dandone informazione agli utenti su questa pagina. Si prega dunque di consultare regolarmente questa pagina, facendo riferimento alla data di ultima modifica indicata in fondo.
              </p>
            </section>

            <p className="pt-8 text-sm italic">Ultimo aggiornamento: Giugno 2026</p>
          </div>
        </PageShell>
      </div>
    </main>
  );
}
