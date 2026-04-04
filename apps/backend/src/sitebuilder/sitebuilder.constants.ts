// apps/backend/src/sitebuilder/sitebuilder.constants.ts

export const SITEBUILDER_QUEUE = 'sitebuilder';

/** Lista dei Blocksy Starter Sites disponibili */
export interface BlocksyStarterSite {
  slug: string;
  label: string;
  previewUrl: string;
  category: string;
}

export const BLOCKSY_STARTER_SITES: BlocksyStarterSite[] = [
  { slug: 'business',          label: 'Business',           previewUrl: 'https://creativethemes.com/blocksy/starter-sites/business/',          category: 'Business' },
  { slug: 'creative-agency',   label: 'Creative Agency',    previewUrl: 'https://creativethemes.com/blocksy/starter-sites/creative-agency/',    category: 'Business' },
  { slug: 'consulting',        label: 'Consulting',         previewUrl: 'https://creativethemes.com/blocksy/starter-sites/consulting/',         category: 'Business' },
  { slug: 'digital-agency',    label: 'Digital Agency',     previewUrl: 'https://creativethemes.com/blocksy/starter-sites/digital-agency/',     category: 'Business' },
  { slug: 'law-firm',          label: 'Law Firm',           previewUrl: 'https://creativethemes.com/blocksy/starter-sites/law-firm/',           category: 'Business' },
  { slug: 'finance',           label: 'Finance',            previewUrl: 'https://creativethemes.com/blocksy/starter-sites/finance/',            category: 'Business' },
  { slug: 'restaurant',        label: 'Restaurant',         previewUrl: 'https://creativethemes.com/blocksy/starter-sites/restaurant/',         category: 'Food' },
  { slug: 'food-blog',         label: 'Food Blog',          previewUrl: 'https://creativethemes.com/blocksy/starter-sites/food-blog/',          category: 'Food' },
  { slug: 'portfolio',         label: 'Portfolio',          previewUrl: 'https://creativethemes.com/blocksy/starter-sites/portfolio/',          category: 'Creative' },
  { slug: 'photography',       label: 'Photography',        previewUrl: 'https://creativethemes.com/blocksy/starter-sites/photography/',        category: 'Creative' },
  { slug: 'architecture',      label: 'Architecture',       previewUrl: 'https://creativethemes.com/blocksy/starter-sites/architecture/',       category: 'Creative' },
  { slug: 'fashion',           label: 'Fashion',            previewUrl: 'https://creativethemes.com/blocksy/starter-sites/fashion/',            category: 'Creative' },
  { slug: 'ecommerce',         label: 'eCommerce',          previewUrl: 'https://creativethemes.com/blocksy/starter-sites/ecommerce/',          category: 'Shop' },
  { slug: 'fitness',           label: 'Fitness',            previewUrl: 'https://creativethemes.com/blocksy/starter-sites/fitness/',            category: 'Health' },
  { slug: 'medical',           label: 'Medical',            previewUrl: 'https://creativethemes.com/blocksy/starter-sites/medical/',            category: 'Health' },
  { slug: 'health-wellness',   label: 'Health & Wellness',  previewUrl: 'https://creativethemes.com/blocksy/starter-sites/health-wellness/',   category: 'Health' },
  { slug: 'real-estate',       label: 'Real Estate',        previewUrl: 'https://creativethemes.com/blocksy/starter-sites/real-estate/',        category: 'Services' },
  { slug: 'travel',            label: 'Travel',             previewUrl: 'https://creativethemes.com/blocksy/starter-sites/travel/',             category: 'Lifestyle' },
  { slug: 'wedding',           label: 'Wedding',            previewUrl: 'https://creativethemes.com/blocksy/starter-sites/wedding/',            category: 'Lifestyle' },
  { slug: 'blog',              label: 'Blog',               previewUrl: 'https://creativethemes.com/blocksy/starter-sites/blog/',               category: 'Blog' },
  { slug: 'saas',              label: 'SaaS / Software',    previewUrl: 'https://creativethemes.com/blocksy/starter-sites/saas/',               category: 'Tech' },
];