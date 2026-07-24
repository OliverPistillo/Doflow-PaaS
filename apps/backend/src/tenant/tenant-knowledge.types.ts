export const KNOWLEDGE_VISIBILITIES = ['private', 'team', 'admin'] as const;
export const KNOWLEDGE_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export const KNOWLEDGE_ARTICLE_TYPES = [
  'article',
  'procedure',
  'checklist',
  'guide',
  'policy',
  'note',
  'faq',
  'troubleshooting',
  'playbook',
] as const;

export const KNOWLEDGE_ARTICLE_STATUSES = ['draft', 'published', 'archived'] as const;
export const KNOWLEDGE_CONTENT_FORMATS = ['markdown', 'plain'] as const;

export const KNOWLEDGE_ENTITY_TYPES = [
  'company',
  'contact',
  'lead',
  'opportunity',
  'commercial_activity',
  'briefing',
  'quote',
  'project',
  'task',
  'milestone',
  'document',
  'contract',
  'contract_version',
  'paperwork_dossier',
  'paperwork_item',
  'invoice',
  'financial_deadline',
  'renewal',
  'team_member',
  'calendar_event',
  'automation_rule',
] as const;

export const KNOWLEDGE_RELATION_TYPES = [
  'related',
  'source',
  'procedure',
  'template',
  'reference',
  'attachment',
  'checklist',
  'note',
] as const;

export const KNOWLEDGE_FAVORITE_TARGET_TYPES = ['article', 'asset', 'operational_template'] as const;

export const KNOWLEDGE_ASSET_TYPES = [
  'document',
  'image',
  'video',
  'logo',
  'brand_asset',
  'template_file',
  'snippet',
  'link',
  'font_reference',
  'legal_document',
  'marketing_material',
  'other',
] as const;

export const KNOWLEDGE_ASSET_STATUSES = ['active', 'archived'] as const;

export const OPERATIONAL_TEMPLATE_TYPES = [
  'project_template',
  'task_checklist',
  'milestone_template',
  'briefing_template',
  'quote_item_set',
  'contract_checklist',
  'paperwork_item_set',
  'sales_followup',
  'onboarding_checklist',
  'qa_checklist',
  'launch_checklist',
  'maintenance_checklist',
  'email_snippet',
  'text_snippet',
  'document_outline',
  'generic',
] as const;

export const OPERATIONAL_TEMPLATE_CATEGORIES = [
  'sales',
  'projects',
  'finance',
  'documents',
  'contracts',
  'paperwork',
  'team',
  'calendar',
  'automations',
  'operations',
  'general',
] as const;

export const OPERATIONAL_TEMPLATE_STATUSES = ['draft', 'active', 'archived'] as const;
export const OPERATIONAL_TEMPLATE_USAGE_ACTIONS = ['used', 'previewed', 'applied', 'duplicated', 'exported'] as const;

export const KNOWLEDGE_ACTIVITY_ACTIONS = [
  'category_created',
  'category_updated',
  'category_deleted',
  'tag_created',
  'tag_updated',
  'tag_deleted',
  'article_created',
  'article_updated',
  'article_published',
  'article_archived',
  'article_reviewed',
  'article_deleted',
  'article_version_created',
  'article_linked',
  'article_unlinked',
  'asset_collection_created',
  'asset_collection_updated',
  'asset_collection_deleted',
  'asset_created',
  'asset_updated',
  'asset_archived',
  'asset_deleted',
  'template_created',
  'template_updated',
  'template_activated',
  'template_archived',
  'template_deleted',
  'template_version_created',
  'template_used',
  'favorite_added',
  'favorite_removed',
] as const;

export const FINANCE_KNOWLEDGE_CATEGORIES = new Set(['finance']);
export const FINANCE_KNOWLEDGE_ENTITIES = new Set(['invoice', 'financial_deadline', 'renewal']);

export const BASE_KNOWLEDGE_CATEGORIES = [
  'Procedure operative',
  'Vendite e CRM',
  'Progetti e consegna',
  'Finance interno',
  'Contratti e scartoffie',
  'Documenti e asset',
  'Team e onboarding',
  'Calendario e pianificazione',
  'Automazioni',
  'QA e lancio sito',
] as const;

export const BASE_ASSET_COLLECTIONS = [
  'Brand doflow',
  'Template documenti',
  'Materiali commerciali',
  'Asset clienti',
  'Legale',
  'Archivio operativo',
] as const;

export const BASE_OPERATIONAL_TEMPLATES = [
  {
    name: 'Checklist lancio sito',
    slug: 'checklist-lancio-sito',
    template_type: 'launch_checklist',
    category: 'projects',
    content: {
      items: [
        { title: 'Verifica responsive', required: true },
        { title: 'Verifica form', required: true },
        { title: 'Verifica performance', required: true },
        { title: 'Verifica SEO base', required: true },
        { title: 'Verifica analytics', required: true },
        { title: 'Verifica privacy/cookie', required: true },
        { title: 'Backup pre-lancio', required: true },
        { title: 'Controllo finale cliente', required: true },
      ],
    },
  },
  {
    name: 'QA sito web',
    slug: 'qa-sito-web',
    template_type: 'qa_checklist',
    category: 'projects',
    content: { items: [{ title: 'Eseguire checklist QA sul sito', required: true }] },
  },
  {
    name: 'Checklist onboarding cliente',
    slug: 'checklist-onboarding-cliente',
    template_type: 'onboarding_checklist',
    category: 'sales',
    content: { items: [{ title: 'Raccogliere dati e materiali iniziali', required: true }] },
  },
  {
    name: 'Checklist contratto firmato',
    slug: 'checklist-contratto-firmato',
    template_type: 'contract_checklist',
    category: 'contracts',
    content: { items: [{ title: 'Verificare contratto firmato e allegati', required: true }] },
  },
  {
    name: 'Set documenti pratica cliente',
    slug: 'set-documenti-pratica-cliente',
    template_type: 'paperwork_item_set',
    category: 'paperwork',
    content: { items: [{ title: 'Dati fatturazione', required: true }, { title: 'PEC / SDI', required: true }] },
  },
  {
    name: 'Follow-up preventivo',
    slug: 'follow-up-preventivo',
    template_type: 'sales_followup',
    category: 'sales',
    content: { body: 'Ciao {{client_name}}, ti scrivo per sapere se hai avuto modo di valutare il preventivo.' },
  },
  {
    name: 'Outline documento progetto',
    slug: 'outline-documento-progetto',
    template_type: 'document_outline',
    category: 'documents',
    content: { sections: ['Obiettivo', 'Ambito', 'Deliverable', 'Scadenze', 'Note operative'] },
  },
  {
    name: 'Manutenzione sito',
    slug: 'manutenzione-sito',
    template_type: 'maintenance_checklist',
    category: 'projects',
    content: { items: [{ title: 'Aggiornamenti e backup', required: true }, { title: 'Controllo uptime', required: true }] },
  },
] as const;
