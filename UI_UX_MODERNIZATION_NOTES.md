# Doflow UI/UX modernization pass

Questo passaggio porta il linguaggio visivo di signup/onboarding sul resto della webapp, mantenendo la struttura improved/Odoo-style.

## Modifiche principali

- Shell applicativa tenant e superadmin con background gradient, griglia sottile e ambient blobs.
- Header tenant/superadmin trasformati in glass bar con blur e border morbido.
- `PageShell` e `PageHeader` aggiornati con hero premium, eyebrow, typography grande e actions responsive.
- `Card` globale trasformata in glass panel con border, blur, shadow e hover lift.
- `Button` globale aggiornato con gradient primary e varianti outline/secondary più moderne.
- Sidebar tenant aggiornata: active pill gradient, logo icon premium, colori semantic token invece di indigo hardcoded.
- Loading, empty, error e skeleton states allineati al nuovo stile.

## Filosofia

Non è stato smontato l'impianto SaaS CRM multi-tenant né la struttura modulare/Odoo-style. Il lavoro agisce sul design system condiviso e sui layout, così tutte le pagine che usano componenti comuni ricevono automaticamente il nuovo look.
