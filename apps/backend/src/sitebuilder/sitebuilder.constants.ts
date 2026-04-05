// apps/backend/src/sitebuilder/sitebuilder.constants.ts

export const SITEBUILDER_QUEUE = 'sitebuilder';

export interface BlocksyStarterSite {
  slug: string;
  label: string;
  previewUrl: string;
  category: string;
  isPro: boolean;
}

export const BLOCKSY_STARTER_SITES: BlocksyStarterSite[] = [
  // ── FREE ───────────────────────────────────────────────────────────────────
  { slug: 'codespot',       label: 'Codespot',        previewUrl: 'https://creativethemes.com/blocksy/starter-site/codespot/',       category: 'Tech',      isPro: false },
  { slug: 'consultant',     label: 'Consultant',       previewUrl: 'https://creativethemes.com/blocksy/starter-site/consultant/',     category: 'Business',  isPro: false },
  { slug: 'smile-dent',     label: 'Smile Dent',       previewUrl: 'https://creativethemes.com/blocksy/starter-site/smile-dent/',     category: 'Salute',    isPro: false },
  { slug: 'photo-studio',   label: 'Photo Studio',     previewUrl: 'https://creativethemes.com/blocksy/starter-site/photo-studio/',   category: 'Portfolio', isPro: false },
  { slug: 'restaurant',     label: 'Restaurant',       previewUrl: 'https://creativethemes.com/blocksy/starter-site/restaurant/',     category: 'Food',      isPro: false },
  { slug: 'wood',           label: 'Wood',             previewUrl: 'https://creativethemes.com/blocksy/starter-site/wood/',           category: 'eCommerce', isPro: false },
  { slug: 'beauty-salon',   label: 'Beauty Salon',     previewUrl: 'https://creativethemes.com/blocksy/starter-site/beauty-salon/',   category: 'Salute',    isPro: false },
  { slug: 'yoga',           label: 'Yoga',             previewUrl: 'https://creativethemes.com/blocksy/starter-site/yoga/',           category: 'Sport',     isPro: false },
  { slug: 'travel-blog',    label: 'Travel Blog',      previewUrl: 'https://creativethemes.com/blocksy/starter-site/travel-blog/',    category: 'Blog',      isPro: false },
  { slug: 'mechanic',       label: 'Mechanic',         previewUrl: 'https://creativethemes.com/blocksy/starter-site/mechanic/',       category: 'Servizi',   isPro: false },
  { slug: 'wedding',        label: 'Wedding',          previewUrl: 'https://creativethemes.com/blocksy/starter-site/wedding/',        category: 'Lifestyle', isPro: false },
  { slug: 'architecture',   label: 'Architecture',     previewUrl: 'https://creativethemes.com/blocksy/starter-site/architecture/',   category: 'Portfolio', isPro: false },
  { slug: 'online-shop',    label: 'Online Shop',      previewUrl: 'https://creativethemes.com/blocksy/starter-site/online-shop/',    category: 'eCommerce', isPro: false },
  { slug: 'freelancer',     label: 'Freelancer',       previewUrl: 'https://creativethemes.com/blocksy/starter-site/freelancer/',     category: 'Portfolio', isPro: false },
  { slug: 'digital-agency', label: 'Digital Agency',   previewUrl: 'https://creativethemes.com/blocksy/starter-site/digital-agency/', category: 'Business',  isPro: false },
  { slug: 'news-magazine',  label: 'News Magazine',    previewUrl: 'https://creativethemes.com/blocksy/starter-site/news-magazine/',  category: 'Blog',      isPro: false },
  // ── PRO ────────────────────────────────────────────────────────────────────
  { slug: 'growly',         label: 'Growly',           previewUrl: 'https://creativethemes.com/blocksy/starter-site/growly/',         category: 'Business',  isPro: true },
  { slug: 'book-store',     label: 'Book Store',       previewUrl: 'https://creativethemes.com/blocksy/starter-site/book-store/',     category: 'eCommerce', isPro: true },
  { slug: 'web-studio',     label: 'Web Studio',       previewUrl: 'https://creativethemes.com/blocksy/starter-site/web-studio/',     category: 'Business',  isPro: true },
  { slug: 'invest-boost',   label: 'Invest Boost',     previewUrl: 'https://creativethemes.com/blocksy/starter-site/invest-boost/',   category: 'Finance',   isPro: true },
  { slug: 'furniture',      label: 'Furniture',        previewUrl: 'https://creativethemes.com/blocksy/starter-site/furniture/',      category: 'eCommerce', isPro: true },
  { slug: 'e-bike',         label: 'E-Bike',           previewUrl: 'https://creativethemes.com/blocksy/starter-site/e-bike/',         category: 'eCommerce', isPro: true },
  { slug: 'pottery',        label: 'Pottery',          previewUrl: 'https://creativethemes.com/blocksy/starter-site/pottery/',        category: 'eCommerce', isPro: true },
  { slug: 'smart-home',     label: 'Smart Home',       previewUrl: 'https://creativethemes.com/blocksy/starter-site/smart-home/',     category: 'eCommerce', isPro: true },
  { slug: 'daily-news',     label: 'Daily News',       previewUrl: 'https://creativethemes.com/blocksy/starter-site/daily-news/',     category: 'Blog',      isPro: true },
  { slug: 'cosmetic',       label: 'Cosmetic',         previewUrl: 'https://creativethemes.com/blocksy/starter-site/cosmetic/',       category: 'eCommerce', isPro: true },
  { slug: 'real-estate',    label: 'Real Estate',      previewUrl: 'https://creativethemes.com/blocksy/starter-site/real-estate/',    category: 'Business',  isPro: true },
  { slug: 'kiddy',          label: 'Kiddy',            previewUrl: 'https://creativethemes.com/blocksy/starter-site/kiddy/',          category: 'eCommerce', isPro: true },
  { slug: 'landscape',      label: 'Landscape',        previewUrl: 'https://creativethemes.com/blocksy/starter-site/landscape/',      category: 'Blog',      isPro: true },
];