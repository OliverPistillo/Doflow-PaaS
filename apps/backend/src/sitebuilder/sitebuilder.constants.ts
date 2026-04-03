// apps/backend/src/sitebuilder/sitebuilder.constants.ts
// File separato per evitare la circular import:
//   sitebuilder.module.ts → SitebuilderProducerService → sitebuilder.module.ts
// Con questo file, producer.service e processor importano la costante da qui,
// non dal modulo, spezzando il ciclo.

export const SITEBUILDER_QUEUE = 'sitebuilder';