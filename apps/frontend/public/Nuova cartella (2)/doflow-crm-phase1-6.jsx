import { useState } from "react";
import { Search, Plus, ChevronDown, CheckCircle, Circle, Clock, AlertCircle, Users, ListTodo, Settings, LayoutDashboard, UserPlus, Mail, Phone, MoreHorizontal, Edit2, Trash2, Filter, ArrowUpDown, Star, StarOff, Bell, Moon, Sun, Globe, Lock, CreditCard, LogOut, ChevronRight, Calendar, Tag, User, Building, TrendingUp, Eye, X, Check, Briefcase, FileText, DollarSign, ArrowRight, GripVertical, Target, Activity, MessageSquare, Paperclip, Send, Hash, MapPin, ExternalLink, Copy, Archive, RotateCcw, ChevronLeft, Percent, Receipt, Download, Printer, PenTool, Package, Handshake, ThumbsUp, ThumbsDown, AlertTriangle, BarChart3, Layers, Grid3X3, List, ShoppingCart, Truck, Box, Image, ToggleLeft, Minus, ChevronUp, Repeat, Zap, ShoppingBag, Wallet, ArrowDownCircle, ArrowUpCircle, PieChart, Upload, Camera, Banknote, BadgeCheck, Shield, Sparkles, Crown, CircleDollarSign, Inbox, Reply, ReplyAll, Forward, Folder, FolderOpen, File, FileImage, FileSpreadsheet, FilePlus, FolderPlus, Link2, Type, AlignLeft, Bold, Italic, Underline, Code, AtSign, MailOpen, Warehouse, PackageCheck, PackageX, AlertOctagon, RotateCw, Timer, Play, Pause, Square, Coffee, Workflow, Plug, ShieldCheck, Key, Fingerprint, History, AlertCircle as AlertCircle2, Server, Database, Cloud, Webhook, GitBranch, BarChart2, LineChart, PieChart as PieChart2, TrendingDown, Gauge, ScanLine } from "lucide-react";

// ─── DATA ────────────────────────────────────────────────────
const INITIAL_TASKS = [
  { id: 1, title: "Redesign landing page", status: "in_progress", priority: "high", assignee: "Marco R.", due: "2026-02-22", tags: ["Design", "Frontend"], starred: true },
  { id: 2, title: "Setup CI/CD pipeline", status: "done", priority: "medium", assignee: "Giulia B.", due: "2026-02-18", tags: ["DevOps"], starred: false },
  { id: 3, title: "Write API documentation", status: "todo", priority: "low", assignee: "Luca P.", due: "2026-02-25", tags: ["Docs"], starred: false },
  { id: 4, title: "Database migration to PostgreSQL", status: "in_progress", priority: "high", assignee: "Sara M.", due: "2026-02-20", tags: ["Backend", "DB"], starred: true },
  { id: 5, title: "User onboarding flow", status: "todo", priority: "high", assignee: "Marco R.", due: "2026-02-28", tags: ["UX", "Frontend"], starred: false },
  { id: 6, title: "Performance audit", status: "todo", priority: "medium", assignee: "Giulia B.", due: "2026-03-01", tags: ["DevOps"], starred: false },
  { id: 7, title: "Email template system", status: "done", priority: "low", assignee: "Luca P.", due: "2026-02-15", tags: ["Backend"], starred: false },
  { id: 8, title: "Mobile responsive fixes", status: "in_progress", priority: "medium", assignee: "Sara M.", due: "2026-02-21", tags: ["Frontend"], starred: true },
];

const INITIAL_USERS = [
  { id: 1, name: "Marco Rossi", email: "marco@example.com", phone: "+39 333 1234567", role: "Designer", status: "active", type: "user", company: "TechCo", avatar: "MR" },
  { id: 2, name: "Giulia Bianchi", email: "giulia@example.com", phone: "+39 334 2345678", role: "Developer", status: "active", type: "user", company: "TechCo", avatar: "GB" },
  { id: 3, name: "Luca Pellegrini", email: "luca@example.com", phone: "+39 335 3456789", role: "Writer", status: "active", type: "user", company: "TechCo", avatar: "LP" },
  { id: 4, name: "Sara Moretti", email: "sara@example.com", phone: "+39 336 4567890", role: "Engineer", status: "active", type: "user", company: "TechCo", avatar: "SM" },
  { id: 5, name: "Andrea Conti", email: "andrea@example.com", phone: "+39 337 5678901", role: "Manager", status: "inactive", type: "user", company: "TechCo", avatar: "AC" },
];

const INITIAL_LEADS = [
  { id: 101, name: "Francesca Romano", email: "francesca@startup.io", phone: "+39 338 6789012", company: "StartupIO", source: "Website", status: "new", score: 85, avatar: "FR" },
  { id: 102, name: "Alessandro Galli", email: "ale@bigcorp.com", phone: "+39 339 7890123", company: "BigCorp", source: "Referral", status: "contacted", score: 72, avatar: "AG" },
  { id: 103, name: "Elena Ferri", email: "elena@design.studio", phone: "+39 340 8901234", company: "DesignStudio", source: "LinkedIn", status: "qualified", score: 91, avatar: "EF" },
  { id: 104, name: "Roberto Mazza", email: "rob@innovate.it", phone: "+39 341 9012345", company: "InnovateIT", source: "Event", status: "new", score: 63, avatar: "RM" },
  { id: 105, name: "Chiara Lombardi", email: "chiara@mediagroup.it", phone: "+39 342 0123456", company: "MediaGroup", source: "Ads", status: "contacted", score: 78, avatar: "CL" },
];

// ─── PHASE 1 DATA ───────────────────────────────────────────
const CONTACTS = [
  { id: 1, name: "Francesca Romano", email: "francesca@startup.io", phone: "+39 338 6789012", company: "StartupIO", companyId: 1, role: "CEO", avatar: "FR", type: "lead", tags: ["Decision Maker", "Tech"], lastContact: "2026-02-18", city: "Milano" },
  { id: 2, name: "Alessandro Galli", email: "ale@bigcorp.com", phone: "+39 339 7890123", company: "BigCorp SpA", companyId: 2, role: "CTO", avatar: "AG", type: "lead", tags: ["Tecnico"], lastContact: "2026-02-15", city: "Roma" },
  { id: 3, name: "Elena Ferri", email: "elena@design.studio", phone: "+39 340 8901234", company: "DesignStudio Srl", companyId: 3, role: "Creative Director", avatar: "EF", type: "cliente", tags: ["Decision Maker", "Design"], lastContact: "2026-02-19", city: "Torino" },
  { id: 4, name: "Roberto Mazza", email: "rob@innovate.it", phone: "+39 341 9012345", company: "InnovateIT", companyId: 4, role: "Head of Product", avatar: "RM", type: "lead", tags: ["Product"], lastContact: "2026-02-10", city: "Bologna" },
  { id: 5, name: "Chiara Lombardi", email: "chiara@mediagroup.it", phone: "+39 342 0123456", company: "MediaGroup Italia", companyId: 5, role: "Marketing Manager", avatar: "CL", type: "lead", tags: ["Marketing"], lastContact: "2026-02-17", city: "Napoli" },
  { id: 6, name: "Marco Ferretti", email: "marco.f@digitalwave.it", phone: "+39 343 1234567", company: "DigitalWave Srl", companyId: 6, role: "Founder", avatar: "MF", type: "cliente", tags: ["Decision Maker", "Startup"], lastContact: "2026-02-20", city: "Firenze" },
  { id: 7, name: "Valentina Ricci", email: "v.ricci@nexuslab.com", phone: "+39 344 2345678", company: "NexusLab", companyId: 7, role: "Operations Manager", avatar: "VR", type: "lead", tags: ["Operazioni"], lastContact: "2026-02-12", city: "Milano" },
  { id: 8, name: "Davide Colombo", email: "d.colombo@smartfactory.it", phone: "+39 345 3456789", company: "SmartFactory", companyId: 8, role: "CEO", avatar: "DC", type: "cliente", tags: ["Decision Maker", "Manufacturing"], lastContact: "2026-02-14", city: "Brescia" },
];

const COMPANIES = [
  { id: 1, name: "StartupIO", sector: "Tech", employees: "10-50", revenue: "€500K", city: "Milano", website: "startup.io", contacts: 2, deals: 1, avatar: "SI", status: "attivo", vat: "IT12345678901" },
  { id: 2, name: "BigCorp SpA", sector: "Enterprise", employees: "500+", revenue: "€50M", city: "Roma", website: "bigcorp.com", contacts: 3, deals: 2, avatar: "BC", status: "attivo", vat: "IT23456789012" },
  { id: 3, name: "DesignStudio Srl", sector: "Design", employees: "10-50", revenue: "€1.2M", city: "Torino", website: "design.studio", contacts: 2, deals: 1, avatar: "DS", status: "attivo", vat: "IT34567890123" },
  { id: 4, name: "InnovateIT", sector: "Tech", employees: "50-200", revenue: "€5M", city: "Bologna", website: "innovate.it", contacts: 1, deals: 1, avatar: "IN", status: "prospect", vat: "IT45678901234" },
  { id: 5, name: "MediaGroup Italia", sector: "Media", employees: "200-500", revenue: "€20M", city: "Napoli", website: "mediagroup.it", contacts: 4, deals: 2, avatar: "MG", status: "attivo", vat: "IT56789012345" },
  { id: 6, name: "DigitalWave Srl", sector: "Digital", employees: "10-50", revenue: "€800K", city: "Firenze", website: "digitalwave.it", contacts: 1, deals: 1, avatar: "DW", status: "attivo", vat: "IT67890123456" },
  { id: 7, name: "NexusLab", sector: "Consulting", employees: "50-200", revenue: "€3M", city: "Milano", website: "nexuslab.com", contacts: 2, deals: 0, avatar: "NL", status: "prospect", vat: "IT78901234567" },
  { id: 8, name: "SmartFactory", sector: "Manufacturing", employees: "200-500", revenue: "€15M", city: "Brescia", website: "smartfactory.it", contacts: 3, deals: 2, avatar: "SF", status: "attivo", vat: "IT89012345678" },
];

const DEALS = [
  { id: 1, title: "Piattaforma e-commerce StartupIO", company: "StartupIO", companyId: 1, contact: "Francesca Romano", value: 28000, stage: "proposta", probability: 60, closeDate: "2026-03-15", owner: "Marco R.", createdAt: "2026-01-20", tags: ["E-commerce", "Web"], priority: "high" },
  { id: 2, title: "Migrazione cloud BigCorp", company: "BigCorp SpA", companyId: 2, contact: "Alessandro Galli", value: 95000, stage: "negoziazione", probability: 75, closeDate: "2026-04-01", owner: "Giulia B.", createdAt: "2026-01-05", tags: ["Cloud", "Enterprise"], priority: "high" },
  { id: 3, title: "Redesign brand DesignStudio", company: "DesignStudio Srl", companyId: 3, contact: "Elena Ferri", value: 12000, stage: "vinto", probability: 100, closeDate: "2026-02-10", owner: "Marco R.", createdAt: "2025-12-15", tags: ["Branding"], priority: "medium" },
  { id: 4, title: "App mobile InnovateIT", company: "InnovateIT", companyId: 4, contact: "Roberto Mazza", value: 45000, stage: "contatto", probability: 30, closeDate: "2026-05-01", owner: "Luca P.", createdAt: "2026-02-01", tags: ["Mobile", "App"], priority: "medium" },
  { id: 5, title: "Campagna digital MediaGroup", company: "MediaGroup Italia", companyId: 5, contact: "Chiara Lombardi", value: 18500, stage: "proposta", probability: 50, closeDate: "2026-03-20", owner: "Sara M.", createdAt: "2026-01-25", tags: ["Marketing", "Digital"], priority: "low" },
  { id: 6, title: "CRM integrato SmartFactory", company: "SmartFactory", companyId: 8, contact: "Davide Colombo", value: 67000, stage: "negoziazione", probability: 80, closeDate: "2026-03-30", owner: "Giulia B.", createdAt: "2025-12-20", tags: ["CRM", "ERP"], priority: "high" },
  { id: 7, title: "Sito web DigitalWave", company: "DigitalWave Srl", companyId: 6, contact: "Marco Ferretti", value: 8500, stage: "vinto", probability: 100, closeDate: "2026-02-05", owner: "Luca P.", createdAt: "2025-11-30", tags: ["Web"], priority: "low" },
  { id: 8, title: "Consulenza AI BigCorp", company: "BigCorp SpA", companyId: 2, contact: "Alessandro Galli", value: 120000, stage: "contatto", probability: 20, closeDate: "2026-06-01", owner: "Marco R.", createdAt: "2026-02-10", tags: ["AI", "Consulting"], priority: "high" },
  { id: 9, title: "Portale dipendenti MediaGroup", company: "MediaGroup Italia", companyId: 5, contact: "Chiara Lombardi", value: 32000, stage: "nuovo", probability: 10, closeDate: "2026-06-15", owner: "Sara M.", createdAt: "2026-02-18", tags: ["HR", "Web"], priority: "medium" },
  { id: 10, title: "Automazione NexusLab", company: "NexusLab", companyId: 7, contact: "Valentina Ricci", value: 22000, stage: "nuovo", probability: 15, closeDate: "2026-05-20", owner: "Giulia B.", createdAt: "2026-02-15", tags: ["Automation"], priority: "low" },
  { id: 11, title: "Piano SEO StartupIO", company: "StartupIO", companyId: 1, contact: "Francesca Romano", value: 6000, stage: "perso", probability: 0, closeDate: "2026-02-01", owner: "Luca P.", createdAt: "2025-12-01", lostReason: "Budget insufficiente", tags: ["SEO"], priority: "low" },
];

const QUOTES = [
  { id: "PRV-2026-001", title: "Piattaforma e-commerce StartupIO", company: "StartupIO", contact: "Francesca Romano", dealId: 1, status: "inviato", issueDate: "2026-02-10", expiryDate: "2026-03-10", subtotal: 23500, vat: 5170, total: 28670, items: [{ desc: "Sviluppo frontend e-commerce", qty: 1, price: 12000 }, { desc: "Backend e API", qty: 1, price: 8000 }, { desc: "Design UX/UI", qty: 1, price: 3500 }] },
  { id: "PRV-2026-002", title: "Migrazione cloud BigCorp", company: "BigCorp SpA", contact: "Alessandro Galli", dealId: 2, status: "accettato", issueDate: "2026-01-20", expiryDate: "2026-02-20", subtotal: 77868, vat: 17131, total: 95000, items: [{ desc: "Assessment infrastruttura", qty: 1, price: 15000 }, { desc: "Migrazione servizi cloud", qty: 1, price: 45000 }, { desc: "Formazione team", qty: 40, price: 446.7 }] },
  { id: "PRV-2026-003", title: "Redesign brand DesignStudio", company: "DesignStudio Srl", contact: "Elena Ferri", dealId: 3, status: "accettato", issueDate: "2025-12-20", expiryDate: "2026-01-20", subtotal: 9836, vat: 2164, total: 12000, items: [{ desc: "Brand strategy", qty: 1, price: 3000 }, { desc: "Logo e visual identity", qty: 1, price: 4500 }, { desc: "Brand guidelines", qty: 1, price: 2336 }] },
  { id: "PRV-2026-004", title: "App mobile InnovateIT", company: "InnovateIT", contact: "Roberto Mazza", dealId: 4, status: "bozza", issueDate: "2026-02-18", expiryDate: "2026-03-18", subtotal: 36885, vat: 8115, total: 45000, items: [{ desc: "Sviluppo iOS", qty: 1, price: 15000 }, { desc: "Sviluppo Android", qty: 1, price: 15000 }, { desc: "Design UI/UX mobile", qty: 1, price: 6885 }] },
  { id: "PRV-2026-005", title: "Campagna digital MediaGroup", company: "MediaGroup Italia", contact: "Chiara Lombardi", dealId: 5, status: "inviato", issueDate: "2026-02-05", expiryDate: "2026-03-05", subtotal: 15164, vat: 3336, total: 18500, items: [{ desc: "Strategia digital", qty: 1, price: 5000 }, { desc: "Content creation (6 mesi)", qty: 6, price: 1200 }, { desc: "Gestione campagne Ads", qty: 3, price: 1054.67 }] },
  { id: "PRV-2026-006", title: "CRM integrato SmartFactory", company: "SmartFactory", contact: "Davide Colombo", dealId: 6, status: "inviato", issueDate: "2026-02-12", expiryDate: "2026-03-12", subtotal: 54918, vat: 12082, total: 67000, items: [{ desc: "Implementazione CRM", qty: 1, price: 30000 }, { desc: "Integrazione ERP", qty: 1, price: 18000 }, { desc: "Training e supporto", qty: 1, price: 6918 }] },
  { id: "PRV-2026-007", title: "Sito web DigitalWave", company: "DigitalWave Srl", contact: "Marco Ferretti", dealId: 7, status: "accettato", issueDate: "2025-12-01", expiryDate: "2025-12-31", subtotal: 6967, vat: 1533, total: 8500, items: [{ desc: "Sviluppo sito web", qty: 1, price: 5000 }, { desc: "Copywriting", qty: 1, price: 1967 }] },
  { id: "PRV-2026-008", title: "Piano SEO StartupIO", company: "StartupIO", contact: "Francesca Romano", dealId: 11, status: "rifiutato", issueDate: "2025-12-10", expiryDate: "2026-01-10", subtotal: 4918, vat: 1082, total: 6000, items: [{ desc: "Audit SEO", qty: 1, price: 1500 }, { desc: "Ottimizzazione on-page", qty: 1, price: 2000 }, { desc: "Link building (3 mesi)", qty: 3, price: 472.67 }] },
];

const CUSTOMER_ACTIVITIES = [
  { id: 1, type: "email", text: "Email inviata: Proposta commerciale piattaforma e-commerce", date: "2026-02-18 14:30", user: "Marco R." },
  { id: 2, type: "call", text: "Chiamata: Discussione requisiti tecnici — 25 min", date: "2026-02-16 10:00", user: "Giulia B." },
  { id: 3, type: "note", text: "Il cliente ha confermato il budget di €28K per il progetto e-commerce. Preferisce React + Node.js.", date: "2026-02-15 16:45", user: "Marco R." },
  { id: 4, type: "meeting", text: "Meeting online: Presentazione demo prototipo", date: "2026-02-12 11:00", user: "Marco R." },
  { id: 5, type: "deal", text: "Deal creata: Piattaforma e-commerce StartupIO — €28.000", date: "2026-01-20 09:00", user: "Marco R." },
  { id: 6, type: "email", text: "Email ricevuta: Richiesta informazioni servizi", date: "2026-01-18 08:15", user: "Sistema" },
  { id: 7, type: "note", text: "Primo contatto tramite form del sito web. Interessata a soluzioni e-commerce per il lancio Q2.", date: "2026-01-15 12:00", user: "Sara M." },
];

// ─── PHASE 2 DATA ───────────────────────────────────────────
const PRODUCTS = [
  { id: 1, name: "Sviluppo Sito Web", sku: "SRV-WEB-001", category: "Servizi Web", type: "servizio", price: 5000, unit: "progetto", status: "attivo", description: "Progettazione e sviluppo sito web responsive completo", image: "🌐", stock: null, taxRate: 22 },
  { id: 2, name: "App Mobile iOS/Android", sku: "SRV-APP-001", category: "Servizi Mobile", type: "servizio", price: 15000, unit: "progetto", status: "attivo", description: "Sviluppo app nativa cross-platform con React Native", image: "📱", stock: null, taxRate: 22 },
  { id: 3, name: "Consulenza UX/UI", sku: "SRV-UX-001", category: "Design", type: "servizio", price: 120, unit: "ora", status: "attivo", description: "Analisi e progettazione esperienza utente e interfacce", image: "🎨", stock: null, taxRate: 22 },
  { id: 4, name: "SEO & Content Strategy", sku: "SRV-SEO-001", category: "Marketing", type: "servizio", price: 800, unit: "mese", status: "attivo", description: "Ottimizzazione motori di ricerca e strategia contenuti", image: "📈", stock: null, taxRate: 22 },
  { id: 5, name: "Hosting Cloud Premium", sku: "PRD-HST-001", category: "Infrastruttura", type: "prodotto", price: 49, unit: "mese", status: "attivo", description: "Hosting cloud ad alte prestazioni con CDN inclusa", image: "☁️", stock: 200, taxRate: 22 },
  { id: 6, name: "Licenza CRM DoFlow", sku: "PRD-CRM-001", category: "Software", type: "prodotto", price: 29, unit: "utente/mese", status: "attivo", description: "Licenza mensile piattaforma CRM DoFlow Pro", image: "💼", stock: null, taxRate: 22 },
  { id: 7, name: "Migrazione Cloud", sku: "SRV-CLD-001", category: "Infrastruttura", type: "servizio", price: 8000, unit: "progetto", status: "attivo", description: "Migrazione completa infrastruttura verso il cloud", image: "🔄", stock: null, taxRate: 22 },
  { id: 8, name: "Formazione Team", sku: "SRV-TRN-001", category: "Formazione", type: "servizio", price: 450, unit: "giornata", status: "attivo", description: "Sessione formativa personalizzata per il team", image: "🎓", stock: null, taxRate: 22 },
  { id: 9, name: "Brand Identity Package", sku: "SRV-BRD-001", category: "Design", type: "servizio", price: 3500, unit: "progetto", status: "attivo", description: "Logo, palette colori, tipografia, brand guidelines", image: "✨", stock: null, taxRate: 22 },
  { id: 10, name: "Plugin E-commerce", sku: "PRD-ECM-001", category: "Software", type: "prodotto", price: 199, unit: "licenza", status: "sospeso", description: "Modulo e-commerce avanzato per piattaforma web", image: "🛒", stock: 50, taxRate: 22 },
  { id: 11, name: "Supporto Premium 24/7", sku: "SRV-SUP-001", category: "Supporto", type: "servizio", price: 500, unit: "mese", status: "attivo", description: "Assistenza tecnica dedicata con SLA garantito", image: "🛡️", stock: null, taxRate: 22 },
  { id: 12, name: "Analisi Dati & BI", sku: "SRV-ANA-001", category: "Consulenza", type: "servizio", price: 150, unit: "ora", status: "attivo", description: "Business intelligence e analisi dati avanzata", image: "📊", stock: null, taxRate: 22 },
];

const PRODUCT_CATEGORIES = ["Servizi Web", "Servizi Mobile", "Design", "Marketing", "Infrastruttura", "Software", "Formazione", "Supporto", "Consulenza"];

const ORDERS = [
  { id: "ORD-2026-001", company: "StartupIO", contact: "Francesca Romano", status: "confermato", date: "2026-02-15", deliveryDate: "2026-03-15", items: [{ productId: 1, name: "Sviluppo Sito Web", qty: 1, price: 5000 }, { productId: 3, name: "Consulenza UX/UI", qty: 20, price: 120 }], subtotal: 7400, vat: 1628, total: 9028, notes: "Consegna prima fase entro fine febbraio", paymentMethod: "Bonifico 30gg" },
  { id: "ORD-2026-002", company: "BigCorp SpA", contact: "Alessandro Galli", status: "in_lavorazione", date: "2026-02-10", deliveryDate: "2026-04-30", items: [{ productId: 7, name: "Migrazione Cloud", qty: 1, price: 8000 }, { productId: 8, name: "Formazione Team", qty: 5, price: 450 }, { productId: 5, name: "Hosting Cloud Premium", qty: 12, price: 49 }], subtotal: 10838, vat: 2384, total: 13222, notes: "Migrazione in 3 fasi, formazione post-migrazione", paymentMethod: "Bonifico 60gg" },
  { id: "ORD-2026-003", company: "DesignStudio Srl", contact: "Elena Ferri", status: "completato", date: "2026-01-20", deliveryDate: "2026-02-10", items: [{ productId: 9, name: "Brand Identity Package", qty: 1, price: 3500 }], subtotal: 3500, vat: 770, total: 4270, notes: "", paymentMethod: "Carta di credito" },
  { id: "ORD-2026-004", company: "MediaGroup Italia", contact: "Chiara Lombardi", status: "nuovo", date: "2026-02-19", deliveryDate: "2026-03-30", items: [{ productId: 4, name: "SEO & Content Strategy", qty: 6, price: 800 }, { productId: 1, name: "Sviluppo Sito Web", qty: 1, price: 5000 }], subtotal: 9800, vat: 2156, total: 11956, notes: "Piano SEO semestrale + redesign sito corporate", paymentMethod: "Bonifico 30gg" },
  { id: "ORD-2026-005", company: "SmartFactory", contact: "Davide Colombo", status: "in_lavorazione", date: "2026-02-05", deliveryDate: "2026-03-25", items: [{ productId: 6, name: "Licenza CRM DoFlow", qty: 25, price: 29 }, { productId: 8, name: "Formazione Team", qty: 3, price: 450 }, { productId: 11, name: "Supporto Premium 24/7", qty: 12, price: 500 }], subtotal: 8075, vat: 1777, total: 9852, notes: "Setup CRM per 25 utenti + formazione + supporto annuale", paymentMethod: "Bonifico 30gg" },
  { id: "ORD-2026-006", company: "DigitalWave Srl", contact: "Marco Ferretti", status: "completato", date: "2025-12-10", deliveryDate: "2026-02-01", items: [{ productId: 1, name: "Sviluppo Sito Web", qty: 1, price: 5000 }, { productId: 3, name: "Consulenza UX/UI", qty: 8, price: 120 }], subtotal: 5960, vat: 1311, total: 7271, notes: "Sito web consegnato e live", paymentMethod: "Bonifico 30gg" },
  { id: "ORD-2026-007", company: "InnovateIT", contact: "Roberto Mazza", status: "confermato", date: "2026-02-18", deliveryDate: "2026-06-30", items: [{ productId: 2, name: "App Mobile iOS/Android", qty: 1, price: 15000 }, { productId: 3, name: "Consulenza UX/UI", qty: 30, price: 120 }], subtotal: 18600, vat: 4092, total: 22692, notes: "App mobile con 3 rilasci incrementali", paymentMethod: "Bonifico 60gg" },
  { id: "ORD-2026-008", company: "NexusLab", contact: "Valentina Ricci", status: "annullato", date: "2026-01-30", deliveryDate: "2026-03-15", items: [{ productId: 12, name: "Analisi Dati & BI", qty: 40, price: 150 }], subtotal: 6000, vat: 1320, total: 7320, notes: "Annullato per cambio priorità interne", paymentMethod: "Bonifico 30gg" },
];

const CALENDAR_EVENTS = [
  { id: 1, title: "Call con StartupIO", type: "call", date: "2026-02-20", time: "09:00", duration: 30, contact: "Francesca Romano", company: "StartupIO", color: "#6C5CE7" },
  { id: 2, title: "Demo piattaforma BigCorp", type: "meeting", date: "2026-02-20", time: "11:00", duration: 60, contact: "Alessandro Galli", company: "BigCorp SpA", color: "#4ECDC4" },
  { id: 3, title: "Review design DesignStudio", type: "meeting", date: "2026-02-20", time: "14:30", duration: 45, contact: "Elena Ferri", company: "DesignStudio Srl", color: "#00D68F" },
  { id: 4, title: "Followup preventivo MediaGroup", type: "call", date: "2026-02-21", time: "10:00", duration: 20, contact: "Chiara Lombardi", company: "MediaGroup Italia", color: "#FFAA2C" },
  { id: 5, title: "Kickoff progetto SmartFactory", type: "meeting", date: "2026-02-21", time: "15:00", duration: 90, contact: "Davide Colombo", company: "SmartFactory", color: "#FF6B6B" },
  { id: 6, title: "Workshop UX InnovateIT", type: "workshop", date: "2026-02-22", time: "09:30", duration: 180, contact: "Roberto Mazza", company: "InnovateIT", color: "#818CF8" },
  { id: 7, title: "Scadenza preventivo StartupIO", type: "deadline", date: "2026-02-23", time: "23:59", duration: 0, contact: "Francesca Romano", company: "StartupIO", color: "#FF6B6B" },
  { id: 8, title: "Call NexusLab — primo contatto", type: "call", date: "2026-02-24", time: "11:30", duration: 30, contact: "Valentina Ricci", company: "NexusLab", color: "#6C5CE7" },
  { id: 9, title: "Presentazione offerta DigitalWave", type: "meeting", date: "2026-02-24", time: "16:00", duration: 60, contact: "Marco Ferretti", company: "DigitalWave Srl", color: "#4ECDC4" },
  { id: 10, title: "Team standup settimanale", type: "internal", date: "2026-02-20", time: "08:30", duration: 15, contact: "", company: "Interno", color: "#8B8D9A" },
  { id: 11, title: "Team standup settimanale", type: "internal", date: "2026-02-24", time: "08:30", duration: 15, contact: "", company: "Interno", color: "#8B8D9A" },
  { id: 12, title: "Training CRM SmartFactory", type: "workshop", date: "2026-02-25", time: "10:00", duration: 240, contact: "Davide Colombo", company: "SmartFactory", color: "#818CF8" },
  { id: 13, title: "Review Q1 pipeline", type: "internal", date: "2026-02-26", time: "14:00", duration: 60, contact: "", company: "Interno", color: "#8B8D9A" },
  { id: 14, title: "Consegna fase 1 BigCorp", type: "deadline", date: "2026-02-28", time: "18:00", duration: 0, contact: "Alessandro Galli", company: "BigCorp SpA", color: "#FF6B6B" },
  { id: 15, title: "Pranzo networking evento tech", type: "meeting", date: "2026-02-27", time: "12:30", duration: 90, contact: "", company: "Evento", color: "#00D68F" },
];

const orderStatusMap = {
  nuovo: { label: "Nuovo", color: "#818CF8", bg: "rgba(129,140,248,0.12)" },
  confermato: { label: "Confermato", color: "#4ECDC4", bg: "rgba(78,205,196,0.12)" },
  in_lavorazione: { label: "In lavorazione", color: "#FFAA2C", bg: "rgba(255,170,44,0.12)" },
  spedito: { label: "Spedito", color: "#6C5CE7", bg: "rgba(108,92,231,0.12)" },
  completato: { label: "Completato", color: "#00D68F", bg: "rgba(0,214,143,0.12)" },
  annullato: { label: "Annullato", color: "#FF6B6B", bg: "rgba(255,107,107,0.12)" },
};

const productStatusMap = {
  attivo: { label: "Attivo", color: "#00D68F", bg: "rgba(0,214,143,0.12)" },
  sospeso: { label: "Sospeso", color: "#FFAA2C", bg: "rgba(255,170,44,0.12)" },
  archiviato: { label: "Archiviato", color: "#5C5E6B", bg: "rgba(92,94,107,0.12)" },
};

const eventTypeMap = {
  call: { label: "Chiamata", icon: Phone },
  meeting: { label: "Meeting", icon: Users },
  workshop: { label: "Workshop", icon: Zap },
  deadline: { label: "Scadenza", icon: AlertTriangle },
  internal: { label: "Interno", icon: Building },
};

// ─── PHASE 3 DATA ───────────────────────────────────────────
const INVOICES = [
  { id: "FT-2026-001", title: "Sviluppo sito web DigitalWave", company: "DigitalWave Srl", contact: "Marco Ferretti", orderId: "ORD-2026-006", status: "pagata", issueDate: "2026-02-05", dueDate: "2026-03-07", paidDate: "2026-02-28", subtotal: 5960, vat: 1311, withholding: 0, total: 7271, paid: 7271, items: [{ desc: "Sviluppo Sito Web", qty: 1, price: 5000 }, { desc: "Consulenza UX/UI — 8 ore", qty: 8, price: 120 }], paymentMethod: "Bonifico bancario", invoiceNumber: "FT-2026/001" },
  { id: "FT-2026-002", title: "Brand Identity DesignStudio", company: "DesignStudio Srl", contact: "Elena Ferri", orderId: "ORD-2026-003", status: "pagata", issueDate: "2026-02-12", dueDate: "2026-03-14", paidDate: "2026-03-01", subtotal: 9836, vat: 2164, withholding: 0, total: 12000, paid: 12000, items: [{ desc: "Brand strategy", qty: 1, price: 3000 }, { desc: "Logo e visual identity", qty: 1, price: 4500 }, { desc: "Brand guidelines", qty: 1, price: 2336 }], paymentMethod: "Carta di credito", invoiceNumber: "FT-2026/002" },
  { id: "FT-2026-003", title: "Migrazione cloud BigCorp — Acconto", company: "BigCorp SpA", contact: "Alessandro Galli", orderId: "ORD-2026-002", status: "pagata", issueDate: "2026-01-25", dueDate: "2026-03-25", paidDate: "2026-02-20", subtotal: 24590, vat: 5410, withholding: 0, total: 30000, paid: 30000, items: [{ desc: "Acconto 30% — Migrazione cloud", qty: 1, price: 24590 }], paymentMethod: "Bonifico bancario", invoiceNumber: "FT-2026/003" },
  { id: "FT-2026-004", title: "E-commerce StartupIO — Fase 1", company: "StartupIO", contact: "Francesca Romano", orderId: "ORD-2026-001", status: "inviata", issueDate: "2026-02-18", dueDate: "2026-03-20", paidDate: null, subtotal: 4098, vat: 902, withholding: 0, total: 5000, paid: 0, items: [{ desc: "Sviluppo frontend e-commerce — Milestone 1", qty: 1, price: 4098 }], paymentMethod: "Bonifico 30gg", invoiceNumber: "FT-2026/004" },
  { id: "FT-2026-005", title: "CRM SmartFactory — Setup", company: "SmartFactory", contact: "Davide Colombo", orderId: "ORD-2026-005", status: "inviata", issueDate: "2026-02-15", dueDate: "2026-03-17", paidDate: null, subtotal: 16393, vat: 3607, withholding: 0, total: 20000, paid: 0, items: [{ desc: "Implementazione CRM — Fase setup", qty: 1, price: 12000 }, { desc: "Formazione team — 1 giornata", qty: 1, price: 450 }, { desc: "Licenze CRM 25 utenti — 3 mesi", qty: 75, price: 29 }, { desc: "Configurazione integrazioni", qty: 1, price: 1768 }], paymentMethod: "Bonifico 30gg", invoiceNumber: "FT-2026/005" },
  { id: "FT-2026-006", title: "Campagna digital MediaGroup", company: "MediaGroup Italia", contact: "Chiara Lombardi", orderId: null, status: "scaduta", issueDate: "2026-01-10", dueDate: "2026-02-09", paidDate: null, subtotal: 4098, vat: 902, withholding: 0, total: 5000, paid: 0, items: [{ desc: "Strategia digital — Mese 1", qty: 1, price: 4098 }], paymentMethod: "Bonifico 30gg", invoiceNumber: "FT-2026/006" },
  { id: "FT-2026-007", title: "App Mobile InnovateIT — Design", company: "InnovateIT", contact: "Roberto Mazza", orderId: "ORD-2026-007", status: "bozza", issueDate: "2026-02-20", dueDate: "2026-03-22", paidDate: null, subtotal: 5656, vat: 1244, withholding: 0, total: 6900, paid: 0, items: [{ desc: "Design UI/UX mobile — Wireframe + Mockup", qty: 1, price: 5656 }], paymentMethod: "Bonifico 60gg", invoiceNumber: "FT-2026/007" },
  { id: "FT-2026-008", title: "Migrazione cloud BigCorp — SAL 2", company: "BigCorp SpA", contact: "Alessandro Galli", orderId: "ORD-2026-002", status: "parz_pagata", issueDate: "2026-02-10", dueDate: "2026-04-10", paidDate: null, subtotal: 28688, vat: 6312, withholding: 0, total: 35000, paid: 15000, items: [{ desc: "Migrazione servizi cloud — Fase 2", qty: 1, price: 28688 }], paymentMethod: "Bonifico 60gg", invoiceNumber: "FT-2026/008" },
];

const invoiceStatusMap = {
  bozza: { label: "Bozza", color: "#8B8D9A", bg: "rgba(139,141,154,0.12)" },
  inviata: { label: "Inviata", color: "#818CF8", bg: "rgba(129,140,248,0.12)" },
  pagata: { label: "Pagata", color: "#00D68F", bg: "rgba(0,214,143,0.12)" },
  parz_pagata: { label: "Parz. pagata", color: "#FFAA2C", bg: "rgba(255,170,44,0.12)" },
  scaduta: { label: "Scaduta", color: "#FF6B6B", bg: "rgba(255,107,107,0.12)" },
  annullata: { label: "Annullata", color: "#5C5E6B", bg: "rgba(92,94,107,0.12)" },
};

const EXPENSES = [
  { id: 1, title: "Licenza Figma Team", category: "Software", amount: 144, date: "2026-02-18", user: "Marco R.", status: "approvata", receipt: true, notes: "Piano annuale team 3 utenti", vendor: "Figma Inc." },
  { id: 2, title: "Hosting AWS — Febbraio", category: "Infrastruttura", amount: 387.50, date: "2026-02-15", user: "Giulia B.", status: "approvata", receipt: true, notes: "Server produzione + staging", vendor: "Amazon AWS" },
  { id: 3, title: "Pranzo cliente BigCorp", category: "Rappresentanza", amount: 85.00, date: "2026-02-12", user: "Marco R.", status: "approvata", receipt: true, notes: "Pranzo di lavoro con Alessandro Galli", vendor: "Ristorante Da Mario" },
  { id: 4, title: "Abbonamento GitHub Team", category: "Software", amount: 63.00, date: "2026-02-10", user: "Giulia B.", status: "approvata", receipt: true, notes: "5 seat × $4/mese", vendor: "GitHub" },
  { id: 5, title: "Google Workspace Business", category: "Software", amount: 276.00, date: "2026-02-01", user: "Sara M.", status: "approvata", receipt: true, notes: "20 utenti × €11.50 + IVA", vendor: "Google" },
  { id: 6, title: "Viaggio Roma — meeting BigCorp", category: "Trasferta", amount: 320.00, date: "2026-02-11", user: "Marco R.", status: "approvata", receipt: true, notes: "Treno A/R Milano-Roma + metro", vendor: "Trenitalia" },
  { id: 7, title: "Hotel Roma — 1 notte", category: "Trasferta", amount: 145.00, date: "2026-02-11", user: "Marco R.", status: "approvata", receipt: true, notes: "Pernottamento per meeting BigCorp", vendor: "Hotel Quirinale" },
  { id: 8, title: "Licenza Adobe Creative Cloud", category: "Software", amount: 599.00, date: "2026-02-05", user: "Luca P.", status: "approvata", receipt: true, notes: "Piano all-apps annuale", vendor: "Adobe" },
  { id: 9, title: "Attrezzatura ufficio — monitor", category: "Hardware", amount: 449.00, date: "2026-02-19", user: "Sara M.", status: "in_attesa", receipt: true, notes: "Monitor 27\" 4K per postazione design", vendor: "Amazon Business" },
  { id: 10, title: "Corso online AI/ML", category: "Formazione", amount: 199.00, date: "2026-02-17", user: "Giulia B.", status: "in_attesa", receipt: false, notes: "Corso avanzato machine learning — Coursera", vendor: "Coursera" },
  { id: 11, title: "Pubblicità LinkedIn", category: "Marketing", amount: 500.00, date: "2026-02-08", user: "Luca P.", status: "approvata", receipt: true, notes: "Campagna lead generation febbraio", vendor: "LinkedIn Ads" },
  { id: 12, title: "Taxi aeroporto — evento Milano", category: "Trasferta", amount: 35.00, date: "2026-02-20", user: "Marco R.", status: "rifiutata", receipt: false, notes: "Scontrino non leggibile", vendor: "Taxi Milano" },
];

const expenseStatusMap = {
  in_attesa: { label: "In attesa", color: "#FFAA2C", bg: "rgba(255,170,44,0.12)" },
  approvata: { label: "Approvata", color: "#00D68F", bg: "rgba(0,214,143,0.12)" },
  rifiutata: { label: "Rifiutata", color: "#FF6B6B", bg: "rgba(255,107,107,0.12)" },
};

const EXPENSE_CATEGORIES = ["Software", "Infrastruttura", "Rappresentanza", "Trasferta", "Hardware", "Formazione", "Marketing"];

const BILLING_PLAN = {
  name: "Pro", price: 29, billing: "mensile", users: 5, maxUsers: 10, nextBilling: "2026-03-01",
  storage: { used: 12.4, max: 50 },
  features: [
    { name: "Utenti inclusi", value: "5", included: true },
    { name: "Pipeline vendite", value: "Illimitate", included: true },
    { name: "Contatti & aziende", value: "Illimitati", included: true },
    { name: "Catalogo prodotti", value: "Illimitato", included: true },
    { name: "Fatturazione", value: "Inclusa", included: true },
    { name: "Note spese", value: "Incluse", included: true },
    { name: "Calendario", value: "Incluso", included: true },
    { name: "Email marketing", value: "500/mese", included: true },
    { name: "Storage", value: "50 GB", included: true },
    { name: "Automazioni", value: "10 workflow", included: true },
    { name: "Integrazioni API", value: "Limitate", included: true },
    { name: "Supporto", value: "Email + Chat", included: true },
    { name: "Analytics avanzata BI", value: "", included: false },
    { name: "Multi-magazzino", value: "", included: false },
    { name: "Firma digitale", value: "", included: false },
    { name: "SSO / SAML", value: "", included: false },
    { name: "Audit log", value: "", included: false },
    { name: "SLA garantito", value: "", included: false },
  ],
};

const BILLING_HISTORY = [
  { id: 1, date: "2026-02-01", description: "Piano Pro — Febbraio 2026", amount: 145, status: "pagato", method: "Visa •••• 4242" },
  { id: 2, date: "2026-01-01", description: "Piano Pro — Gennaio 2026", amount: 145, status: "pagato", method: "Visa •••• 4242" },
  { id: 3, date: "2025-12-01", description: "Piano Pro — Dicembre 2025", amount: 145, status: "pagato", method: "Visa •••• 4242" },
  { id: 4, date: "2025-11-01", description: "Piano Pro — Novembre 2025", amount: 145, status: "pagato", method: "Visa •••• 4242" },
  { id: 5, date: "2025-11-01", description: "Upgrade Starter → Pro", amount: 0, status: "pagato", method: "—" },
  { id: 6, date: "2025-10-01", description: "Piano Starter — Ottobre 2025", amount: 49, status: "pagato", method: "Visa •••• 4242" },
];

const PLANS_COMPARISON = [
  { name: "Starter", price: 9, desc: "Per freelancer e micro-team", users: "2 utenti", highlight: false },
  { name: "Pro", price: 29, desc: "Per team in crescita", users: "Fino a 10 utenti", highlight: true },
  { name: "Enterprise", price: 79, desc: "Per aziende strutturate", users: "Utenti illimitati", highlight: false },
];

// ─── PHASE 4 DATA ───────────────────────────────────────────
const BOARD_COLUMNS = [
  { id: "backlog", label: "Backlog", color: "#8B8D9A" },
  { id: "todo", label: "Da fare", color: "#818CF8" },
  { id: "in_progress", label: "In corso", color: "#FFAA2C" },
  { id: "review", label: "In review", color: "#4ECDC4" },
  { id: "done", label: "Completato", color: "#00D68F" },
];

const BOARD_TASKS = [
  { id: 101, title: "Wireframe pagina prodotto", column: "done", priority: "high", assignee: "Marco R.", avatar: "MR", tags: ["Design"], dueDate: "2026-02-18" },
  { id: 102, title: "API endpoint ordini", column: "review", priority: "high", assignee: "Giulia B.", avatar: "GB", tags: ["Backend"], dueDate: "2026-02-20" },
  { id: 103, title: "Test integrazione Stripe", column: "in_progress", priority: "high", assignee: "Giulia B.", avatar: "GB", tags: ["Payment", "QA"], dueDate: "2026-02-22" },
  { id: 104, title: "Copywriting pagina About", column: "in_progress", priority: "low", assignee: "Luca P.", avatar: "LP", tags: ["Content"], dueDate: "2026-02-25" },
  { id: 105, title: "Ottimizzazione immagini", column: "todo", priority: "medium", assignee: "Sara M.", avatar: "SM", tags: ["Frontend"], dueDate: "2026-02-24" },
  { id: 106, title: "Setup monitoring Sentry", column: "todo", priority: "medium", assignee: "Giulia B.", avatar: "GB", tags: ["DevOps"], dueDate: "2026-02-26" },
  { id: 107, title: "Design sistema notifiche", column: "todo", priority: "high", assignee: "Marco R.", avatar: "MR", tags: ["Design", "UX"], dueDate: "2026-02-23" },
  { id: 108, title: "Refactor modulo auth", column: "backlog", priority: "medium", assignee: "Giulia B.", avatar: "GB", tags: ["Backend"], dueDate: "2026-03-05" },
  { id: 109, title: "Documentazione API v2", column: "backlog", priority: "low", assignee: "Luca P.", avatar: "LP", tags: ["Docs"], dueDate: "2026-03-10" },
  { id: 110, title: "A/B test landing page", column: "backlog", priority: "medium", assignee: "Sara M.", avatar: "SM", tags: ["Marketing"], dueDate: "2026-03-08" },
  { id: 111, title: "Migrazione database staging", column: "review", priority: "high", assignee: "Sara M.", avatar: "SM", tags: ["Backend", "DB"], dueDate: "2026-02-21" },
  { id: 112, title: "Fix responsive navbar", column: "done", priority: "medium", assignee: "Marco R.", avatar: "MR", tags: ["Frontend"], dueDate: "2026-02-17" },
  { id: 113, title: "Report analytics mensile", column: "in_progress", priority: "medium", assignee: "Luca P.", avatar: "LP", tags: ["Analytics"], dueDate: "2026-02-28" },
];

const DOCUMENTS = [
  { id: 1, name: "Contratto BigCorp SpA", type: "pdf", size: "2.4 MB", folder: "Contratti", modified: "2026-02-18", owner: "Marco R.", shared: ["Giulia B.", "Luca P."], starred: true },
  { id: 2, name: "Proposta StartupIO — v3", type: "docx", size: "1.1 MB", folder: "Proposte", modified: "2026-02-19", owner: "Marco R.", shared: ["Sara M."], starred: true },
  { id: 3, name: "Brand Guidelines DesignStudio", type: "pdf", size: "8.7 MB", folder: "Deliverables", modified: "2026-02-10", owner: "Luca P.", shared: [], starred: false },
  { id: 4, name: "Preventivo SmartFactory — CRM", type: "pdf", size: "540 KB", folder: "Preventivi", modified: "2026-02-12", owner: "Giulia B.", shared: ["Marco R."], starred: false },
  { id: 5, name: "Analisi competitor Q1 2026", type: "xlsx", size: "3.2 MB", folder: "Analisi", modified: "2026-02-15", owner: "Sara M.", shared: ["Marco R.", "Giulia B."], starred: false },
  { id: 6, name: "Mockup App InnovateIT", type: "fig", size: "15.4 MB", folder: "Design", modified: "2026-02-20", owner: "Marco R.", shared: ["Luca P."], starred: true },
  { id: 7, name: "Report vendite Gennaio", type: "xlsx", size: "1.8 MB", folder: "Report", modified: "2026-02-05", owner: "Sara M.", shared: ["Marco R."], starred: false },
  { id: 8, name: "NDA MediaGroup Italia", type: "pdf", size: "320 KB", folder: "Contratti", modified: "2026-02-08", owner: "Marco R.", shared: [], starred: false },
  { id: 9, name: "Wireframe Dashboard v2", type: "fig", size: "6.1 MB", folder: "Design", modified: "2026-02-17", owner: "Marco R.", shared: ["Sara M.", "Giulia B."], starred: false },
  { id: 10, name: "Piano progetto BigCorp", type: "docx", size: "890 KB", folder: "Progetti", modified: "2026-02-14", owner: "Giulia B.", shared: ["Marco R.", "Sara M.", "Luca P."], starred: true },
  { id: 11, name: "Foto team offsite", type: "zip", size: "124 MB", folder: "Media", modified: "2026-01-28", owner: "Luca P.", shared: [], starred: false },
  { id: 12, name: "Manuale utente CRM DoFlow", type: "pdf", size: "4.5 MB", folder: "Docs", modified: "2026-02-20", owner: "Luca P.", shared: ["Marco R.", "Giulia B.", "Sara M."], starred: false },
];

const DOC_FOLDERS = ["Tutti", "Contratti", "Proposte", "Preventivi", "Deliverables", "Analisi", "Design", "Report", "Progetti", "Media", "Docs"];

const docTypeIcons = { pdf: "📄", docx: "📝", xlsx: "📊", fig: "🎨", zip: "📦", pptx: "📑", png: "🖼️", jpg: "🖼️" };
const docTypeColors = { pdf: "#FF6B6B", docx: "#4ECDC4", xlsx: "#00D68F", fig: "#818CF8", zip: "#FFAA2C", pptx: "#F59E0B" };

const INBOX_MESSAGES = [
  { id: 1, from: "Francesca Romano", fromEmail: "francesca@startup.io", company: "StartupIO", subject: "Re: Aggiornamento piattaforma e-commerce", preview: "Ciao Marco, ho visto la demo e sono entusiasta del risultato! Avrei solo un paio di modifiche da richiedere sulla pagina checkout...", date: "2026-02-20 09:15", read: false, starred: true, labels: ["Cliente", "Importante"], hasAttachment: false, thread: 3 },
  { id: 2, from: "Alessandro Galli", fromEmail: "ale@bigcorp.com", company: "BigCorp SpA", subject: "Migrazione cloud — accesso staging", preview: "Buongiorno, vi giro le credenziali per l'ambiente staging. Per favore confermate quando avete completato la verifica dei servizi migrati.", date: "2026-02-20 08:42", read: false, starred: false, labels: ["Cliente"], hasAttachment: true, thread: 5 },
  { id: 3, from: "Davide Colombo", fromEmail: "d.colombo@smartfactory.it", company: "SmartFactory", subject: "Training CRM — conferma date", preview: "Confermo le date proposte per il training: 25 e 26 febbraio, ore 10-14. Saranno presenti 12 persone del team vendite e 5 dell'amministrazione.", date: "2026-02-19 17:30", read: true, starred: false, labels: ["Cliente"], hasAttachment: false, thread: 2 },
  { id: 4, from: "Elena Ferri", fromEmail: "elena@design.studio", company: "DesignStudio Srl", subject: "Feedback brand guidelines", preview: "Il team ha approvato le guidelines! Unica richiesta: potete aggiungere una sezione sulle icone custom? Vi allego il documento con le annotazioni.", date: "2026-02-19 14:22", read: true, starred: true, labels: ["Cliente", "Completato"], hasAttachment: true, thread: 1 },
  { id: 5, from: "Chiara Lombardi", fromEmail: "chiara@mediagroup.it", company: "MediaGroup Italia", subject: "Fattura FT-2026/006 — sollecito pagamento", preview: "Buongiorno, ho visto il sollecito ma c'è un problema con il nostro dipartimento contabilità. Vi chiedo qualche giorno in più...", date: "2026-02-19 11:05", read: true, starred: false, labels: ["Urgente", "Fatturazione"], hasAttachment: false, thread: 4 },
  { id: 6, from: "Roberto Mazza", fromEmail: "rob@innovate.it", company: "InnovateIT", subject: "App mobile — domande tecniche", preview: "Riguardo al preventivo ricevuto, il nostro CTO ha alcune domande sull'architettura proposta. Sarebbe possibile organizzare una call tecnica?", date: "2026-02-18 16:48", read: true, starred: false, labels: ["Lead"], hasAttachment: false, thread: 1 },
  { id: 7, from: "Valentina Ricci", fromEmail: "v.ricci@nexuslab.com", company: "NexusLab", subject: "Richiesta informazioni servizi automazione", preview: "Buongiorno, siamo interessati ai vostri servizi di automazione workflow. Potete inviarci una presentazione con casi studio e pricing?", date: "2026-02-18 10:20", read: true, starred: false, labels: ["Lead", "Nuovo"], hasAttachment: false, thread: 1 },
  { id: 8, from: "Marco Ferretti", fromEmail: "marco.f@digitalwave.it", company: "DigitalWave Srl", subject: "Re: Manutenzione sito — rinnovo annuale", preview: "Confermo il rinnovo del piano di manutenzione annuale. Potete procedere con la fattura? Stessi termini dello scorso anno vanno bene.", date: "2026-02-17 09:33", read: true, starred: false, labels: ["Cliente"], hasAttachment: false, thread: 2 },
  { id: 9, from: "Sistema DoFlow", fromEmail: "noreply@doflow.io", company: "DoFlow", subject: "Report settimanale vendite — W7 2026", preview: "Il tuo report settimanale è pronto. Pipeline: €340.500 (+12%), Deal chiuse: 2, Nuovi lead: 3. Clicca per i dettagli completi.", date: "2026-02-17 07:00", read: true, starred: false, labels: ["Sistema"], hasAttachment: true, thread: 1 },
];

const INBOX_LABELS = ["Tutti", "Non letti", "Stellati", "Cliente", "Lead", "Urgente", "Fatturazione", "Completato", "Sistema"];

const EMAIL_TEMPLATES = [
  { id: 1, name: "Benvenuto nuovo cliente", category: "Onboarding", subject: "Benvenuto in {company_name}! 🎉", body: "Ciao {nome},\n\nSiamo felici di averti a bordo! Il tuo account è pronto e puoi iniziare subito.\n\nEcco i primi passi:\n1. Completa il tuo profilo\n2. Esplora la dashboard\n3. Invita il tuo team\n\nSe hai bisogno di aiuto, siamo qui per te.\n\nA presto,\n{mittente}", variables: ["nome", "company_name", "mittente"], usageCount: 24, lastUsed: "2026-02-19" },
  { id: 2, name: "Invio preventivo", category: "Vendite", subject: "Preventivo {numero_prev} — {titolo_progetto}", body: "Gentile {nome},\n\ncome da accordi, le invio in allegato il preventivo {numero_prev} relativo a {titolo_progetto}.\n\nIl preventivo ha validità 30 giorni dalla data di emissione.\n\nResto a disposizione per qualsiasi chiarimento.\n\nCordiali saluti,\n{mittente}", variables: ["nome", "numero_prev", "titolo_progetto", "mittente"], usageCount: 18, lastUsed: "2026-02-18" },
  { id: 3, name: "Followup post-meeting", category: "Vendite", subject: "Riepilogo meeting — {oggetto}", body: "Ciao {nome},\n\ngrazie per il tempo dedicato durante il nostro meeting di oggi.\n\nRiepilogo punti discussi:\n{punti_discussi}\n\nProssimi passi:\n{prossimi_passi}\n\nSe hai domande, non esitare a contattarmi.\n\nA presto,\n{mittente}", variables: ["nome", "oggetto", "punti_discussi", "prossimi_passi", "mittente"], usageCount: 31, lastUsed: "2026-02-20" },
  { id: 4, name: "Sollecito pagamento", category: "Fatturazione", subject: "Sollecito fattura {numero_fattura} — scadenza {data_scadenza}", body: "Gentile {nome},\n\nle scriviamo per ricordarle che la fattura {numero_fattura} di importo {importo} risulta scaduta dal {data_scadenza}.\n\nLa preghiamo di provvedere al saldo entro 7 giorni.\n\nPer qualsiasi chiarimento restiamo a disposizione.\n\nDistinti saluti,\n{mittente}", variables: ["nome", "numero_fattura", "importo", "data_scadenza", "mittente"], usageCount: 8, lastUsed: "2026-02-19" },
  { id: 5, name: "Conferma ordine", category: "Operazioni", subject: "Conferma ordine {numero_ordine}", body: "Gentile {nome},\n\nconfermiamo la ricezione del suo ordine {numero_ordine}.\n\nDettagli:\n{dettagli_ordine}\n\nTotale: {totale}\nConsegna prevista: {data_consegna}\n\nLa terremo aggiornata sullo stato di avanzamento.\n\nCordiali saluti,\n{mittente}", variables: ["nome", "numero_ordine", "dettagli_ordine", "totale", "data_consegna", "mittente"], usageCount: 12, lastUsed: "2026-02-15" },
  { id: 6, name: "Richiesta feedback", category: "Post-vendita", subject: "Come è andata? Il tuo feedback è importante", body: "Ciao {nome},\n\nè passato un po' di tempo da quando abbiamo completato {progetto} e ci piacerebbe sapere come stai trovando il risultato.\n\nSe hai 2 minuti, ci farebbe piacere ricevere il tuo feedback:\n{link_feedback}\n\nGrazie mille!\n{mittente}", variables: ["nome", "progetto", "link_feedback", "mittente"], usageCount: 6, lastUsed: "2026-02-10" },
  { id: 7, name: "Proposta collaborazione", category: "Vendite", subject: "Proposta di collaborazione — {titolo}", body: "Gentile {nome},\n\nmi permetto di contattarla per presentare una proposta di collaborazione che riteniamo possa essere di reciproco interesse.\n\n{descrizione_proposta}\n\nSarebbe disponibile per una breve call conoscitiva?\n\nCordiali saluti,\n{mittente}", variables: ["nome", "titolo", "descrizione_proposta", "mittente"], usageCount: 15, lastUsed: "2026-02-17" },
  { id: 8, name: "Auguri festività", category: "Relazioni", subject: "Auguri dal team {company_name}!", body: "Caro/a {nome},\n\nil team di {company_name} vi augura buone feste!\n\nÈ stato un piacere collaborare con voi quest'anno e non vediamo l'ora di continuare nel nuovo anno.\n\nI nostri uffici saranno chiusi dal {data_inizio} al {data_fine}.\n\nBuone feste!\nIl team {company_name}", variables: ["nome", "company_name", "data_inizio", "data_fine"], usageCount: 3, lastUsed: "2025-12-20" },
];

const TEMPLATE_CATEGORIES = ["Tutti", "Onboarding", "Vendite", "Fatturazione", "Operazioni", "Post-vendita", "Relazioni"];

// ─── PHASE 5 DATA ───────────────────────────────────────────
const INVENTORY = [
  { id: 1, sku: "PRD-HST-001", name: "Hosting Cloud Premium", category: "Infrastruttura", location: "Mag. Digitale", qty: 200, minQty: 50, maxQty: 500, unit: "licenza", value: 49, lastMovement: "2026-02-18", status: "ok" },
  { id: 2, sku: "PRD-CRM-001", name: "Licenza CRM DoFlow", category: "Software", location: "Mag. Digitale", qty: 150, minQty: 20, maxQty: 300, unit: "licenza", value: 29, lastMovement: "2026-02-20", status: "ok" },
  { id: 3, sku: "PRD-ECM-001", name: "Plugin E-commerce", category: "Software", location: "Mag. Digitale", qty: 8, minQty: 15, maxQty: 100, unit: "licenza", value: 199, lastMovement: "2026-02-10", status: "sottoscorta" },
  { id: 4, sku: "HW-MNT-27", name: "Monitor 27\" 4K LG", category: "Hardware", location: "Magazzino A", qty: 3, minQty: 5, maxQty: 20, unit: "pz", value: 449, lastMovement: "2026-02-19", status: "sottoscorta" },
  { id: 5, sku: "HW-LAP-14", name: "MacBook Pro 14\" M4", category: "Hardware", location: "Magazzino A", qty: 2, minQty: 2, maxQty: 10, unit: "pz", value: 2499, lastMovement: "2026-02-05", status: "critico" },
  { id: 6, sku: "HW-DOCK-01", name: "Docking Station USB-C", category: "Hardware", location: "Magazzino A", qty: 12, minQty: 5, maxQty: 30, unit: "pz", value: 89, lastMovement: "2026-02-14", status: "ok" },
  { id: 7, sku: "HW-HEAD-01", name: "Cuffie Sony WH-1000XM5", category: "Hardware", location: "Magazzino A", qty: 0, minQty: 3, maxQty: 15, unit: "pz", value: 329, lastMovement: "2026-01-28", status: "esaurito" },
  { id: 8, sku: "OFF-CHAIR-01", name: "Sedia ergonomica Herman Miller", category: "Arredamento", location: "Magazzino B", qty: 4, minQty: 2, maxQty: 10, unit: "pz", value: 1290, lastMovement: "2026-02-01", status: "ok" },
  { id: 9, sku: "OFF-DESK-01", name: "Scrivania sit-stand Flexispot", category: "Arredamento", location: "Magazzino B", qty: 6, minQty: 3, maxQty: 15, unit: "pz", value: 549, lastMovement: "2026-01-20", status: "ok" },
  { id: 10, sku: "NET-SW-48", name: "Switch di rete 48 porte", category: "Networking", location: "Magazzino A", qty: 1, minQty: 2, maxQty: 5, unit: "pz", value: 890, lastMovement: "2026-02-12", status: "sottoscorta" },
];

const inventoryStatusMap = {
  ok: { label: "Disponibile", color: "#00D68F", bg: "rgba(0,214,143,0.12)" },
  sottoscorta: { label: "Sottoscorta", color: "#FFAA2C", bg: "rgba(255,170,44,0.12)" },
  critico: { label: "Critico", color: "#FF6B6B", bg: "rgba(255,107,107,0.12)" },
  esaurito: { label: "Esaurito", color: "#8B8D9A", bg: "rgba(139,141,154,0.12)" },
};

const INVENTORY_CATEGORIES = ["Hardware", "Software", "Infrastruttura", "Arredamento", "Networking"];

const SHIPMENTS = [
  { id: "SHP-2026-001", orderId: "ORD-2026-001", company: "StartupIO", destination: "Via Roma 42, Milano", carrier: "BRT", trackingCode: "BRT2026018742", status: "in_transito", shipDate: "2026-02-17", estDelivery: "2026-02-21", items: 2, weight: "0.5 kg", notes: "Consegna piano uffici 3°" },
  { id: "SHP-2026-002", orderId: "ORD-2026-002", company: "BigCorp SpA", destination: "Viale Europa 100, Roma", carrier: "DHL", trackingCode: "DHL1039847562", status: "in_preparazione", shipDate: null, estDelivery: "2026-02-28", items: 5, weight: "12 kg", notes: "Hardware per migrazione — palletizzare" },
  { id: "SHP-2026-003", orderId: "ORD-2026-003", company: "DesignStudio Srl", destination: "Corso Magenta 15, Torino", carrier: "GLS", trackingCode: "GLS8827364510", status: "consegnato", shipDate: "2026-02-08", estDelivery: "2026-02-10", items: 1, weight: "0.2 kg", notes: "" },
  { id: "SHP-2026-004", orderId: "ORD-2026-005", company: "SmartFactory", destination: "Via Industriale 8, Brescia", carrier: "BRT", trackingCode: "BRT2026029831", status: "in_transito", shipDate: "2026-02-19", estDelivery: "2026-02-22", items: 8, weight: "6 kg", notes: "Notebook + accessori per setup postazioni" },
  { id: "SHP-2026-005", orderId: "ORD-2026-007", company: "InnovateIT", destination: "Piazza Duomo 1, Firenze", carrier: "UPS", trackingCode: "1Z999AA10123456784", status: "in_preparazione", shipDate: null, estDelivery: "2026-03-05", items: 3, weight: "2 kg", notes: "Dispositivi test app mobile" },
  { id: "SHP-2026-006", orderId: "ORD-2026-004", company: "MediaGroup Italia", destination: "Via Veneto 22, Roma", carrier: "DHL", trackingCode: "DHL1039852198", status: "spedito", shipDate: "2026-02-20", estDelivery: "2026-02-23", items: 1, weight: "0.3 kg", notes: "" },
  { id: "SHP-2026-007", orderId: null, company: "Ufficio Milano", destination: "Via Tortona 33, Milano", carrier: "BRT", trackingCode: "BRT2026031004", status: "consegnato", shipDate: "2026-02-15", estDelivery: "2026-02-16", items: 4, weight: "18 kg", notes: "Materiale ufficio — scrivanie + monitor" },
  { id: "SHP-2026-008", orderId: null, company: "NexusLab", destination: "Via Garibaldi 5, Bologna", carrier: "GLS", trackingCode: "GLS8827401122", status: "problema", shipDate: "2026-02-14", estDelivery: "2026-02-17", items: 2, weight: "3 kg", notes: "Indirizzo errato — in attesa rettifica" },
];

const shipmentStatusMap = {
  in_preparazione: { label: "In preparazione", color: "#818CF8", bg: "rgba(129,140,248,0.12)" },
  spedito: { label: "Spedito", color: "#4ECDC4", bg: "rgba(78,205,196,0.12)" },
  in_transito: { label: "In transito", color: "#FFAA2C", bg: "rgba(255,170,44,0.12)" },
  consegnato: { label: "Consegnato", color: "#00D68F", bg: "rgba(0,214,143,0.12)" },
  problema: { label: "Problema", color: "#FF6B6B", bg: "rgba(255,107,107,0.12)" },
};

const SUPPLIERS = [
  { id: 1, name: "TechDistribution SpA", category: "Hardware", contact: "Andrea Bianchi", email: "a.bianchi@techdist.it", phone: "+39 02 9876543", city: "Milano", status: "attivo", rating: 4.5, totalOrders: 18, totalSpent: 42500, lastOrder: "2026-02-19", paymentTerms: "30 gg", notes: "Fornitore principale hardware — consegne puntuali" },
  { id: 2, name: "CloudNet Solutions", category: "Infrastruttura", contact: "Federica Costa", email: "f.costa@cloudnet.it", phone: "+39 06 3456789", city: "Roma", status: "attivo", rating: 4.8, totalOrders: 24, totalSpent: 28700, lastOrder: "2026-02-15", paymentTerms: "Prepagato", notes: "Servizi cloud e hosting — ottimo SLA" },
  { id: 3, name: "OfficeWorld Srl", category: "Arredamento", contact: "Marco Vitale", email: "m.vitale@officeworld.it", phone: "+39 011 2345678", city: "Torino", status: "attivo", rating: 4.0, totalOrders: 6, totalSpent: 15800, lastOrder: "2026-01-20", paymentTerms: "60 gg", notes: "Mobili ufficio ergonomici" },
  { id: 4, name: "SoftwarePlus Italia", category: "Software", contact: "Laura Moretti", email: "l.moretti@swplus.it", phone: "+39 055 8765432", city: "Firenze", status: "attivo", rating: 4.2, totalOrders: 32, totalSpent: 18900, lastOrder: "2026-02-18", paymentTerms: "Prepagato", notes: "Licenze software e SaaS — ampio catalogo" },
  { id: 5, name: "NetGear Pro Distribuzione", category: "Networking", contact: "Paolo Rizzo", email: "p.rizzo@netgearpro.it", phone: "+39 02 1112233", city: "Milano", status: "attivo", rating: 3.8, totalOrders: 8, totalSpent: 7200, lastOrder: "2026-02-12", paymentTerms: "30 gg", notes: "Switch, router, cablaggio strutturato" },
  { id: 6, name: "PrintService Roma", category: "Servizi", contact: "Giada Marchetti", email: "g.marchetti@printservice.it", phone: "+39 06 9988776", city: "Roma", status: "sospeso", rating: 3.2, totalOrders: 4, totalSpent: 2400, lastOrder: "2025-11-05", paymentTerms: "15 gg", notes: "Stampa materiale marketing — qualità inconsistente" },
  { id: 7, name: "EcoSupply Green", category: "Materiali", contact: "Simone Greco", email: "s.greco@ecosupply.it", phone: "+39 049 5544332", city: "Padova", status: "attivo", rating: 4.6, totalOrders: 10, totalSpent: 3800, lastOrder: "2026-02-08", paymentTerms: "30 gg", notes: "Materiali di consumo eco-friendly" },
  { id: 8, name: "Global Logistics Partner", category: "Spedizioni", contact: "Ilaria Fontana", email: "i.fontana@glp.it", phone: "+39 02 7766554", city: "Milano", status: "attivo", rating: 4.3, totalOrders: 45, totalSpent: 9100, lastOrder: "2026-02-20", paymentTerms: "Mensile", notes: "Corriere preferenziale per spedizioni nazionali" },
];

const supplierStatusMap = {
  attivo: { label: "Attivo", color: "#00D68F", bg: "rgba(0,214,143,0.12)" },
  sospeso: { label: "Sospeso", color: "#FFAA2C", bg: "rgba(255,170,44,0.12)" },
  inattivo: { label: "Inattivo", color: "#8B8D9A", bg: "rgba(139,141,154,0.12)" },
};

const TIMESHEET_ENTRIES = [
  { id: 1, user: "Marco R.", avatar: "MR", project: "BigCorp — Migrazione cloud", task: "Architettura sistema", date: "2026-02-20", hours: 4.5, rate: 85, billable: true, status: "approvato" },
  { id: 2, user: "Marco R.", avatar: "MR", project: "StartupIO — E-commerce", task: "Code review frontend", date: "2026-02-20", hours: 2.0, rate: 85, billable: true, status: "approvato" },
  { id: 3, user: "Giulia B.", avatar: "GB", project: "BigCorp — Migrazione cloud", task: "Setup infrastruttura AWS", date: "2026-02-20", hours: 6.0, rate: 75, billable: true, status: "approvato" },
  { id: 4, user: "Giulia B.", avatar: "GB", project: "SmartFactory — CRM", task: "Configurazione pipeline", date: "2026-02-20", hours: 2.0, rate: 75, billable: true, status: "in_attesa" },
  { id: 5, user: "Luca P.", avatar: "LP", project: "DesignStudio — Brand", task: "Brand guidelines v3", date: "2026-02-20", hours: 5.0, rate: 65, billable: true, status: "approvato" },
  { id: 6, user: "Luca P.", avatar: "LP", project: "Interno", task: "Content blog aziendale", date: "2026-02-20", hours: 1.5, rate: 65, billable: false, status: "approvato" },
  { id: 7, user: "Sara M.", avatar: "SM", project: "InnovateIT — App mobile", task: "Wireframe v2", date: "2026-02-20", hours: 3.5, rate: 70, billable: true, status: "in_attesa" },
  { id: 8, user: "Sara M.", avatar: "SM", project: "Interno", task: "Meeting team settimanale", date: "2026-02-20", hours: 0.5, rate: 70, billable: false, status: "approvato" },
  { id: 9, user: "Marco R.", avatar: "MR", project: "InnovateIT — App mobile", task: "Sprint planning", date: "2026-02-19", hours: 2.0, rate: 85, billable: true, status: "approvato" },
  { id: 10, user: "Giulia B.", avatar: "GB", project: "BigCorp — Migrazione cloud", task: "Migrazione database", date: "2026-02-19", hours: 7.0, rate: 75, billable: true, status: "approvato" },
  { id: 11, user: "Luca P.", avatar: "LP", project: "MediaGroup — SEO", task: "Audit SEO tecnico", date: "2026-02-19", hours: 4.0, rate: 65, billable: true, status: "approvato" },
  { id: 12, user: "Sara M.", avatar: "SM", project: "StartupIO — E-commerce", task: "Test UI responsive", date: "2026-02-19", hours: 5.5, rate: 70, billable: true, status: "approvato" },
  { id: 13, user: "Marco R.", avatar: "MR", project: "Interno", task: "Call prospect NexusLab", date: "2026-02-19", hours: 0.5, rate: 85, billable: false, status: "approvato" },
  { id: 14, user: "Giulia B.", avatar: "GB", project: "Interno", task: "Formazione interna Docker", date: "2026-02-19", hours: 1.5, rate: 75, billable: false, status: "approvato" },
];

const TIMESHEET_PROJECTS = [...new Set(TIMESHEET_ENTRIES.map(e => e.project))];

// ─── PHASE 6 DATA ───────────────────────────────────────────
const AUTOMATIONS = [
  { id: 1, name: "Lead → Cliente automatico", trigger: "Deal vinta", actions: ["Cambia tipo contatto a Cliente", "Invia email benvenuto", "Crea task onboarding"], status: "attivo", runs: 42, lastRun: "2026-02-20 08:30", category: "CRM" },
  { id: 2, name: "Sollecito fatture scadute", trigger: "Fattura scaduta da 7 giorni", actions: ["Invia email sollecito", "Notifica admin", "Aggiorna stato a Sollecitata"], status: "attivo", runs: 8, lastRun: "2026-02-19 09:00", category: "Fatturazione" },
  { id: 3, name: "Notifica deal ad alto valore", trigger: "Nuova deal > €10.000", actions: ["Notifica Slack #vendite", "Assegna priorità alta", "Invia email al manager"], status: "attivo", runs: 15, lastRun: "2026-02-18 14:22", category: "CRM" },
  { id: 4, name: "Riordino automatico scorte", trigger: "Scorta sotto minimo", actions: ["Crea ordine fornitore bozza", "Notifica responsabile magazzino", "Aggiorna log inventario"], status: "attivo", runs: 6, lastRun: "2026-02-17 06:00", category: "Logistica" },
  { id: 5, name: "Report vendite settimanale", trigger: "Ogni lunedì 07:00", actions: ["Genera report pipeline", "Calcola metriche KPI", "Invia email al team"], status: "attivo", runs: 28, lastRun: "2026-02-17 07:00", category: "Report" },
  { id: 6, name: "Followup automatico lead", trigger: "Lead senza attività da 5 giorni", actions: ["Invia email followup", "Crea task per commerciale"], status: "in_pausa", runs: 34, lastRun: "2026-02-10 10:00", category: "CRM" },
  { id: 7, name: "Benvenuto nuovo utente", trigger: "Nuovo utente aggiunto", actions: ["Invia credenziali email", "Crea task formazione", "Assegna ruolo base"], status: "attivo", runs: 5, lastRun: "2026-02-15 11:30", category: "Sistema" },
  { id: 8, name: "Backup dati giornaliero", trigger: "Ogni giorno 02:00", actions: ["Esporta database", "Upload su cloud storage", "Verifica integrità"], status: "attivo", runs: 365, lastRun: "2026-02-20 02:00", category: "Sistema" },
  { id: 9, name: "Chiusura ordini completati", trigger: "Ordine consegnato + feedback ricevuto", actions: ["Aggiorna stato a Completato", "Genera fattura", "Archivia documenti"], status: "bozza", runs: 0, lastRun: null, category: "Operazioni" },
];

const automationStatusMap = {
  attivo: { label: "Attivo", color: "#00D68F", bg: "rgba(0,214,143,0.12)" },
  in_pausa: { label: "In pausa", color: "#FFAA2C", bg: "rgba(255,170,44,0.12)" },
  bozza: { label: "Bozza", color: "#8B8D9A", bg: "rgba(139,141,154,0.12)" },
  errore: { label: "Errore", color: "#FF6B6B", bg: "rgba(255,107,107,0.12)" },
};

const INTEGRATIONS = [
  { id: 1, name: "Google Workspace", desc: "Gmail, Calendar, Drive — sincronizzazione bidirezionale", icon: "📧", status: "connesso", category: "Produttività", lastSync: "2026-02-20 09:15", dataSync: "Email, Calendario, File" },
  { id: 2, name: "Slack", desc: "Notifiche real-time e comandi slash", icon: "💬", status: "connesso", category: "Comunicazione", lastSync: "2026-02-20 09:18", dataSync: "Notifiche, Canali" },
  { id: 3, name: "Stripe", desc: "Pagamenti online e fatturazione automatica", icon: "💳", status: "connesso", category: "Pagamenti", lastSync: "2026-02-20 08:00", dataSync: "Transazioni, Abbonamenti" },
  { id: 4, name: "Fatture in Cloud", desc: "Fatturazione elettronica e gestione fiscale italiana", icon: "🧾", status: "connesso", category: "Fiscale", lastSync: "2026-02-20 07:30", dataSync: "Fatture, Note credito" },
  { id: 5, name: "Mailchimp", desc: "Email marketing e campagne automatizzate", icon: "📮", status: "connesso", category: "Marketing", lastSync: "2026-02-19 18:00", dataSync: "Contatti, Campagne" },
  { id: 6, name: "Zapier", desc: "Connetti 5000+ app con workflow automatici", icon: "⚡", status: "connesso", category: "Automazione", lastSync: "2026-02-20 09:10", dataSync: "Trigger, Azioni" },
  { id: 7, name: "HubSpot", desc: "Importa ed esporta contatti e deal", icon: "🔶", status: "disconnesso", category: "CRM", lastSync: null, dataSync: "" },
  { id: 8, name: "Jira", desc: "Sincronizza task e sprint con il team di sviluppo", icon: "🔵", status: "disconnesso", category: "Sviluppo", lastSync: null, dataSync: "" },
  { id: 9, name: "Shopify", desc: "Sincronizza ordini e inventario e-commerce", icon: "🛍️", status: "disconnesso", category: "E-commerce", lastSync: null, dataSync: "" },
  { id: 10, name: "WhatsApp Business", desc: "Messaggistica clienti e notifiche", icon: "📱", status: "disponibile", category: "Comunicazione", lastSync: null, dataSync: "" },
  { id: 11, name: "API REST DoFlow", desc: "API pubblica per integrazioni custom", icon: "🔌", status: "connesso", category: "Sviluppo", lastSync: "2026-02-20 09:20", dataSync: "Tutte le entità" },
  { id: 12, name: "Webhook", desc: "Ricevi e invia eventi in tempo reale", icon: "🪝", status: "connesso", category: "Sviluppo", lastSync: "2026-02-20 09:19", dataSync: "Eventi custom" },
];

const integrationStatusMap = {
  connesso: { label: "Connesso", color: "#00D68F", bg: "rgba(0,214,143,0.12)" },
  disconnesso: { label: "Disconnesso", color: "#8B8D9A", bg: "rgba(139,141,154,0.12)" },
  disponibile: { label: "Disponibile", color: "#818CF8", bg: "rgba(129,140,248,0.12)" },
  errore: { label: "Errore", color: "#FF6B6B", bg: "rgba(255,107,107,0.12)" },
};

const ANALYTICS_KPI = [
  { label: "Ricavi mensili", value: "€47.271", change: "+18%", positive: true, sparkline: [28, 32, 30, 38, 42, 47] },
  { label: "Nuovi clienti", value: "12", change: "+3", positive: true, sparkline: [6, 8, 7, 9, 10, 12] },
  { label: "Tasso conversione", value: "24%", change: "+2.1%", positive: true, sparkline: [18, 19, 21, 20, 22, 24] },
  { label: "Tempo medio chiusura", value: "18 gg", change: "-3gg", positive: true, sparkline: [25, 23, 22, 21, 20, 18] },
  { label: "Churn rate", value: "2.1%", change: "-0.4%", positive: true, sparkline: [3.5, 3.2, 2.8, 2.6, 2.5, 2.1] },
  { label: "LTV medio", value: "€8.400", change: "+€600", positive: true, sparkline: [6200, 6800, 7100, 7500, 7800, 8400] },
];

const ANALYTICS_PIPELINE = [
  { stage: "Nuovo", count: 8, value: 42000, color: "#818CF8" },
  { stage: "Contattato", count: 5, value: 38000, color: "#4ECDC4" },
  { stage: "Proposta", count: 4, value: 95000, color: "#FFAA2C" },
  { stage: "Negoziazione", count: 3, value: 72000, color: "#F59E0B" },
  { stage: "Vinto", count: 6, value: 120000, color: "#00D68F" },
  { stage: "Perso", count: 2, value: 25000, color: "#FF6B6B" },
];

const ANALYTICS_REVENUE_MONTHS = [
  { month: "Set", revenue: 28400, expenses: 18200, profit: 10200 },
  { month: "Ott", revenue: 32100, expenses: 19500, profit: 12600 },
  { month: "Nov", revenue: 30800, expenses: 17800, profit: 13000 },
  { month: "Dic", revenue: 38200, expenses: 21000, profit: 17200 },
  { month: "Gen", revenue: 42500, expenses: 22300, profit: 20200 },
  { month: "Feb", revenue: 47271, expenses: 23400, profit: 23871 },
];

const ANALYTICS_TOP_CLIENTS = [
  { name: "BigCorp SpA", revenue: 65000, deals: 3, color: "#6C5CE7" },
  { name: "InnovateIT", revenue: 22692, deals: 1, color: "#4ECDC4" },
  { name: "SmartFactory", revenue: 20000, deals: 2, color: "#00D68F" },
  { name: "StartupIO", revenue: 14028, deals: 2, color: "#FFAA2C" },
  { name: "MediaGroup", revenue: 11956, deals: 1, color: "#FF6B6B" },
];

const AUDIT_LOG = [
  { id: 1, action: "Login", user: "Marco R.", ip: "85.42.130.22", device: "Chrome / macOS", date: "2026-02-20 09:15", level: "info" },
  { id: 2, action: "Fattura FT-2026/007 creata", user: "Giulia B.", ip: "85.42.130.22", device: "Firefox / Windows", date: "2026-02-20 09:02", level: "info" },
  { id: 3, action: "Permessi ruolo 'Venditore' modificati", user: "Admin", ip: "85.42.130.22", device: "Chrome / macOS", date: "2026-02-20 08:45", level: "warning" },
  { id: 4, action: "Export database completo", user: "Sistema", ip: "—", device: "Cron Job", date: "2026-02-20 02:00", level: "info" },
  { id: 5, action: "Tentativo login fallito — 3 tentativi", user: "admin@doflow.io", ip: "178.62.45.102", device: "Chrome / Linux", date: "2026-02-19 23:12", level: "danger" },
  { id: 6, action: "Nuovo utente 'Sara M.' aggiunto", user: "Admin", ip: "85.42.130.22", device: "Chrome / macOS", date: "2026-02-19 16:30", level: "info" },
  { id: 7, action: "API key rigenerata", user: "Giulia B.", ip: "85.42.130.22", device: "Firefox / Windows", date: "2026-02-19 14:22", level: "warning" },
  { id: 8, action: "Deal 'Migrazione BigCorp' modificata", user: "Marco R.", ip: "85.42.130.22", device: "Chrome / macOS", date: "2026-02-19 11:05", level: "info" },
  { id: 9, action: "Integrazione Stripe riconnessa", user: "Admin", ip: "85.42.130.22", device: "Chrome / macOS", date: "2026-02-19 10:30", level: "info" },
  { id: 10, action: "Backup automatico completato", user: "Sistema", ip: "—", device: "Cron Job", date: "2026-02-19 02:00", level: "info" },
  { id: 11, action: "Password modificata", user: "Luca P.", ip: "93.41.78.55", device: "Safari / iOS", date: "2026-02-18 20:15", level: "warning" },
  { id: 12, action: "Accesso bloccato — IP sospetto", user: "sconosciuto", ip: "45.227.254.8", device: "curl", date: "2026-02-18 04:33", level: "danger" },
];

const SECURITY_SETTINGS = {
  twoFactor: { enabled: true, method: "Authenticator App", enrolledUsers: 4, totalUsers: 5 },
  passwordPolicy: { minLength: 12, requireUppercase: true, requireNumbers: true, requireSpecial: true, expiryDays: 90 },
  sessions: { maxConcurrent: 3, timeout: 30, idleLogout: true },
  ipWhitelist: ["85.42.130.0/24", "93.41.78.0/24"],
};

// ─── STYLE CONSTANTS ─────────────────────────────────────────
const C = {
  bg: "#0E0F13",
  surface: "#16171D",
  surfaceAlt: "#1C1D25",
  border: "#2A2B35",
  borderLight: "#33343F",
  text: "#E8E9ED",
  textMuted: "#8B8D9A",
  textDim: "#5C5E6B",
  accent: "#6C5CE7",
  accentLight: "#8B7CF0",
  accentDim: "rgba(108,92,231,0.15)",
  success: "#00D68F",
  successDim: "rgba(0,214,143,0.12)",
  warning: "#FFAA2C",
  warningDim: "rgba(255,170,44,0.12)",
  danger: "#FF6B6B",
  dangerDim: "rgba(255,107,107,0.12)",
  blue: "#4ECDC4",
  blueDim: "rgba(78,205,196,0.12)",
};

const font = `'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif`;

// ─── HELPERS ─────────────────────────────────────────────────
const StatusBadge = ({ status, map }) => {
  const config = map[status] || { label: status, color: C.textMuted, bg: C.surfaceAlt };
  return (
    <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, letterSpacing: 0.3, background: config.bg, color: config.color, textTransform: "uppercase" }}>
      {config.label}
    </span>
  );
};

const taskStatusMap = {
  todo: { label: "Da fare", color: C.textMuted, bg: C.surfaceAlt, icon: Circle },
  in_progress: { label: "In corso", color: C.warning, bg: C.warningDim, icon: Clock },
  done: { label: "Completato", color: C.success, bg: C.successDim, icon: CheckCircle },
};

const priorityMap = {
  high: { label: "Alta", color: C.danger, bg: C.dangerDim },
  medium: { label: "Media", color: C.warning, bg: C.warningDim },
  low: { label: "Bassa", color: C.blue, bg: C.blueDim },
};

const leadStatusMap = {
  new: { label: "Nuovo", color: C.blue, bg: C.blueDim },
  contacted: { label: "Contattato", color: C.warning, bg: C.warningDim },
  qualified: { label: "Qualificato", color: C.success, bg: C.successDim },
};

const dealStageMap = {
  nuovo: { label: "Nuovo", color: "#818CF8", bg: "rgba(129,140,248,0.12)" },
  contatto: { label: "Contattato", color: C.blue, bg: C.blueDim },
  proposta: { label: "Proposta", color: C.warning, bg: C.warningDim },
  negoziazione: { label: "Negoziazione", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  vinto: { label: "Vinto", color: C.success, bg: C.successDim },
  perso: { label: "Perso", color: C.danger, bg: C.dangerDim },
};

const quoteStatusMap = {
  bozza: { label: "Bozza", color: C.textMuted, bg: C.surfaceAlt },
  inviato: { label: "Inviato", color: C.warning, bg: C.warningDim },
  accettato: { label: "Accettato", color: C.success, bg: C.successDim },
  rifiutato: { label: "Rifiutato", color: C.danger, bg: C.dangerDim },
  scaduto: { label: "Scaduto", color: C.textDim, bg: C.surfaceAlt },
};

const companyStatusMap = {
  attivo: { label: "Cliente", color: C.success, bg: C.successDim },
  prospect: { label: "Prospect", color: C.warning, bg: C.warningDim },
  inattivo: { label: "Inattivo", color: C.textDim, bg: C.surfaceAlt },
};

const contactTypeMap = {
  cliente: { label: "Cliente", color: C.success, bg: C.successDim },
  lead: { label: "Lead", color: C.blue, bg: C.blueDim },
};

const Avatar = ({ initials, size = 36, color = C.accent }) => (
  <div style={{ width: size, height: size, borderRadius: 10, background: `linear-gradient(135deg, ${color}, ${color}99)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.33, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
    {initials}
  </div>
);

const IconBtn = ({ children, onClick, active, style: s, title }) => (
  <button onClick={onClick} title={title} style={{ background: active ? C.accentDim : "transparent", border: "none", color: active ? C.accent : C.textMuted, cursor: "pointer", padding: 6, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", ...s }}>{children}</button>
);

const Btn = ({ children, variant = "default", onClick, style: s, icon: Icon, small }) => {
  const styles = {
    primary: { background: C.accent, color: "#fff", border: "none" },
    default: { background: C.surfaceAlt, color: C.text, border: `1px solid ${C.border}` },
    ghost: { background: "transparent", color: C.textMuted, border: "none" },
    danger: { background: C.dangerDim, color: C.danger, border: "none" },
    success: { background: C.successDim, color: C.success, border: "none" },
  };
  return (
    <button onClick={onClick} style={{ padding: small ? "5px 10px" : "8px 16px", borderRadius: 10, fontSize: small ? 11 : 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s", fontFamily: font, whiteSpace: "nowrap", ...styles[variant], ...s }}>
      {Icon && <Icon size={small ? 12 : 15} />}{children}
    </button>
  );
};

const SearchBar = ({ value, onChange, placeholder }) => (
  <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
    <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textDim }} />
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || "Cerca..."} style={{ width: "100%", padding: "9px 12px 9px 36px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 13, fontFamily: font, outline: "none", boxSizing: "border-box" }} />
  </div>
);

const Card = ({ children, style: s, onClick }) => (
  <div onClick={onClick} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, ...s, ...(onClick ? { cursor: "pointer", transition: "border-color 0.15s" } : {}) }}>{children}</div>
);

const StatCard = ({ label, value, icon: Icon, color, change, suffix }) => (
  <Card style={{ flex: 1, minWidth: 170 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={18} color={color} />
      </div>
      {change != null && <span style={{ fontSize: 11, fontWeight: 600, color: change > 0 ? C.success : change < 0 ? C.danger : C.textMuted }}>{change > 0 ? "+" : ""}{change}%</span>}
    </div>
    <div style={{ fontSize: 26, fontWeight: 700, color: C.text, marginBottom: 2 }}>{value}{suffix && <span style={{ fontSize: 14, color: C.textMuted, fontWeight: 500, marginLeft: 2 }}>{suffix}</span>}</div>
    <div style={{ fontSize: 12, color: C.textMuted }}>{label}</div>
  </Card>
);

const TabBar = ({ tabs, active, onChange }) => (
  <div style={{ display: "flex", gap: 2, background: C.surfaceAlt, borderRadius: 10, padding: 3 }}>
    {tabs.map(t => (
      <button key={t.key} onClick={() => onChange(t.key)} style={{ padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: font, transition: "all 0.15s", background: active === t.key ? C.surface : "transparent", color: active === t.key ? C.text : C.textMuted, boxShadow: active === t.key ? "0 1px 3px rgba(0,0,0,0.3)" : "none" }}>
        {t.label}
      </button>
    ))}
  </div>
);

const Toggle = ({ checked, onChange }) => (
  <div onClick={onChange} style={{ width: 42, height: 24, borderRadius: 12, background: checked ? C.accent : C.borderLight, cursor: "pointer", position: "relative", transition: "all 0.2s" }}>
    <div style={{ width: 18, height: 18, borderRadius: 9, background: "#fff", position: "absolute", top: 3, left: checked ? 21 : 3, transition: "all 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
  </div>
);

const EmptyState = ({ icon: Icon, title, desc }) => (
  <div style={{ textAlign: "center", padding: "48px 20px" }}>
    <div style={{ width: 56, height: 56, borderRadius: 16, background: C.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
      <Icon size={24} color={C.textDim} />
    </div>
    <div style={{ fontSize: 15, fontWeight: 600, color: C.textMuted, marginBottom: 4 }}>{title}</div>
    {desc && <div style={{ fontSize: 13, color: C.textDim }}>{desc}</div>}
  </div>
);

const fmt = (n) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const PageHeader = ({ title, desc, children }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, margin: 0 }}>{title}</h1>
      <p style={{ color: C.textMuted, fontSize: 13, margin: "6px 0 0" }}>{desc}</p>
    </div>
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{children}</div>
  </div>
);

// ─── PAGES ───────────────────────────────────────────────────

// ━━━ DASHBOARD ━━━
const DashboardPage = ({ setPage }) => {
  const totalPipeline = DEALS.filter(d => !["vinto", "perso"].includes(d.stage)).reduce((s, d) => s + d.value, 0);
  return (
    <div>
      <PageHeader title="Dashboard" desc="Panoramica delle attività e metriche principali" />
      <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <StatCard label="Deal attive" value={DEALS.filter(d => !["vinto", "perso"].includes(d.stage)).length} icon={Briefcase} color={C.accent} change={12} />
        <StatCard label="Pipeline totale" value={fmt(totalPipeline)} icon={TrendingUp} color={C.warning} />
        <StatCard label="Tasso conversione" value="23" suffix="%" icon={Target} color={C.success} change={5} />
        <StatCard label="Contatti" value={CONTACTS.length} icon={Users} color={C.blue} change={18} />
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Card style={{ flex: 2, minWidth: 300 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Deal recenti</div>
            <Btn variant="ghost" small onClick={() => setPage("deals")}>Vedi tutte <ChevronRight size={14} /></Btn>
          </div>
          {DEALS.filter(d => !["vinto", "perso"].includes(d.stage)).slice(0, 5).map(d => (
            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ width: 4, height: 32, borderRadius: 2, background: dealStageMap[d.stage]?.color || C.textDim }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>{d.company}</div>
              </div>
              <StatusBadge status={d.stage} map={dealStageMap} />
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text, minWidth: 70, textAlign: "right" }}>{fmt(d.value)}</span>
            </div>
          ))}
        </Card>
        <Card style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Nuovi contatti</div>
            <Btn variant="ghost" small onClick={() => setPage("contacts")}>Vedi tutti <ChevronRight size={14} /></Btn>
          </div>
          {CONTACTS.slice(0, 5).map(c => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
              <Avatar initials={c.avatar} size={32} color={c.type === "cliente" ? C.success : C.blue} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{c.name}</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>{c.company} · {c.role}</div>
              </div>
              <StatusBadge status={c.type} map={contactTypeMap} />
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
};

// ━━━ DEALS — PIPELINE KANBAN ━━━
const PIPELINE_STAGES = ["nuovo", "contatto", "proposta", "negoziazione", "vinto", "perso"];

const DealsPage = ({ setPage, setSelectedCustomer }) => {
  const [deals, setDeals] = useState(DEALS);
  const [viewMode, setViewMode] = useState("kanban");
  const [search, setSearch] = useState("");
  const [draggedDeal, setDraggedDeal] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  const filteredDeals = deals.filter(d => {
    if (search && !d.title.toLowerCase().includes(search.toLowerCase()) && !d.company.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stageDeals = (stage) => filteredDeals.filter(d => d.stage === stage);
  const stageTotal = (stage) => stageDeals(stage).reduce((s, d) => s + d.value, 0);
  const pipelineTotal = filteredDeals.filter(d => !["vinto", "perso"].includes(d.stage)).reduce((s, d) => s + d.value, 0);
  const weightedTotal = filteredDeals.filter(d => !["vinto", "perso"].includes(d.stage)).reduce((s, d) => s + (d.value * d.probability / 100), 0);

  const handleDrop = (stage) => {
    if (draggedDeal != null) {
      setDeals(ds => ds.map(d => d.id === draggedDeal ? { ...d, stage, probability: stage === "vinto" ? 100 : stage === "perso" ? 0 : d.probability } : d));
      setDraggedDeal(null);
      setDragOverStage(null);
    }
  };

  const DealCard = ({ deal }) => {
    const daysUntilClose = Math.ceil((new Date(deal.closeDate) - new Date()) / 86400000);
    const isOverdue = daysUntilClose < 0;
    const isUrgent = daysUntilClose >= 0 && daysUntilClose <= 7;
    return (
      <div
        draggable
        onDragStart={() => setDraggedDeal(deal.id)}
        onDragEnd={() => { setDraggedDeal(null); setDragOverStage(null); }}
        style={{
          background: C.bg, borderRadius: 10, padding: 14, border: `1px solid ${draggedDeal === deal.id ? C.accent : C.border}`,
          cursor: "grab", transition: "all 0.15s", opacity: draggedDeal === deal.id ? 0.5 : 1,
        }}
        onMouseEnter={e => { if (draggedDeal !== deal.id) e.currentTarget.style.borderColor = C.borderLight; }}
        onMouseLeave={e => { if (draggedDeal !== deal.id) e.currentTarget.style.borderColor = C.border; }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.3, flex: 1, marginRight: 8 }}>{deal.title}</div>
          <StatusBadge status={deal.priority} map={priorityMap} />
        </div>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <Building size={11} /> {deal.company}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{fmt(deal.value)}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.accentLight }}>{deal.probability}%</span>
        </div>
        <div style={{ width: "100%", height: 3, borderRadius: 2, background: C.surfaceAlt, marginBottom: 10 }}>
          <div style={{ width: `${deal.probability}%`, height: "100%", borderRadius: 2, background: deal.probability >= 70 ? C.success : deal.probability >= 40 ? C.warning : C.accent, transition: "width 0.3s" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Avatar initials={deal.owner.split(" ").map(w => w[0]).join("")} size={22} color={C.accent} />
            <span style={{ fontSize: 11, color: C.textDim }}>{deal.owner}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: isOverdue ? C.danger : isUrgent ? C.warning : C.textDim }}>
            <Calendar size={10} />
            {isOverdue ? "Scaduto" : `${daysUntilClose}g`}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <PageHeader title="Pipeline Vendite" desc={`${filteredDeals.filter(d => !["vinto","perso"].includes(d.stage)).length} deal attive · Pipeline ${fmt(pipelineTotal)} · Pesato ${fmt(weightedTotal)}`}>
        <Btn variant="primary" icon={Plus}>Nuova deal</Btn>
      </PageHeader>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Cerca deal..." />
        <TabBar tabs={[{ key: "kanban", label: "Kanban" }, { key: "lista", label: "Lista" }]} active={viewMode} onChange={setViewMode} />
      </div>

      {viewMode === "kanban" ? (
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 16, minHeight: 500 }}>
          {PIPELINE_STAGES.map(stage => {
            const conf = dealStageMap[stage];
            const sDeals = stageDeals(stage);
            return (
              <div
                key={stage}
                onDragOver={e => { e.preventDefault(); setDragOverStage(stage); }}
                onDragLeave={() => setDragOverStage(null)}
                onDrop={() => handleDrop(stage)}
                style={{
                  flex: 1, minWidth: 240, maxWidth: 300,
                  background: dragOverStage === stage ? `${conf.color}08` : "transparent",
                  borderRadius: 14, padding: 0, transition: "background 0.15s",
                }}
              >
                <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 4, background: conf.color }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{conf.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.textDim, background: C.surfaceAlt, padding: "2px 7px", borderRadius: 6 }}>{sDeals.length}</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted }}>{fmt(stageTotal(stage))}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 6px 6px" }}>
                  {sDeals.map(d => <DealCard key={d.id} deal={d} />)}
                  {sDeals.length === 0 && (
                    <div style={{ padding: 24, textAlign: "center", border: `1px dashed ${C.border}`, borderRadius: 10 }}>
                      <div style={{ fontSize: 12, color: C.textDim }}>Trascina qui</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {["Deal", "Azienda", "Valore", "Fase", "Probabilità", "Chiusura", "Proprietario"].map(h => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: C.textDim, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredDeals.map(d => (
                <tr key={d.id} style={{ borderBottom: `1px solid ${C.border}`, transition: "background 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ fontWeight: 600, color: C.text }}>{d.title}</div>
                    <div style={{ fontSize: 11, color: C.textDim, marginTop: 2, display: "flex", gap: 4 }}>
                      {d.tags.map(t => <span key={t} style={{ padding: "1px 6px", borderRadius: 4, background: C.surfaceAlt, fontSize: 10 }}>{t}</span>)}
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px", color: C.textMuted }}>{d.company}</td>
                  <td style={{ padding: "12px 14px", fontWeight: 700, color: C.text }}>{fmt(d.value)}</td>
                  <td style={{ padding: "12px 14px" }}><StatusBadge status={d.stage} map={dealStageMap} /></td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 40, height: 4, borderRadius: 2, background: C.surfaceAlt, overflow: "hidden" }}>
                        <div style={{ width: `${d.probability}%`, height: "100%", borderRadius: 2, background: d.probability >= 70 ? C.success : d.probability >= 40 ? C.warning : C.accent }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.textMuted }}>{d.probability}%</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: C.textMuted }}>{new Date(d.closeDate).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Avatar initials={d.owner.split(" ").map(w => w[0]).join("")} size={24} color={C.accent} />
                      <span style={{ fontSize: 12, color: C.textMuted }}>{d.owner}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
};

// ━━━ CUSTOMER DETAIL (360°) ━━━
const CustomerDetailPage = ({ customerId, setPage }) => {
  const customer = CONTACTS.find(c => c.id === customerId) || CONTACTS[0];
  const company = COMPANIES.find(co => co.id === customer.companyId);
  const customerDeals = DEALS.filter(d => d.companyId === customer.companyId);
  const customerQuotes = QUOTES.filter(q => q.contact === customer.name);
  const [activeTab, setActiveTab] = useState("attivita");
  const [newNote, setNewNote] = useState("");

  const totalValue = customerDeals.reduce((s, d) => s + d.value, 0);
  const wonValue = customerDeals.filter(d => d.stage === "vinto").reduce((s, d) => s + d.value, 0);

  const activityIcons = { email: Mail, call: Phone, note: MessageSquare, meeting: Calendar, deal: Briefcase };

  return (
    <div>
      {/* Back nav */}
      <button onClick={() => setPage("contacts")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: C.textMuted, fontSize: 13, cursor: "pointer", fontFamily: font, marginBottom: 16, padding: 0 }}>
        <ChevronLeft size={16} /> Torna ai contatti
      </button>

      {/* Header */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
          <Avatar initials={customer.avatar} size={64} color={customer.type === "cliente" ? C.success : C.blue} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.text }}>{customer.name}</h2>
              <StatusBadge status={customer.type} map={contactTypeMap} />
            </div>
            <div style={{ fontSize: 14, color: C.accentLight, marginBottom: 8 }}>{customer.role} @ {customer.company}</div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.textMuted }}><Mail size={14} /> {customer.email}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.textMuted }}><Phone size={14} /> {customer.phone}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.textMuted }}><MapPin size={14} /> {customer.city}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="default" icon={Mail} small>Email</Btn>
            <Btn variant="default" icon={Phone} small>Chiama</Btn>
            <Btn variant="primary" icon={Plus} small>Nuova deal</Btn>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <StatCard label="Valore totale deal" value={fmt(totalValue)} icon={Briefcase} color={C.accent} />
        <StatCard label="Valore vinto" value={fmt(wonValue)} icon={ThumbsUp} color={C.success} />
        <StatCard label="Deal attive" value={customerDeals.filter(d => !["vinto","perso"].includes(d.stage)).length} icon={Target} color={C.warning} />
        <StatCard label="Preventivi" value={customerQuotes.length} icon={FileText} color={C.blue} />
      </div>

      {/* Tabs content */}
      <div style={{ marginBottom: 16 }}>
        <TabBar tabs={[
          { key: "attivita", label: "Attività" },
          { key: "deals", label: `Deal (${customerDeals.length})` },
          { key: "preventivi", label: `Preventivi (${customerQuotes.length})` },
          { key: "azienda", label: "Azienda" },
        ]} active={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === "attivita" && (
        <Card>
          {/* Quick note */}
          <div style={{ display: "flex", gap: 10, marginBottom: 20, padding: 14, background: C.bg, borderRadius: 10, border: `1px solid ${C.border}` }}>
            <input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Aggiungi una nota rapida..." style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "none", background: "transparent", color: C.text, fontSize: 13, fontFamily: font, outline: "none" }} />
            <Btn variant="primary" icon={Send} small>Invia</Btn>
          </div>
          {/* Timeline */}
          <div>
            {CUSTOMER_ACTIVITIES.map((a, i) => {
              const AIcon = activityIcons[a.type] || Activity;
              const colors = { email: C.accent, call: C.success, note: C.warning, meeting: C.blue, deal: "#818CF8" };
              return (
                <div key={a.id} style={{ display: "flex", gap: 14, paddingBottom: 20, position: "relative" }}>
                  {i < CUSTOMER_ACTIVITIES.length - 1 && (
                    <div style={{ position: "absolute", left: 17, top: 38, bottom: 0, width: 1, background: C.border }} />
                  )}
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${colors[a.type]}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, zIndex: 1 }}>
                    <AIcon size={16} color={colors[a.type]} />
                  </div>
                  <div style={{ flex: 1, paddingTop: 2 }}>
                    <div style={{ fontSize: 13, color: C.text, lineHeight: 1.4, marginBottom: 4 }}>{a.text}</div>
                    <div style={{ fontSize: 11, color: C.textDim, display: "flex", gap: 10 }}>
                      <span>{a.date}</span>
                      <span>·</span>
                      <span>{a.user}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {activeTab === "deals" && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {["Deal", "Valore", "Fase", "Probabilità", "Chiusura prevista"].map(h => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: C.textDim, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customerDeals.map(d => (
                <tr key={d.id} style={{ borderBottom: `1px solid ${C.border}` }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "12px 14px", fontWeight: 600, color: C.text }}>{d.title}</td>
                  <td style={{ padding: "12px 14px", fontWeight: 700, color: C.text }}>{fmt(d.value)}</td>
                  <td style={{ padding: "12px 14px" }}><StatusBadge status={d.stage} map={dealStageMap} /></td>
                  <td style={{ padding: "12px 14px", color: C.textMuted }}>{d.probability}%</td>
                  <td style={{ padding: "12px 14px", color: C.textMuted }}>{new Date(d.closeDate).toLocaleDateString("it-IT")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {customerDeals.length === 0 && <EmptyState icon={Briefcase} title="Nessuna deal" desc="Crea la prima deal per questo contatto" />}
        </Card>
      )}

      {activeTab === "preventivi" && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {["Numero", "Titolo", "Stato", "Importo", "Data emissione", "Scadenza"].map(h => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: C.textDim, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customerQuotes.map(q => (
                <tr key={q.id} style={{ borderBottom: `1px solid ${C.border}` }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "12px 14px", fontWeight: 600, color: C.accentLight, fontFamily: "monospace", fontSize: 12 }}>{q.id}</td>
                  <td style={{ padding: "12px 14px", color: C.text }}>{q.title}</td>
                  <td style={{ padding: "12px 14px" }}><StatusBadge status={q.status} map={quoteStatusMap} /></td>
                  <td style={{ padding: "12px 14px", fontWeight: 700, color: C.text }}>{fmt(q.total)}</td>
                  <td style={{ padding: "12px 14px", color: C.textMuted }}>{new Date(q.issueDate).toLocaleDateString("it-IT")}</td>
                  <td style={{ padding: "12px 14px", color: C.textMuted }}>{new Date(q.expiryDate).toLocaleDateString("it-IT")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {customerQuotes.length === 0 && <EmptyState icon={FileText} title="Nessun preventivo" desc="Crea un preventivo per questo contatto" />}
        </Card>
      )}

      {activeTab === "azienda" && company && (
        <Card>
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start", marginBottom: 20 }}>
            <Avatar initials={company.avatar} size={48} color={C.accent} />
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: C.text }}>{company.name}</h3>
              <StatusBadge status={company.status} map={companyStatusMap} />
            </div>
            <Btn variant="default" icon={ExternalLink} small onClick={() => setPage("companies")}>Vai all'azienda</Btn>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
            {[
              { label: "Settore", value: company.sector, icon: Tag },
              { label: "Dipendenti", value: company.employees, icon: Users },
              { label: "Fatturato", value: company.revenue, icon: TrendingUp },
              { label: "Città", value: company.city, icon: MapPin },
              { label: "Website", value: company.website, icon: Globe },
              { label: "P.IVA", value: company.vat, icon: Hash },
            ].map(info => (
              <div key={info.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, background: C.bg, borderRadius: 10 }}>
                <info.icon size={16} color={C.textDim} />
                <div>
                  <div style={{ fontSize: 11, color: C.textDim, marginBottom: 2 }}>{info.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{info.value}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

// ━━━ CONTACTS ━━━
const ContactsPage = ({ setPage, setSelectedCustomer }) => {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [viewMode, setViewMode] = useState("grid");

  const filtered = CONTACTS.filter(c => {
    if (filterType !== "all" && c.type !== filterType) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.company.toLowerCase().includes(search.toLowerCase()) && !c.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openDetail = (id) => { setSelectedCustomer(id); setPage("customer-detail"); };

  return (
    <div>
      <PageHeader title="Rubrica Contatti" desc={`${CONTACTS.length} contatti totali · ${CONTACTS.filter(c => c.type === "cliente").length} clienti · ${CONTACTS.filter(c => c.type === "lead").length} lead`}>
        <Btn variant="primary" icon={UserPlus}>Nuovo contatto</Btn>
      </PageHeader>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Cerca contatti..." />
        <TabBar tabs={[
          { key: "all", label: `Tutti (${CONTACTS.length})` },
          { key: "cliente", label: `Clienti (${CONTACTS.filter(c => c.type === "cliente").length})` },
          { key: "lead", label: `Lead (${CONTACTS.filter(c => c.type === "lead").length})` },
        ]} active={filterType} onChange={setFilterType} />
        <div style={{ display: "flex", gap: 2, background: C.surfaceAlt, borderRadius: 8, padding: 2 }}>
          <IconBtn active={viewMode === "grid"} onClick={() => setViewMode("grid")}><Grid3X3 size={16} /></IconBtn>
          <IconBtn active={viewMode === "list"} onClick={() => setViewMode("list")}><List size={16} /></IconBtn>
        </div>
      </div>

      {viewMode === "grid" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
          {filtered.map(c => (
            <Card key={c.id} onClick={() => openDetail(c.id)} style={{ transition: "border-color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = C.borderLight}
              onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <Avatar initials={c.avatar} size={44} color={c.type === "cliente" ? C.success : C.blue} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{c.name}</div>
                    <StatusBadge status={c.type} map={contactTypeMap} />
                  </div>
                  <div style={{ fontSize: 12, color: C.accentLight, marginBottom: 8 }}>{c.role} · {c.company}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.textMuted }}><Mail size={11} /> {c.email}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.textMuted }}><Phone size={11} /> {c.phone}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.textMuted }}><MapPin size={11} /> {c.city}</div>
                  </div>
                  <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                    {c.tags.map(t => (
                      <span key={t} style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: C.accentDim, color: C.accentLight }}>{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {["Contatto", "Azienda", "Ruolo", "Tipo", "Città", "Ultimo contatto"].map(h => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: C.textDim, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer", transition: "background 0.15s" }}
                  onClick={() => openDetail(c.id)}
                  onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar initials={c.avatar} size={32} color={c.type === "cliente" ? C.success : C.blue} />
                      <div>
                        <div style={{ fontWeight: 600, color: C.text }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: C.textMuted }}>{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px", color: C.textMuted }}>{c.company}</td>
                  <td style={{ padding: "12px 14px", color: C.textMuted }}>{c.role}</td>
                  <td style={{ padding: "12px 14px" }}><StatusBadge status={c.type} map={contactTypeMap} /></td>
                  <td style={{ padding: "12px 14px", color: C.textMuted }}>{c.city}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: C.textMuted }}>{new Date(c.lastContact).toLocaleDateString("it-IT")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
};

// ━━━ COMPANIES ━━━
const CompaniesPage = ({ setPage }) => {
  const [search, setSearch] = useState("");
  const [filterSector, setFilterSector] = useState("all");

  const sectors = [...new Set(COMPANIES.map(c => c.sector))];
  const filtered = COMPANIES.filter(c => {
    if (filterSector !== "all" && c.sector !== filterSector) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.sector.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalRevenue = COMPANIES.reduce((s, c) => {
    const num = parseFloat(c.revenue.replace(/[^0-9.]/g, "")) * (c.revenue.includes("M") ? 1000000 : c.revenue.includes("K") ? 1000 : 1);
    return s + num;
  }, 0);

  return (
    <div>
      <PageHeader title="Anagrafica Aziende" desc={`${COMPANIES.length} aziende registrate · ${COMPANIES.filter(c => c.status === "attivo").length} clienti attivi`}>
        <Btn variant="primary" icon={Plus}>Nuova azienda</Btn>
      </PageHeader>

      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <StatCard label="Aziende totali" value={COMPANIES.length} icon={Building} color={C.accent} />
        <StatCard label="Clienti attivi" value={COMPANIES.filter(c => c.status === "attivo").length} icon={CheckCircle} color={C.success} />
        <StatCard label="Prospect" value={COMPANIES.filter(c => c.status === "prospect").length} icon={Target} color={C.warning} />
        <StatCard label="Contatti totali" value={COMPANIES.reduce((s, c) => s + c.contacts, 0)} icon={Users} color={C.blue} />
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Cerca aziende..." />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Btn variant={filterSector === "all" ? "primary" : "default"} onClick={() => setFilterSector("all")} small>Tutti</Btn>
          {sectors.map(s => (
            <Btn key={s} variant={filterSector === s ? "primary" : "default"} onClick={() => setFilterSector(s)} small>{s}</Btn>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
        {filtered.map(co => {
          const companyDeals = DEALS.filter(d => d.companyId === co.id);
          const activeDealValue = companyDeals.filter(d => !["vinto","perso"].includes(d.stage)).reduce((s, d) => s + d.value, 0);
          return (
            <Card key={co.id} style={{ transition: "border-color 0.15s", cursor: "pointer" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = C.borderLight}
              onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
                <Avatar initials={co.avatar} size={44} color={C.accent} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{co.name}</div>
                    <StatusBadge status={co.status} map={companyStatusMap} />
                  </div>
                  <div style={{ fontSize: 12, color: C.accentLight, display: "flex", alignItems: "center", gap: 6 }}>
                    <Tag size={11} /> {co.sector}
                    <span style={{ color: C.textDim }}>·</span>
                    <MapPin size={11} /> {co.city}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div style={{ padding: "8px 10px", background: C.bg, borderRadius: 8, textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{co.employees}</div>
                  <div style={{ fontSize: 10, color: C.textDim }}>Dipendenti</div>
                </div>
                <div style={{ padding: "8px 10px", background: C.bg, borderRadius: 8, textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{co.contacts}</div>
                  <div style={{ fontSize: 10, color: C.textDim }}>Contatti</div>
                </div>
                <div style={{ padding: "8px 10px", background: C.bg, borderRadius: 8, textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{companyDeals.length}</div>
                  <div style={{ fontSize: 10, color: C.textDim }}>Deal</div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0 0", borderTop: `1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontSize: 11, color: C.textDim }}>Fatturato</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{co.revenue}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: C.textDim }}>Pipeline attiva</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: activeDealValue > 0 ? C.accent : C.textDim }}>{activeDealValue > 0 ? fmt(activeDealValue) : "—"}</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

// ━━━ QUOTES ━━━
const QuotesPage = ({ setPage }) => {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedQuote, setExpandedQuote] = useState(null);

  const filtered = QUOTES.filter(q => {
    if (filterStatus !== "all" && q.status !== filterStatus) return false;
    if (search && !q.title.toLowerCase().includes(search.toLowerCase()) && !q.company.toLowerCase().includes(search.toLowerCase()) && !q.id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalAccepted = QUOTES.filter(q => q.status === "accettato").reduce((s, q) => s + q.total, 0);
  const totalPending = QUOTES.filter(q => q.status === "inviato").reduce((s, q) => s + q.total, 0);

  return (
    <div>
      <PageHeader title="Preventivi" desc={`${QUOTES.length} preventivi totali · ${fmt(totalAccepted)} accettati · ${fmt(totalPending)} in attesa`}>
        <Btn variant="primary" icon={Plus}>Nuovo preventivo</Btn>
      </PageHeader>

      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <StatCard label="Totale emessi" value={QUOTES.length} icon={FileText} color={C.accent} />
        <StatCard label="Accettati" value={fmt(totalAccepted)} icon={ThumbsUp} color={C.success} />
        <StatCard label="In attesa" value={fmt(totalPending)} icon={Clock} color={C.warning} />
        <StatCard label="Tasso accettazione" value={`${Math.round(QUOTES.filter(q => q.status === "accettato").length / QUOTES.length * 100)}%`} icon={Target} color={C.blue} />
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Cerca preventivi..." />
        <TabBar tabs={[
          { key: "all", label: `Tutti (${QUOTES.length})` },
          { key: "bozza", label: `Bozze (${QUOTES.filter(q => q.status === "bozza").length})` },
          { key: "inviato", label: `Inviati (${QUOTES.filter(q => q.status === "inviato").length})` },
          { key: "accettato", label: `Accettati (${QUOTES.filter(q => q.status === "accettato").length})` },
        ]} active={filterStatus} onChange={setFilterStatus} />
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {["Numero", "Preventivo", "Azienda", "Stato", "Importo", "Data", "Scadenza", ""].map(h => (
                <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: C.textDim, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(q => {
              const isExpired = new Date(q.expiryDate) < new Date() && q.status === "inviato";
              return (
                <React.Fragment key={q.id}>
                  <tr style={{ borderBottom: expandedQuote === q.id ? "none" : `1px solid ${C.border}`, cursor: "pointer", transition: "background 0.15s" }}
                    onClick={() => setExpandedQuote(expandedQuote === q.id ? null : q.id)}
                    onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontWeight: 600, color: C.accentLight, fontFamily: "monospace", fontSize: 12 }}>{q.id}</span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 600, color: C.text }}>{q.title}</div>
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{q.contact}</div>
                    </td>
                    <td style={{ padding: "12px 14px", color: C.textMuted }}>{q.company}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <StatusBadge status={isExpired ? "scaduto" : q.status} map={quoteStatusMap} />
                    </td>
                    <td style={{ padding: "12px 14px", fontWeight: 700, color: C.text }}>{fmt(q.total)}</td>
                    <td style={{ padding: "12px 14px", color: C.textMuted, fontSize: 12 }}>{new Date(q.issueDate).toLocaleDateString("it-IT")}</td>
                    <td style={{ padding: "12px 14px", color: isExpired ? C.danger : C.textMuted, fontSize: 12 }}>{new Date(q.expiryDate).toLocaleDateString("it-IT")}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <IconBtn title="Scarica PDF"><Download size={14} /></IconBtn>
                        <IconBtn title="Duplica"><Copy size={14} /></IconBtn>
                        <IconBtn title="Altro"><MoreHorizontal size={14} /></IconBtn>
                      </div>
                    </td>
                  </tr>
                  {expandedQuote === q.id && (
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td colSpan={8} style={{ padding: "0 14px 16px", background: C.surfaceAlt }}>
                        <div style={{ padding: 16, background: C.bg, borderRadius: 10, marginTop: 4 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Dettaglio voci</div>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                            <thead>
                              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                                <th style={{ padding: "8px 0", textAlign: "left", color: C.textDim, fontWeight: 600 }}>Descrizione</th>
                                <th style={{ padding: "8px 0", textAlign: "right", color: C.textDim, fontWeight: 600, width: 60 }}>Qtà</th>
                                <th style={{ padding: "8px 0", textAlign: "right", color: C.textDim, fontWeight: 600, width: 100 }}>Prezzo</th>
                                <th style={{ padding: "8px 0", textAlign: "right", color: C.textDim, fontWeight: 600, width: 100 }}>Totale</th>
                              </tr>
                            </thead>
                            <tbody>
                              {q.items.map((item, i) => (
                                <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                                  <td style={{ padding: "8px 0", color: C.text }}>{item.desc}</td>
                                  <td style={{ padding: "8px 0", textAlign: "right", color: C.textMuted }}>{item.qty}</td>
                                  <td style={{ padding: "8px 0", textAlign: "right", color: C.textMuted }}>{fmt(item.price)}</td>
                                  <td style={{ padding: "8px 0", textAlign: "right", color: C.text, fontWeight: 600 }}>{fmt(item.qty * item.price)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                            <div style={{ minWidth: 200 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12 }}>
                                <span style={{ color: C.textMuted }}>Subtotale</span>
                                <span style={{ color: C.text }}>{fmt(q.subtotal)}</span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12, borderBottom: `1px solid ${C.border}` }}>
                                <span style={{ color: C.textMuted }}>IVA (22%)</span>
                                <span style={{ color: C.text }}>{fmt(q.vat)}</span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 14, fontWeight: 700 }}>
                                <span style={{ color: C.text }}>Totale</span>
                                <span style={{ color: C.accent }}>{fmt(q.total)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

// ━━━ PRODUCTS — CATALOGO ━━━
const ProductsPage = () => {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [viewMode, setViewMode] = useState("grid");
  const [expandedProduct, setExpandedProduct] = useState(null);

  const filtered = PRODUCTS.filter(p => {
    if (filterCategory !== "all" && p.category !== filterCategory) return false;
    if (filterType !== "all" && p.type !== filterType) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.sku.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const activeProducts = PRODUCTS.filter(p => p.status === "attivo").length;
  const services = PRODUCTS.filter(p => p.type === "servizio").length;
  const products = PRODUCTS.filter(p => p.type === "prodotto").length;

  return (
    <div>
      <PageHeader title="Catalogo Prodotti & Servizi" desc={`${PRODUCTS.length} articoli · ${activeProducts} attivi · ${services} servizi · ${products} prodotti`}>
        <Btn variant="primary" icon={Plus}>Nuovo articolo</Btn>
      </PageHeader>

      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <StatCard label="Articoli totali" value={PRODUCTS.length} icon={Package} color={C.accent} />
        <StatCard label="Servizi" value={services} icon={Briefcase} color={C.blue} />
        <StatCard label="Prodotti" value={products} icon={Box} color={C.warning} />
        <StatCard label="Categorie" value={PRODUCT_CATEGORIES.length} icon={Layers} color={C.success} />
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Cerca per nome o SKU..." />
        <TabBar tabs={[
          { key: "all", label: `Tutti (${PRODUCTS.length})` },
          { key: "servizio", label: `Servizi (${services})` },
          { key: "prodotto", label: `Prodotti (${products})` },
        ]} active={filterType} onChange={setFilterType} />
        <div style={{ display: "flex", gap: 2, background: C.surfaceAlt, borderRadius: 8, padding: 2 }}>
          <IconBtn active={viewMode === "grid"} onClick={() => setViewMode("grid")}><Grid3X3 size={16} /></IconBtn>
          <IconBtn active={viewMode === "list"} onClick={() => setViewMode("list")}><List size={16} /></IconBtn>
        </div>
      </div>

      {/* Category filter chips */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        <Btn variant={filterCategory === "all" ? "primary" : "default"} onClick={() => setFilterCategory("all")} small>Tutte</Btn>
        {PRODUCT_CATEGORIES.map(cat => (
          <Btn key={cat} variant={filterCategory === cat ? "primary" : "default"} onClick={() => setFilterCategory(cat)} small>{cat}</Btn>
        ))}
      </div>

      {viewMode === "grid" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {filtered.map(p => (
            <Card key={p.id} onClick={() => setExpandedProduct(expandedProduct === p.id ? null : p.id)}
              style={{ transition: "border-color 0.15s", cursor: "pointer" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = C.borderLight}
              onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{p.image}</div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <StatusBadge status={p.status} map={productStatusMap} />
                </div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: C.textDim, fontFamily: "monospace", marginBottom: 6 }}>{p.sku}</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.description}</div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", padding: "10px 0 0", borderTop: `1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>{fmt(p.price)}</div>
                  <div style={{ fontSize: 11, color: C.textDim }}>/{p.unit}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: p.type === "servizio" ? C.blueDim : C.warningDim, color: p.type === "servizio" ? C.blue : C.warning, textTransform: "uppercase" }}>
                    {p.type === "servizio" ? "Servizio" : "Prodotto"}
                  </span>
                  {p.stock != null && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>Stock: {p.stock}</div>}
                </div>
              </div>

              {expandedProduct === p.id && (
                <div style={{ marginTop: 14, padding: "12px 0 0", borderTop: `1px solid ${C.border}` }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div style={{ padding: 8, background: C.bg, borderRadius: 8 }}>
                      <div style={{ fontSize: 10, color: C.textDim }}>Categoria</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{p.category}</div>
                    </div>
                    <div style={{ padding: 8, background: C.bg, borderRadius: 8 }}>
                      <div style={{ fontSize: 10, color: C.textDim }}>IVA</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{p.taxRate}%</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    <Btn variant="default" small icon={Edit2}>Modifica</Btn>
                    <Btn variant="default" small icon={Copy}>Duplica</Btn>
                    <Btn variant="danger" small icon={Archive}>Archivia</Btn>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {["Articolo", "SKU", "Categoria", "Tipo", "Prezzo", "Stato", ""].map(h => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: C.textDim, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}`, transition: "background 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{p.image}</div>
                      <div>
                        <div style={{ fontWeight: 600, color: C.text }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: C.textMuted, maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.description}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px", fontFamily: "monospace", fontSize: 11, color: C.textDim }}>{p.sku}</td>
                  <td style={{ padding: "12px 14px", color: C.textMuted }}>{p.category}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: p.type === "servizio" ? C.blueDim : C.warningDim, color: p.type === "servizio" ? C.blue : C.warning, textTransform: "uppercase" }}>
                      {p.type === "servizio" ? "Servizio" : "Prodotto"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ fontWeight: 700, color: C.text }}>{fmt(p.price)}</div>
                    <div style={{ fontSize: 10, color: C.textDim }}>/{p.unit}</div>
                  </td>
                  <td style={{ padding: "12px 14px" }}><StatusBadge status={p.status} map={productStatusMap} /></td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <IconBtn title="Modifica"><Edit2 size={14} /></IconBtn>
                      <IconBtn title="Duplica"><Copy size={14} /></IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {filtered.length === 0 && <EmptyState icon={Package} title="Nessun articolo trovato" desc="Prova a modificare i filtri di ricerca" />}
    </div>
  );
};

// ━━━ ORDERS — GESTIONE ORDINI ━━━
const OrdersPage = () => {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedOrder, setExpandedOrder] = useState(null);

  const filtered = ORDERS.filter(o => {
    if (filterStatus !== "all" && o.status !== filterStatus) return false;
    if (search && !o.id.toLowerCase().includes(search.toLowerCase()) && !o.company.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalRevenue = ORDERS.filter(o => o.status === "completato").reduce((s, o) => s + o.total, 0);
  const activeOrders = ORDERS.filter(o => ["nuovo", "confermato", "in_lavorazione"].includes(o.status));
  const activeTotal = activeOrders.reduce((s, o) => s + o.total, 0);

  const OrderTimeline = ({ status }) => {
    const steps = ["nuovo", "confermato", "in_lavorazione", "completato"];
    const currentIdx = steps.indexOf(status);
    const isCancelled = status === "annullato";
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginTop: 12 }}>
        {steps.map((step, i) => {
          const isActive = !isCancelled && i <= currentIdx;
          const isCurrent = !isCancelled && i === currentIdx;
          const conf = orderStatusMap[step];
          return (
            <div key={step} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{
                  width: isCurrent ? 28 : 22, height: isCurrent ? 28 : 22, borderRadius: "50%",
                  background: isActive ? conf.color : C.surfaceAlt,
                  border: isCurrent ? `2px solid ${conf.color}` : "none",
                  display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s",
                }}>
                  {isActive && <Check size={isCurrent ? 14 : 10} color="#fff" />}
                </div>
                <span style={{ fontSize: 9, color: isActive ? C.text : C.textDim, fontWeight: isCurrent ? 700 : 500, whiteSpace: "nowrap" }}>{conf.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div style={{ flex: 1, height: 2, background: !isCancelled && i < currentIdx ? conf.color : C.surfaceAlt, margin: "0 6px", marginBottom: 18, borderRadius: 1, transition: "background 0.2s" }} />
              )}
            </div>
          );
        })}
        {isCancelled && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 12, marginBottom: 18 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.dangerDim, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={14} color={C.danger} />
            </div>
            <span style={{ fontSize: 9, color: C.danger, fontWeight: 700 }}>Annullato</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <PageHeader title="Gestione Ordini" desc={`${ORDERS.length} ordini · ${activeOrders.length} in corso · ${fmt(activeTotal)} valore attivo`}>
        <Btn variant="primary" icon={Plus}>Nuovo ordine</Btn>
      </PageHeader>

      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <StatCard label="Ordini totali" value={ORDERS.length} icon={ShoppingCart} color={C.accent} />
        <StatCard label="In corso" value={activeOrders.length} icon={Clock} color={C.warning} />
        <StatCard label="Completati" value={ORDERS.filter(o => o.status === "completato").length} icon={CheckCircle} color={C.success} />
        <StatCard label="Fatturato ordini" value={fmt(totalRevenue)} icon={DollarSign} color={C.blue} />
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Cerca ordini..." />
        <TabBar tabs={[
          { key: "all", label: `Tutti (${ORDERS.length})` },
          { key: "nuovo", label: `Nuovi (${ORDERS.filter(o => o.status === "nuovo").length})` },
          { key: "in_lavorazione", label: `In corso (${ORDERS.filter(o => o.status === "in_lavorazione").length})` },
          { key: "completato", label: `Completati (${ORDERS.filter(o => o.status === "completato").length})` },
        ]} active={filterStatus} onChange={setFilterStatus} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.map(o => {
          const isExpanded = expandedOrder === o.id;
          const daysUntilDelivery = Math.ceil((new Date(o.deliveryDate) - new Date()) / 86400000);
          const isOverdue = daysUntilDelivery < 0 && !["completato", "annullato"].includes(o.status);
          return (
            <Card key={o.id} onClick={() => setExpandedOrder(isExpanded ? null : o.id)}
              style={{ cursor: "pointer", transition: "border-color 0.15s", borderColor: isExpanded ? C.borderLight : C.border }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                {/* Order number & status */}
                <div style={{ minWidth: 140 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: C.accentLight }}>{o.id}</div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{new Date(o.date).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}</div>
                </div>

                {/* Company */}
                <div style={{ flex: 1, minWidth: 150 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{o.company}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{o.contact}</div>
                </div>

                {/* Items count */}
                <div style={{ textAlign: "center", minWidth: 60 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{o.items.length}</div>
                  <div style={{ fontSize: 10, color: C.textDim }}>Articoli</div>
                </div>

                {/* Total */}
                <div style={{ textAlign: "right", minWidth: 100 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{fmt(o.total)}</div>
                  <div style={{ fontSize: 10, color: C.textDim }}>{o.paymentMethod}</div>
                </div>

                {/* Status */}
                <div style={{ minWidth: 120, textAlign: "right" }}>
                  <StatusBadge status={o.status} map={orderStatusMap} />
                  {!["completato", "annullato"].includes(o.status) && (
                    <div style={{ fontSize: 10, color: isOverdue ? C.danger : C.textMuted, marginTop: 4 }}>
                      {isOverdue ? `Scaduto da ${Math.abs(daysUntilDelivery)}g` : `Consegna: ${daysUntilDelivery}g`}
                    </div>
                  )}
                </div>

                <ChevronDown size={16} color={C.textDim} style={{ transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0)" }} />
              </div>

              {/* Progress tracker */}
              <OrderTimeline status={o.status} />

              {/* Expanded details */}
              {isExpanded && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 16 }}>
                    <div style={{ flex: 2, minWidth: 300 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Articoli ordinati</div>
                      <div style={{ background: C.bg, borderRadius: 10, overflow: "hidden" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                          <thead>
                            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                              <th style={{ padding: "8px 12px", textAlign: "left", color: C.textDim, fontWeight: 600 }}>Prodotto</th>
                              <th style={{ padding: "8px 12px", textAlign: "right", color: C.textDim, fontWeight: 600, width: 50 }}>Qtà</th>
                              <th style={{ padding: "8px 12px", textAlign: "right", color: C.textDim, fontWeight: 600, width: 90 }}>Prezzo</th>
                              <th style={{ padding: "8px 12px", textAlign: "right", color: C.textDim, fontWeight: 600, width: 90 }}>Totale</th>
                            </tr>
                          </thead>
                          <tbody>
                            {o.items.map((item, i) => (
                              <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                                <td style={{ padding: "8px 12px", color: C.text, fontWeight: 500 }}>{item.name}</td>
                                <td style={{ padding: "8px 12px", textAlign: "right", color: C.textMuted }}>{item.qty}</td>
                                <td style={{ padding: "8px 12px", textAlign: "right", color: C.textMuted }}>{fmt(item.price)}</td>
                                <td style={{ padding: "8px 12px", textAlign: "right", color: C.text, fontWeight: 600 }}>{fmt(item.qty * item.price)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 12px", borderTop: `1px solid ${C.border}` }}>
                          <div style={{ minWidth: 180 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12 }}>
                              <span style={{ color: C.textMuted }}>Subtotale</span><span style={{ color: C.text }}>{fmt(o.subtotal)}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12 }}>
                              <span style={{ color: C.textMuted }}>IVA 22%</span><span style={{ color: C.text }}>{fmt(o.vat)}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0 0", fontSize: 14, fontWeight: 700, borderTop: `1px solid ${C.border}` }}>
                              <span style={{ color: C.text }}>Totale</span><span style={{ color: C.accent }}>{fmt(o.total)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Dettagli</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {[
                          { label: "Data ordine", value: new Date(o.date).toLocaleDateString("it-IT"), icon: Calendar },
                          { label: "Consegna prevista", value: new Date(o.deliveryDate).toLocaleDateString("it-IT"), icon: Truck },
                          { label: "Pagamento", value: o.paymentMethod, icon: CreditCard },
                        ].map(info => (
                          <div key={info.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: 10, background: C.bg, borderRadius: 8 }}>
                            <info.icon size={14} color={C.textDim} />
                            <div>
                              <div style={{ fontSize: 10, color: C.textDim }}>{info.label}</div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{info.value}</div>
                            </div>
                          </div>
                        ))}
                        {o.notes && (
                          <div style={{ padding: 10, background: C.bg, borderRadius: 8 }}>
                            <div style={{ fontSize: 10, color: C.textDim, marginBottom: 4 }}>Note</div>
                            <div style={{ fontSize: 12, color: C.text, lineHeight: 1.4 }}>{o.notes}</div>
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                        <Btn variant="default" small icon={Download}>PDF</Btn>
                        <Btn variant="default" small icon={Printer}>Stampa</Btn>
                        {o.status === "nuovo" && <Btn variant="success" small icon={Check}>Conferma</Btn>}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && <EmptyState icon={ShoppingCart} title="Nessun ordine trovato" desc="Prova a modificare i filtri di ricerca" />}
    </div>
  );
};

// ━━━ CALENDAR — CALENDARIO APPUNTAMENTI ━━━
const CalendarPage = () => {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 1, 20)); // Feb 20, 2026
  const [viewMode, setViewMode] = useState("settimana");
  const [selectedEvent, setSelectedEvent] = useState(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date(2026, 1, 20);

  // Month helpers
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startPad = (firstDayOfMonth.getDay() + 6) % 7; // Monday start
  const daysInMonth = lastDayOfMonth.getDate();
  const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
  const dayNames = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

  // Week helpers
  const getWeekDates = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(monday);
      dt.setDate(monday.getDate() + i);
      return dt;
    });
  };

  const weekDates = getWeekDates(currentDate);
  const hours = Array.from({ length: 13 }, (_, i) => i + 7); // 7:00 - 19:00

  const getEventsForDate = (dateStr) => CALENDAR_EVENTS.filter(e => e.date === dateStr);
  const formatDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const isSameDay = (d1, d2) => formatDateStr(d1) === formatDateStr(d2);

  const navigate = (dir) => {
    const d = new Date(currentDate);
    if (viewMode === "mese") d.setMonth(d.getMonth() + dir);
    else d.setDate(d.getDate() + dir * 7);
    setCurrentDate(d);
  };

  const todayEvents = getEventsForDate(formatDateStr(today));
  const weekEventCount = weekDates.reduce((s, d) => s + getEventsForDate(formatDateStr(d)).length, 0);

  const EventCard = ({ event, compact }) => {
    const TypeIcon = eventTypeMap[event.type]?.icon || Calendar;
    return (
      <div
        onClick={(e) => { e.stopPropagation(); setSelectedEvent(selectedEvent?.id === event.id ? null : event); }}
        style={{
          padding: compact ? "3px 6px" : "6px 10px",
          borderRadius: 6,
          background: `${event.color}18`,
          borderLeft: `3px solid ${event.color}`,
          cursor: "pointer",
          transition: "all 0.15s",
          marginBottom: compact ? 2 : 4,
          overflow: "hidden",
        }}
        onMouseEnter={e => e.currentTarget.style.background = `${event.color}28`}
        onMouseLeave={e => e.currentTarget.style.background = `${event.color}18`}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {!compact && <TypeIcon size={10} color={event.color} />}
          <span style={{ fontSize: compact ? 10 : 11, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {compact ? event.title.slice(0, 20) : event.title}
          </span>
        </div>
        {!compact && (
          <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>
            {event.time} · {event.duration > 0 ? `${event.duration}min` : "Tutto il giorno"}{event.company ? ` · ${event.company}` : ""}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <PageHeader title="Calendario" desc={`${todayEvents.length} eventi oggi · ${weekEventCount} questa settimana`}>
        <Btn variant="primary" icon={Plus}>Nuovo evento</Btn>
      </PageHeader>

      {/* Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", gap: 4 }}>
            <IconBtn onClick={() => navigate(-1)}><ChevronLeft size={18} /></IconBtn>
            <IconBtn onClick={() => navigate(1)}><ChevronRight size={18} /></IconBtn>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>
            {viewMode === "mese" ? `${monthNames[month]} ${year}` : (
              `${weekDates[0].getDate()} ${monthNames[weekDates[0].getMonth()].slice(0, 3)} — ${weekDates[6].getDate()} ${monthNames[weekDates[6].getMonth()].slice(0, 3)} ${year}`
            )}
          </div>
          <Btn variant="ghost" small onClick={() => setCurrentDate(new Date(2026, 1, 20))}>Oggi</Btn>
        </div>
        <TabBar tabs={[
          { key: "settimana", label: "Settimana" },
          { key: "mese", label: "Mese" },
        ]} active={viewMode} onChange={setViewMode} />
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        {/* Main Calendar */}
        <div style={{ flex: 1 }}>
          {viewMode === "mese" ? (
            <Card style={{ padding: 0, overflow: "hidden" }}>
              {/* Day headers */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: `1px solid ${C.border}` }}>
                {dayNames.map(d => (
                  <div key={d} style={{ padding: "10px 8px", textAlign: "center", fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: 0.5 }}>{d}</div>
                ))}
              </div>
              {/* Day grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
                {/* Padding days */}
                {Array.from({ length: startPad }, (_, i) => (
                  <div key={`pad-${i}`} style={{ minHeight: 100, padding: 6, borderRight: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, background: C.bg }} />
                ))}
                {/* Actual days */}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1;
                  const dateStr = formatDateStr(new Date(year, month, day));
                  const events = getEventsForDate(dateStr);
                  const isToday = isSameDay(new Date(year, month, day), today);
                  const isWeekend = new Date(year, month, day).getDay() === 0 || new Date(year, month, day).getDay() === 6;
                  return (
                    <div key={day} style={{
                      minHeight: 100, padding: 6,
                      borderRight: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`,
                      background: isToday ? `${C.accent}08` : isWeekend ? C.bg : "transparent",
                    }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: "50%",
                        background: isToday ? C.accent : "transparent",
                        color: isToday ? "#fff" : isWeekend ? C.textDim : C.text,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: isToday ? 700 : 500, marginBottom: 4,
                      }}>{day}</div>
                      {events.slice(0, 3).map(e => <EventCard key={e.id} event={e} compact />)}
                      {events.length > 3 && <div style={{ fontSize: 10, color: C.textMuted, textAlign: "center" }}>+{events.length - 3}</div>}
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : (
            /* Week view */
            <Card style={{ padding: 0, overflow: "hidden" }}>
              {/* Day headers */}
              <div style={{ display: "grid", gridTemplateColumns: "50px repeat(7, 1fr)", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ padding: 8 }} />
                {weekDates.map((d, i) => {
                  const isToday2 = isSameDay(d, today);
                  return (
                    <div key={i} style={{ padding: "10px 6px", textAlign: "center", borderLeft: `1px solid ${C.border}`, background: isToday2 ? `${C.accent}08` : "transparent" }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: C.textDim, textTransform: "uppercase" }}>{dayNames[i]}</div>
                      <div style={{
                        width: 30, height: 30, borderRadius: "50%",
                        background: isToday2 ? C.accent : "transparent",
                        color: isToday2 ? "#fff" : C.text,
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14, fontWeight: 700, marginTop: 2,
                      }}>{d.getDate()}</div>
                    </div>
                  );
                })}
              </div>
              {/* Time grid */}
              <div style={{ maxHeight: 520, overflowY: "auto" }}>
                {hours.map(h => (
                  <div key={h} style={{ display: "grid", gridTemplateColumns: "50px repeat(7, 1fr)", minHeight: 48, borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ padding: "4px 6px", fontSize: 10, color: C.textDim, textAlign: "right", borderRight: `1px solid ${C.border}` }}>
                      {String(h).padStart(2, "0")}:00
                    </div>
                    {weekDates.map((d, i) => {
                      const dateStr2 = formatDateStr(d);
                      const hourEvents = CALENDAR_EVENTS.filter(e => e.date === dateStr2 && parseInt(e.time.split(":")[0]) === h);
                      const isToday3 = isSameDay(d, today);
                      return (
                        <div key={i} style={{
                          padding: 2, borderLeft: `1px solid ${C.border}`,
                          background: isToday3 ? `${C.accent}04` : "transparent",
                        }}>
                          {hourEvents.map(e => <EventCard key={e.id} event={e} compact={false} />)}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Side panel — Event details or agenda */}
        <div style={{ width: 280, flexShrink: 0 }}>
          {selectedEvent ? (
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>{selectedEvent.title}</div>
                <IconBtn onClick={() => setSelectedEvent(null)}><X size={16} /></IconBtn>
              </div>
              <div style={{ width: "100%", height: 4, borderRadius: 2, background: selectedEvent.color, marginBottom: 16 }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { icon: Calendar, label: "Data", value: new Date(selectedEvent.date).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" }) },
                  { icon: Clock, label: "Ora", value: `${selectedEvent.time}${selectedEvent.duration > 0 ? ` — ${selectedEvent.duration}min` : ""}` },
                  ...(selectedEvent.contact ? [{ icon: User, label: "Contatto", value: selectedEvent.contact }] : []),
                  ...(selectedEvent.company ? [{ icon: Building, label: "Azienda", value: selectedEvent.company }] : []),
                  { icon: (eventTypeMap[selectedEvent.type]?.icon || Calendar), label: "Tipo", value: eventTypeMap[selectedEvent.type]?.label || selectedEvent.type },
                ].map(info => (
                  <div key={info.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, background: C.bg, borderRadius: 8 }}>
                    <info.icon size={14} color={C.textDim} />
                    <div>
                      <div style={{ fontSize: 10, color: C.textDim }}>{info.label}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{info.value}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
                <Btn variant="default" small icon={Edit2} style={{ flex: 1 }}>Modifica</Btn>
                <Btn variant="danger" small icon={Trash2}>Elimina</Btn>
              </div>
            </Card>
          ) : (
            <Card>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>Prossimi eventi</div>
              {CALENDAR_EVENTS
                .filter(e => e.date >= formatDateStr(today))
                .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
                .slice(0, 8)
                .map(e => {
                  const TypeIcon = eventTypeMap[e.type]?.icon || Calendar;
                  const isToday4 = e.date === formatDateStr(today);
                  return (
                    <div key={e.id}
                      onClick={() => setSelectedEvent(e)}
                      style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: `${e.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <TypeIcon size={16} color={e.color} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</div>
                        <div style={{ fontSize: 11, color: C.textMuted }}>
                          {isToday4 ? "Oggi" : new Date(e.date).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })} · {e.time}
                          {e.company && e.company !== "Interno" && e.company !== "Evento" ? ` · ${e.company}` : ""}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

// ━━━ INVOICES — FATTURAZIONE ━━━
const InvoicesPage = () => {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedInvoice, setExpandedInvoice] = useState(null);

  const filtered = INVOICES.filter(inv => {
    if (filterStatus !== "all" && inv.status !== filterStatus) return false;
    if (search && !inv.id.toLowerCase().includes(search.toLowerCase()) && !inv.company.toLowerCase().includes(search.toLowerCase()) && !inv.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalInvoiced = INVOICES.reduce((s, i) => s + i.total, 0);
  const totalPaid = INVOICES.filter(i => i.status === "pagata").reduce((s, i) => s + i.total, 0);
  const totalPending = INVOICES.filter(i => ["inviata", "parz_pagata"].includes(i.status)).reduce((s, i) => s + (i.total - i.paid), 0);
  const totalOverdue = INVOICES.filter(i => i.status === "scaduta").reduce((s, i) => s + i.total, 0);

  return (
    <div>
      <PageHeader title="Fatture" desc={`${INVOICES.length} fatture emesse · ${fmt(totalPaid)} incassato · ${fmt(totalPending)} in attesa`}>
        <Btn variant="default" icon={Download} small>Esporta</Btn>
        <Btn variant="primary" icon={Plus}>Nuova fattura</Btn>
      </PageHeader>

      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <StatCard label="Totale fatturato" value={fmt(totalInvoiced)} icon={Receipt} color={C.accent} />
        <StatCard label="Incassato" value={fmt(totalPaid)} icon={ArrowDownCircle} color={C.success} />
        <StatCard label="Da incassare" value={fmt(totalPending)} icon={Clock} color={C.warning} />
        <StatCard label="Scaduto" value={fmt(totalOverdue)} icon={AlertTriangle} color={C.danger} />
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Cerca fatture..." />
        <TabBar tabs={[
          { key: "all", label: `Tutte (${INVOICES.length})` },
          { key: "bozza", label: `Bozze (${INVOICES.filter(i => i.status === "bozza").length})` },
          { key: "inviata", label: `Inviate (${INVOICES.filter(i => i.status === "inviata").length})` },
          { key: "pagata", label: `Pagate (${INVOICES.filter(i => i.status === "pagata").length})` },
          { key: "scaduta", label: `Scadute (${INVOICES.filter(i => i.status === "scaduta").length})` },
        ]} active={filterStatus} onChange={setFilterStatus} />
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {["N° Fattura", "Descrizione", "Azienda", "Stato", "Importo", "Saldo", "Emessa", "Scadenza", ""].map(h => (
                <th key={h} style={{ padding: "12px 12px", textAlign: "left", color: C.textDim, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(inv => {
              const isExpanded = expandedInvoice === inv.id;
              const remaining = inv.total - inv.paid;
              const isOverdue = inv.status === "scaduta";
              return (
                <React.Fragment key={inv.id}>
                  <tr style={{ borderBottom: isExpanded ? "none" : `1px solid ${C.border}`, cursor: "pointer", transition: "background 0.15s" }}
                    onClick={() => setExpandedInvoice(isExpanded ? null : inv.id)}
                    onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "12px" }}>
                      <span style={{ fontWeight: 700, color: C.accentLight, fontFamily: "monospace", fontSize: 12 }}>{inv.invoiceNumber}</span>
                    </td>
                    <td style={{ padding: "12px" }}>
                      <div style={{ fontWeight: 600, color: C.text, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.title}</div>
                      <div style={{ fontSize: 11, color: C.textMuted }}>{inv.contact}</div>
                    </td>
                    <td style={{ padding: "12px", color: C.textMuted }}>{inv.company}</td>
                    <td style={{ padding: "12px" }}><StatusBadge status={inv.status} map={invoiceStatusMap} /></td>
                    <td style={{ padding: "12px", fontWeight: 700, color: C.text }}>{fmt(inv.total)}</td>
                    <td style={{ padding: "12px" }}>
                      {inv.status === "pagata" ? (
                        <span style={{ fontSize: 12, color: C.success, fontWeight: 600 }}>Saldato</span>
                      ) : inv.status === "parz_pagata" ? (
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: C.warning }}>{fmt(remaining)}</div>
                          <div style={{ width: 50, height: 3, borderRadius: 2, background: C.surfaceAlt, marginTop: 3 }}>
                            <div style={{ width: `${(inv.paid / inv.total) * 100}%`, height: "100%", borderRadius: 2, background: C.warning }} />
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: isOverdue ? C.danger : C.textMuted, fontWeight: 600 }}>{fmt(remaining)}</span>
                      )}
                    </td>
                    <td style={{ padding: "12px", fontSize: 12, color: C.textMuted }}>{new Date(inv.issueDate).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}</td>
                    <td style={{ padding: "12px", fontSize: 12, color: isOverdue ? C.danger : C.textMuted, fontWeight: isOverdue ? 600 : 400 }}>{new Date(inv.dueDate).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}</td>
                    <td style={{ padding: "12px" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <IconBtn title="Scarica PDF"><Download size={14} /></IconBtn>
                        <IconBtn title="Invia email"><Send size={14} /></IconBtn>
                        <IconBtn title="Altro"><MoreHorizontal size={14} /></IconBtn>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td colSpan={9} style={{ padding: "0 12px 16px", background: C.surfaceAlt }}>
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: 16, background: C.bg, borderRadius: 10, marginTop: 4 }}>
                          {/* Line items */}
                          <div style={{ flex: 2, minWidth: 300 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Voci fattura</div>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                              <thead>
                                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                                  <th style={{ padding: "8px 0", textAlign: "left", color: C.textDim, fontWeight: 600 }}>Descrizione</th>
                                  <th style={{ padding: "8px 0", textAlign: "right", color: C.textDim, fontWeight: 600, width: 50 }}>Qtà</th>
                                  <th style={{ padding: "8px 0", textAlign: "right", color: C.textDim, fontWeight: 600, width: 90 }}>Prezzo</th>
                                  <th style={{ padding: "8px 0", textAlign: "right", color: C.textDim, fontWeight: 600, width: 90 }}>Totale</th>
                                </tr>
                              </thead>
                              <tbody>
                                {inv.items.map((item, i) => (
                                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                                    <td style={{ padding: "8px 0", color: C.text }}>{item.desc}</td>
                                    <td style={{ padding: "8px 0", textAlign: "right", color: C.textMuted }}>{item.qty}</td>
                                    <td style={{ padding: "8px 0", textAlign: "right", color: C.textMuted }}>{fmt(item.price)}</td>
                                    <td style={{ padding: "8px 0", textAlign: "right", color: C.text, fontWeight: 600 }}>{fmt(item.qty * item.price)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                              <div style={{ minWidth: 200 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12 }}>
                                  <span style={{ color: C.textMuted }}>Imponibile</span><span style={{ color: C.text }}>{fmt(inv.subtotal)}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12 }}>
                                  <span style={{ color: C.textMuted }}>IVA 22%</span><span style={{ color: C.text }}>{fmt(inv.vat)}</span>
                                </div>
                                {inv.withholding > 0 && (
                                  <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12 }}>
                                    <span style={{ color: C.textMuted }}>Ritenuta</span><span style={{ color: C.danger }}>-{fmt(inv.withholding)}</span>
                                  </div>
                                )}
                                <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0 0", fontSize: 14, fontWeight: 700, borderTop: `1px solid ${C.border}` }}>
                                  <span style={{ color: C.text }}>Totale</span><span style={{ color: C.accent }}>{fmt(inv.total)}</span>
                                </div>
                                {inv.paid > 0 && inv.paid < inv.total && (
                                  <>
                                    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12 }}>
                                      <span style={{ color: C.success }}>Pagato</span><span style={{ color: C.success }}>{fmt(inv.paid)}</span>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, fontWeight: 700 }}>
                                      <span style={{ color: C.warning }}>Residuo</span><span style={{ color: C.warning }}>{fmt(inv.total - inv.paid)}</span>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          {/* Side info */}
                          <div style={{ flex: 1, minWidth: 200 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Dettagli</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              {[
                                { icon: Hash, label: "Numero", value: inv.invoiceNumber },
                                { icon: Calendar, label: "Emissione", value: new Date(inv.issueDate).toLocaleDateString("it-IT") },
                                { icon: AlertTriangle, label: "Scadenza", value: new Date(inv.dueDate).toLocaleDateString("it-IT") },
                                { icon: CreditCard, label: "Pagamento", value: inv.paymentMethod },
                                ...(inv.paidDate ? [{ icon: CheckCircle, label: "Data incasso", value: new Date(inv.paidDate).toLocaleDateString("it-IT") }] : []),
                                ...(inv.orderId ? [{ icon: ShoppingCart, label: "Ordine", value: inv.orderId }] : []),
                              ].map(info => (
                                <div key={info.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, background: C.surfaceAlt, borderRadius: 8 }}>
                                  <info.icon size={13} color={C.textDim} />
                                  <div>
                                    <div style={{ fontSize: 10, color: C.textDim }}>{info.label}</div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{info.value}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                              <Btn variant="default" small icon={Download}>PDF</Btn>
                              <Btn variant="default" small icon={Printer}>Stampa</Btn>
                              {inv.status === "bozza" && <Btn variant="primary" small icon={Send}>Invia</Btn>}
                              {["inviata", "scaduta", "parz_pagata"].includes(inv.status) && <Btn variant="success" small icon={Banknote}>Registra pagamento</Btn>}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <EmptyState icon={Receipt} title="Nessuna fattura trovata" desc="Prova a modificare i filtri" />}
      </Card>
    </div>
  );
};

// ━━━ EXPENSES — NOTE SPESE ━━━
const ExpensesPage = () => {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [showAdd, setShowAdd] = useState(false);

  const filtered = EXPENSES.filter(e => {
    if (filterStatus !== "all" && e.status !== filterStatus) return false;
    if (filterCategory !== "all" && e.category !== filterCategory) return false;
    if (search && !e.title.toLowerCase().includes(search.toLowerCase()) && !e.vendor.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalExpenses = EXPENSES.reduce((s, e) => s + e.amount, 0);
  const approvedTotal = EXPENSES.filter(e => e.status === "approvata").reduce((s, e) => s + e.amount, 0);
  const pendingTotal = EXPENSES.filter(e => e.status === "in_attesa").reduce((s, e) => s + e.amount, 0);

  const byCategory = EXPENSE_CATEGORIES.map(cat => ({
    name: cat,
    total: EXPENSES.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0),
    count: EXPENSES.filter(e => e.category === cat).length,
  })).filter(c => c.count > 0).sort((a, b) => b.total - a.total);

  const categoryColors = { Software: C.accent, Infrastruttura: C.blue, Rappresentanza: "#F59E0B", Trasferta: "#818CF8", Hardware: C.warning, Formazione: C.success, Marketing: "#EC4899" };

  return (
    <div>
      <PageHeader title="Note Spese" desc={`${EXPENSES.length} spese registrate · ${fmt(totalExpenses)} totale · ${EXPENSES.filter(e => e.status === "in_attesa").length} da approvare`}>
        <Btn variant="default" icon={Download} small>Esporta</Btn>
        <Btn variant="primary" icon={Plus} onClick={() => setShowAdd(!showAdd)}>Nuova spesa</Btn>
      </PageHeader>

      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <StatCard label="Totale spese" value={fmt(totalExpenses)} icon={Wallet} color={C.accent} />
        <StatCard label="Approvate" value={fmt(approvedTotal)} icon={CheckCircle} color={C.success} />
        <StatCard label="In attesa" value={fmt(pendingTotal)} icon={Clock} color={C.warning} />
        <StatCard label="Questo mese" value={fmt(EXPENSES.filter(e => e.date >= "2026-02-01").reduce((s, e) => s + e.amount, 0))} icon={Calendar} color={C.blue} />
      </div>

      {/* Category breakdown */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>Ripartizione per categoria</div>
        <div style={{ display: "flex", gap: 4, height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 14 }}>
          {byCategory.map(cat => (
            <div key={cat.name} style={{ flex: cat.total, background: categoryColors[cat.name] || C.textDim, transition: "flex 0.3s" }} title={`${cat.name}: ${fmt(cat.total)}`} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {byCategory.map(cat => (
            <div key={cat.name} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }} onClick={() => setFilterCategory(filterCategory === cat.name ? "all" : cat.name)}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: categoryColors[cat.name] || C.textDim }} />
              <span style={{ fontSize: 12, color: filterCategory === cat.name ? C.text : C.textMuted, fontWeight: filterCategory === cat.name ? 700 : 500 }}>{cat.name}</span>
              <span style={{ fontSize: 11, color: C.textDim }}>{fmt(cat.total)}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Add expense form */}
      {showAdd && (
        <Card style={{ marginBottom: 20, border: `1px solid ${C.accent}40` }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>Registra nuova spesa</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: 2, minWidth: 200 }}>
              <label style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Descrizione</label>
              <input placeholder="Es. Licenza software, Pranzo cliente..." style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, fontFamily: font, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ minWidth: 120 }}>
              <label style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Importo (€)</label>
              <input type="number" placeholder="0.00" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, fontFamily: font, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ minWidth: 140 }}>
              <label style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Categoria</label>
              <select style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, fontFamily: font, outline: "none" }}>
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ minWidth: 140 }}>
              <label style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Data</label>
              <input type="date" defaultValue="2026-02-20" style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, fontFamily: font, outline: "none", boxSizing: "border-box" }} />
            </div>
            <Btn variant="default" icon={Upload} small>Scontrino</Btn>
            <Btn variant="primary" icon={Check}>Salva</Btn>
            <Btn variant="ghost" icon={X} onClick={() => setShowAdd(false)}>Annulla</Btn>
          </div>
        </Card>
      )}

      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Cerca spese..." />
        <TabBar tabs={[
          { key: "all", label: `Tutte (${EXPENSES.length})` },
          { key: "in_attesa", label: `In attesa (${EXPENSES.filter(e => e.status === "in_attesa").length})` },
          { key: "approvata", label: `Approvate (${EXPENSES.filter(e => e.status === "approvata").length})` },
          { key: "rifiutata", label: `Rifiutate (${EXPENSES.filter(e => e.status === "rifiutata").length})` },
        ]} active={filterStatus} onChange={setFilterStatus} />
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {["Spesa", "Categoria", "Fornitore", "Data", "Utente", "Importo", "Stato", ""].map(h => (
                <th key={h} style={{ padding: "12px", textAlign: "left", color: C.textDim, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => (
              <tr key={e.id} style={{ borderBottom: `1px solid ${C.border}`, transition: "background 0.15s" }}
                onMouseEnter={ev => ev.currentTarget.style.background = C.surfaceAlt}
                onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}>
                <td style={{ padding: "12px" }}>
                  <div style={{ fontWeight: 600, color: C.text }}>{e.title}</div>
                  {e.notes && <div style={{ fontSize: 11, color: C.textDim, marginTop: 2, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.notes}</div>}
                </td>
                <td style={{ padding: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: 3, background: categoryColors[e.category] || C.textDim }} />
                    <span style={{ color: C.textMuted, fontSize: 12 }}>{e.category}</span>
                  </div>
                </td>
                <td style={{ padding: "12px", color: C.textMuted, fontSize: 12 }}>{e.vendor}</td>
                <td style={{ padding: "12px", color: C.textMuted, fontSize: 12 }}>{new Date(e.date).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}</td>
                <td style={{ padding: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Avatar initials={e.user.split(" ").map(w => w[0]).join("")} size={22} color={C.accent} />
                    <span style={{ fontSize: 12, color: C.textMuted }}>{e.user}</span>
                  </div>
                </td>
                <td style={{ padding: "12px", fontWeight: 700, color: C.text }}>{fmt(e.amount)}</td>
                <td style={{ padding: "12px" }}><StatusBadge status={e.status} map={expenseStatusMap} /></td>
                <td style={{ padding: "12px" }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    {e.receipt ? (
                      <IconBtn title="Scontrino allegato"><Paperclip size={14} /></IconBtn>
                    ) : (
                      <IconBtn title="Scontrino mancante" style={{ color: C.danger }}><AlertTriangle size={14} /></IconBtn>
                    )}
                    {e.status === "in_attesa" && (
                      <>
                        <IconBtn title="Approva" style={{ color: C.success }}><Check size={14} /></IconBtn>
                        <IconBtn title="Rifiuta" style={{ color: C.danger }}><X size={14} /></IconBtn>
                      </>
                    )}
                    <IconBtn title="Altro"><MoreHorizontal size={14} /></IconBtn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <EmptyState icon={Wallet} title="Nessuna spesa trovata" desc="Prova a modificare i filtri" />}
      </Card>
    </div>
  );
};

// ━━━ BILLING — GESTIONE ABBONAMENTO ━━━
const BillingPage = () => {
  const [showPlans, setShowPlans] = useState(false);
  const plan = BILLING_PLAN;

  const StorageBar = ({ used, max }) => {
    const pct = (used / max) * 100;
    const color = pct > 80 ? C.danger : pct > 60 ? C.warning : C.accent;
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: C.textMuted }}>Storage utilizzato</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{used} GB / {max} GB</span>
        </div>
        <div style={{ width: "100%", height: 8, borderRadius: 4, background: C.surfaceAlt }}>
          <div style={{ width: `${pct}%`, height: "100%", borderRadius: 4, background: color, transition: "width 0.3s" }} />
        </div>
        <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>{(max - used).toFixed(1)} GB disponibili</div>
      </div>
    );
  };

  return (
    <div>
      <PageHeader title="Gestione Abbonamento" desc="Piano, fatturazione e utilizzo del workspace">
        <Btn variant="default" icon={Download} small>Scarica fatture</Btn>
      </PageHeader>

      {/* Current Plan Card */}
      <Card style={{ marginBottom: 20, border: `1px solid ${C.accent}30`, background: `linear-gradient(135deg, ${C.surface} 0%, ${C.accent}08 100%)` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: `linear-gradient(135deg, ${C.accent}, ${C.accentLight})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Crown size={26} color="#fff" />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.text }}>Piano {plan.name}</h2>
                <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: C.accentDim, color: C.accentLight }}>ATTIVO</span>
              </div>
              <div style={{ fontSize: 14, color: C.textMuted }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: C.text }}>€{plan.price}</span>
                <span style={{ color: C.textDim }}>/utente/mese</span>
                <span style={{ margin: "0 8px", color: C.border }}>·</span>
                <span>{plan.users} utenti × €{plan.price} = <strong style={{ color: C.text }}>€{plan.users * plan.price}/mese</strong></span>
              </div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 6 }}>
                Prossimo rinnovo: <strong style={{ color: C.text }}>{new Date(plan.nextBilling).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}</strong>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="default" onClick={() => setShowPlans(!showPlans)}>Cambia piano</Btn>
            <Btn variant="ghost" icon={X} small style={{ color: C.danger }}>Disdici</Btn>
          </div>
        </div>
      </Card>

      {/* Plans comparison */}
      {showPlans && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
          {PLANS_COMPARISON.map(p => (
            <Card key={p.name} style={{
              border: p.highlight ? `2px solid ${C.accent}` : `1px solid ${C.border}`,
              position: "relative", overflow: "visible",
            }}>
              {p.highlight && (
                <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", padding: "3px 14px", borderRadius: 12, background: C.accent, color: "#fff", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>PIANO ATTUALE</div>
              )}
              <div style={{ textAlign: "center", paddingTop: p.highlight ? 8 : 0 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>{p.name}</div>
                <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>{p.desc}</div>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 36, fontWeight: 800, color: C.text }}>€{p.price}</span>
                  <span style={{ fontSize: 13, color: C.textDim }}>/utente/mese</span>
                </div>
                <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 16 }}>{p.users}</div>
                {p.highlight ? (
                  <Btn variant="default" style={{ width: "100%", justifyContent: "center", opacity: 0.5 }}>Piano corrente</Btn>
                ) : p.price > 29 ? (
                  <Btn variant="primary" style={{ width: "100%", justifyContent: "center" }} icon={ArrowUpCircle}>Upgrade</Btn>
                ) : (
                  <Btn variant="ghost" style={{ width: "100%", justifyContent: "center" }}>Downgrade</Btn>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        {/* Usage */}
        <Card style={{ flex: 1, minWidth: 300 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 16 }}>Utilizzo</div>

          {/* Users */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: C.textMuted }}>Utenti</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{plan.users} / {plan.maxUsers}</span>
            </div>
            <div style={{ width: "100%", height: 8, borderRadius: 4, background: C.surfaceAlt }}>
              <div style={{ width: `${(plan.users / plan.maxUsers) * 100}%`, height: "100%", borderRadius: 4, background: C.accent }} />
            </div>
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>{plan.maxUsers - plan.users} posti disponibili</div>
          </div>

          {/* Storage */}
          <div style={{ marginBottom: 20 }}>
            <StorageBar used={plan.storage.used} max={plan.storage.max} />
          </div>

          {/* Quick stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { label: "Deal attive", value: "8", icon: Briefcase },
              { label: "Contatti", value: "8", icon: Users },
              { label: "Fatture", value: INVOICES.length.toString(), icon: Receipt },
              { label: "Ordini", value: "8", icon: ShoppingCart },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: 10, background: C.bg, borderRadius: 8 }}>
                <s.icon size={14} color={C.textDim} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: C.textDim }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Features */}
        <Card style={{ flex: 1, minWidth: 300 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 16 }}>Funzionalità Piano {plan.name}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {plan.features.map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: i < plan.features.length - 1 ? `1px solid ${C.border}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {f.included ? (
                    <CheckCircle size={14} color={C.success} />
                  ) : (
                    <Lock size={14} color={C.textDim} />
                  )}
                  <span style={{ fontSize: 13, color: f.included ? C.text : C.textDim }}>{f.name}</span>
                </div>
                {f.value && <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>{f.value}</span>}
                {!f.included && <span style={{ fontSize: 10, color: C.accentLight, fontWeight: 600 }}>ENTERPRISE</span>}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Payment Method & Billing History */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* Payment method */}
        <Card style={{ flex: 1, minWidth: 280 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 16 }}>Metodo di pagamento</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 14, background: C.bg, borderRadius: 10, marginBottom: 12 }}>
            <div style={{ width: 48, height: 32, borderRadius: 6, background: `linear-gradient(135deg, #1a1f71, #2d5fdc)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>VISA</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Visa •••• 4242</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>Scade 12/2028</div>
            </div>
            <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: C.successDim, color: C.success }}>PREDEFINITA</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="default" small icon={Edit2}>Modifica</Btn>
            <Btn variant="default" small icon={Plus}>Aggiungi carta</Btn>
          </div>
        </Card>

        {/* Billing history */}
        <Card style={{ flex: 2, minWidth: 400, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 16px 12px", fontSize: 15, fontWeight: 700, color: C.text }}>Storico fatturazione</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {["Data", "Descrizione", "Importo", "Stato", "Metodo", ""].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: C.textDim, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BILLING_HISTORY.map(b => (
                <tr key={b.id} style={{ borderBottom: `1px solid ${C.border}` }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "10px 14px", color: C.textMuted, fontSize: 12 }}>{new Date(b.date).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}</td>
                  <td style={{ padding: "10px 14px", color: C.text, fontWeight: 500 }}>{b.description}</td>
                  <td style={{ padding: "10px 14px", fontWeight: 700, color: C.text }}>{b.amount > 0 ? fmt(b.amount) : "—"}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: C.successDim, color: C.success, textTransform: "uppercase" }}>{b.status}</span>
                  </td>
                  <td style={{ padding: "10px 14px", color: C.textMuted, fontSize: 12 }}>{b.method}</td>
                  <td style={{ padding: "10px 14px" }}>
                    {b.amount > 0 && <IconBtn title="Scarica ricevuta"><Download size={14} /></IconBtn>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
};

// ━━━ TASK BOARD — KANBAN ━━━
const TaskBoardPage = ({ setPage }) => {
  const [tasks, setTasks] = useState(BOARD_TASKS);
  const [draggedTask, setDraggedTask] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [search, setSearch] = useState("");

  const assignees = [...new Set(BOARD_TASKS.map(t => t.assignee))];
  const filtered = tasks.filter(t => {
    if (filterAssignee !== "all" && t.assignee !== filterAssignee) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleDrop = (colId) => {
    if (draggedTask != null) {
      setTasks(ts => ts.map(t => t.id === draggedTask ? { ...t, column: colId } : t));
      setDraggedTask(null);
      setDragOverCol(null);
    }
  };

  const colTasks = (colId) => filtered.filter(t => t.column === colId);

  return (
    <div>
      <PageHeader title="Task Board" desc={`${tasks.length} task · ${tasks.filter(t => t.column === "in_progress").length} in corso · ${tasks.filter(t => t.column === "done").length} completati`}>
        <Btn variant="ghost" small onClick={() => setPage("tasks")} icon={List}>Vista lista</Btn>
        <Btn variant="primary" icon={Plus}>Nuovo task</Btn>
      </PageHeader>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Cerca task..." />
        <div style={{ display: "flex", gap: 4 }}>
          <Btn variant={filterAssignee === "all" ? "primary" : "default"} onClick={() => setFilterAssignee("all")} small>Tutti</Btn>
          {assignees.map(a => (
            <Btn key={a} variant={filterAssignee === a ? "primary" : "default"} onClick={() => setFilterAssignee(a)} small>
              {a}
            </Btn>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 16, minHeight: 500 }}>
        {BOARD_COLUMNS.map(col => {
          const ct = colTasks(col.id);
          return (
            <div key={col.id}
              onDragOver={e => { e.preventDefault(); setDragOverCol(col.id); }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={() => handleDrop(col.id)}
              style={{
                flex: 1, minWidth: 220, maxWidth: 280,
                background: dragOverCol === col.id ? `${col.color}08` : "transparent",
                borderRadius: 14, transition: "background 0.15s",
              }}>
              <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: col.color }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{col.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.textDim, background: C.surfaceAlt, padding: "2px 7px", borderRadius: 6 }}>{ct.length}</span>
                </div>
                <IconBtn><Plus size={14} /></IconBtn>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 6px 6px" }}>
                {ct.map(t => {
                  const daysLeft = Math.ceil((new Date(t.dueDate) - new Date()) / 86400000);
                  return (
                    <div key={t.id} draggable
                      onDragStart={() => setDraggedTask(t.id)}
                      onDragEnd={() => { setDraggedTask(null); setDragOverCol(null); }}
                      style={{
                        background: C.surface, borderRadius: 10, padding: 12,
                        border: `1px solid ${draggedTask === t.id ? C.accent : C.border}`,
                        cursor: "grab", opacity: draggedTask === t.id ? 0.5 : 1, transition: "all 0.15s",
                      }}
                      onMouseEnter={e => { if (draggedTask !== t.id) e.currentTarget.style.borderColor = C.borderLight; }}
                      onMouseLeave={e => { if (draggedTask !== t.id) e.currentTarget.style.borderColor = C.border; }}>
                      <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
                        {t.tags.map(tag => (
                          <span key={tag} style={{ padding: "2px 7px", borderRadius: 5, fontSize: 10, fontWeight: 600, background: C.accentDim, color: C.accentLight }}>{tag}</span>
                        ))}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.3, marginBottom: 10 }}>{t.title}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Avatar initials={t.avatar} size={22} color={C.accent} />
                          <span style={{ fontSize: 11, color: C.textDim }}>{t.assignee}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <StatusBadge status={t.priority} map={priorityMap} />
                          <span style={{ fontSize: 10, color: daysLeft < 0 ? C.danger : daysLeft <= 3 ? C.warning : C.textDim, display: "flex", alignItems: "center", gap: 3 }}>
                            <Calendar size={10} />{daysLeft < 0 ? "Scaduto" : `${daysLeft}g`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {ct.length === 0 && (
                  <div style={{ padding: 20, textAlign: "center", border: `1px dashed ${C.border}`, borderRadius: 10 }}>
                    <div style={{ fontSize: 12, color: C.textDim }}>Trascina qui</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ━━━ DOCUMENTS — FILE MANAGER ━━━
const DocumentsPage = () => {
  const [search, setSearch] = useState("");
  const [activeFolder, setActiveFolder] = useState("Tutti");
  const [viewMode, setViewMode] = useState("grid");
  const [sortBy, setSortBy] = useState("modified");

  const filtered = DOCUMENTS.filter(d => {
    if (activeFolder !== "Tutti" && d.folder !== activeFolder) return false;
    if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === "modified") return new Date(b.modified) - new Date(a.modified);
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "size") return parseFloat(b.size) - parseFloat(a.size);
    return 0;
  });

  const totalSize = DOCUMENTS.reduce((s, d) => {
    const val = parseFloat(d.size);
    return s + (d.size.includes("MB") ? val : d.size.includes("KB") ? val / 1024 : val * 1024);
  }, 0);

  const folderCounts = DOC_FOLDERS.reduce((acc, f) => {
    acc[f] = f === "Tutti" ? DOCUMENTS.length : DOCUMENTS.filter(d => d.folder === f).length;
    return acc;
  }, {});

  return (
    <div>
      <PageHeader title="Documenti" desc={`${DOCUMENTS.length} file · ${totalSize.toFixed(1)} MB totali · ${DOCUMENTS.filter(d => d.starred).length} preferiti`}>
        <Btn variant="default" icon={FolderPlus} small>Nuova cartella</Btn>
        <Btn variant="primary" icon={Upload}>Carica file</Btn>
      </PageHeader>

      <div style={{ display: "flex", gap: 16 }}>
        {/* Sidebar folders */}
        <div style={{ width: 200, flexShrink: 0 }}>
          <Card style={{ padding: 8 }}>
            {DOC_FOLDERS.map(f => (
              <button key={f} onClick={() => setActiveFolder(f)} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                width: "100%", padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                fontFamily: font, fontSize: 13, fontWeight: activeFolder === f ? 700 : 500,
                background: activeFolder === f ? C.accentDim : "transparent",
                color: activeFolder === f ? C.accent : C.textMuted, transition: "all 0.15s",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {activeFolder === f ? <FolderOpen size={15} /> : <Folder size={15} />}
                  <span>{f}</span>
                </div>
                <span style={{ fontSize: 11, color: C.textDim }}>{folderCounts[f]}</span>
              </button>
            ))}
          </Card>

          <Card style={{ marginTop: 12, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, marginBottom: 10 }}>STORAGE</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: C.textMuted }}>Usato</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{totalSize.toFixed(1)} MB / 50 GB</span>
            </div>
            <div style={{ width: "100%", height: 6, borderRadius: 3, background: C.surfaceAlt }}>
              <div style={{ width: `${(totalSize / (50 * 1024)) * 100}%`, height: "100%", borderRadius: 3, background: C.accent, minWidth: 4 }} />
            </div>
          </Card>
        </div>

        {/* Main content */}
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
            <SearchBar value={search} onChange={setSearch} placeholder="Cerca documenti..." />
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 12, fontFamily: font, outline: "none" }}>
              <option value="modified">Ultima modifica</option>
              <option value="name">Nome</option>
              <option value="size">Dimensione</option>
            </select>
            <div style={{ display: "flex", gap: 2, background: C.surfaceAlt, borderRadius: 8, padding: 2 }}>
              <IconBtn active={viewMode === "grid"} onClick={() => setViewMode("grid")}><Grid3X3 size={16} /></IconBtn>
              <IconBtn active={viewMode === "list"} onClick={() => setViewMode("list")}><List size={16} /></IconBtn>
            </div>
          </div>

          {viewMode === "grid" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
              {filtered.map(doc => (
                <Card key={doc.id} style={{ padding: 14, cursor: "pointer", transition: "border-color 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = C.borderLight}
                  onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: `${docTypeColors[doc.type] || C.textDim}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                      {docTypeIcons[doc.type] || "📄"}
                    </div>
                    <div style={{ display: "flex", gap: 2 }}>
                      {doc.starred && <Star size={14} fill={C.warning} color={C.warning} />}
                      <IconBtn><MoreHorizontal size={14} /></IconBtn>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.name}</div>
                  <div style={{ fontSize: 11, color: C.textDim, marginBottom: 8 }}>{doc.type.toUpperCase()} · {doc.size}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: -4 }}>
                      <Avatar initials={doc.owner.split(" ").map(w => w[0]).join("")} size={20} color={C.accent} />
                      {doc.shared.length > 0 && <span style={{ fontSize: 10, color: C.textDim, marginLeft: 4 }}>+{doc.shared.length}</span>}
                    </div>
                    <span style={{ fontSize: 10, color: C.textDim }}>{new Date(doc.modified).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}</span>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {["Nome", "Cartella", "Dimensione", "Proprietario", "Condiviso", "Modificato", ""].map(h => (
                      <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: C.textDim, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(doc => (
                    <tr key={doc.id} style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer", transition: "background 0.15s" }}
                      onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 18 }}>{docTypeIcons[doc.type] || "📄"}</span>
                          <div>
                            <div style={{ fontWeight: 600, color: C.text, display: "flex", alignItems: "center", gap: 4 }}>
                              {doc.name}
                              {doc.starred && <Star size={12} fill={C.warning} color={C.warning} />}
                            </div>
                            <div style={{ fontSize: 10, color: C.textDim }}>{doc.type.toUpperCase()}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "10px 12px", color: C.textMuted, fontSize: 12 }}>{doc.folder}</td>
                      <td style={{ padding: "10px 12px", color: C.textMuted, fontSize: 12 }}>{doc.size}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Avatar initials={doc.owner.split(" ").map(w => w[0]).join("")} size={22} color={C.accent} />
                          <span style={{ fontSize: 12, color: C.textMuted }}>{doc.owner}</span>
                        </div>
                      </td>
                      <td style={{ padding: "10px 12px", color: C.textMuted, fontSize: 12 }}>{doc.shared.length > 0 ? `${doc.shared.length} persone` : "—"}</td>
                      <td style={{ padding: "10px 12px", color: C.textMuted, fontSize: 12 }}>{new Date(doc.modified).toLocaleDateString("it-IT")}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <IconBtn title="Scarica"><Download size={14} /></IconBtn>
                          <IconBtn title="Condividi"><ExternalLink size={14} /></IconBtn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
          {filtered.length === 0 && <EmptyState icon={FileText} title="Nessun documento" desc="Carica il primo file o cambia cartella" />}
        </div>
      </div>
    </div>
  );
};

// ━━━ INBOX — POSTA CONDIVISA ━━━
const InboxPage = () => {
  const [messages, setMessages] = useState(INBOX_MESSAGES);
  const [activeLabel, setActiveLabel] = useState("Tutti");
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [search, setSearch] = useState("");
  const [replyText, setReplyText] = useState("");

  const filtered = messages.filter(m => {
    if (activeLabel === "Non letti") return !m.read;
    if (activeLabel === "Stellati") return m.starred;
    if (activeLabel !== "Tutti" && !m.labels.includes(activeLabel)) return false;
    if (search && !m.subject.toLowerCase().includes(search.toLowerCase()) && !m.from.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const unreadCount = messages.filter(m => !m.read).length;
  const selected = selectedMsg ? messages.find(m => m.id === selectedMsg) : null;

  const toggleRead = (id) => setMessages(ms => ms.map(m => m.id === id ? { ...m, read: true } : m));
  const toggleStar = (id) => setMessages(ms => ms.map(m => m.id === id ? { ...m, starred: !m.starred } : m));

  return (
    <div>
      <PageHeader title="Posta Condivisa" desc={`${messages.length} messaggi · ${unreadCount} non letti`}>
        <Btn variant="primary" icon={Edit2}>Nuova email</Btn>
      </PageHeader>

      <div style={{ display: "flex", gap: 16, minHeight: 600 }}>
        {/* Labels sidebar */}
        <div style={{ width: 180, flexShrink: 0 }}>
          <Card style={{ padding: 8 }}>
            {INBOX_LABELS.map(label => {
              const count = label === "Tutti" ? messages.length : label === "Non letti" ? unreadCount : label === "Stellati" ? messages.filter(m => m.starred).length : messages.filter(m => m.labels.includes(label)).length;
              return (
                <button key={label} onClick={() => { setActiveLabel(label); setSelectedMsg(null); }} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
                  padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: font,
                  fontSize: 13, fontWeight: activeLabel === label ? 700 : 500,
                  background: activeLabel === label ? C.accentDim : "transparent",
                  color: activeLabel === label ? C.accent : C.textMuted, transition: "all 0.15s",
                }}>
                  <span>{label}</span>
                  {count > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: C.textDim, background: activeLabel === label ? "transparent" : C.surfaceAlt, padding: "1px 6px", borderRadius: 4 }}>{count}</span>}
                </button>
              );
            })}
          </Card>
        </div>

        {/* Message list */}
        <div style={{ width: selected ? 340 : "100%", flexShrink: 0, display: "flex", flexDirection: "column", transition: "width 0.2s" }}>
          <div style={{ marginBottom: 12 }}>
            <SearchBar value={search} onChange={setSearch} placeholder="Cerca messaggi..." />
          </div>
          <Card style={{ padding: 0, flex: 1, overflow: "auto" }}>
            {filtered.map(m => (
              <div key={m.id} onClick={() => { setSelectedMsg(m.id); toggleRead(m.id); }}
                style={{
                  display: "flex", gap: 12, padding: "14px 16px",
                  borderBottom: `1px solid ${C.border}`, cursor: "pointer",
                  background: selectedMsg === m.id ? C.accentDim : !m.read ? `${C.accent}05` : "transparent",
                  borderLeft: !m.read ? `3px solid ${C.accent}` : "3px solid transparent",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => { if (selectedMsg !== m.id) e.currentTarget.style.background = C.surfaceAlt; }}
                onMouseLeave={e => { if (selectedMsg !== m.id) e.currentTarget.style.background = !m.read ? `${C.accent}05` : "transparent"; }}>
                <Avatar initials={m.from.split(" ").map(w => w[0]).join("")} size={36} color={m.read ? C.textDim : C.accent} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: m.read ? 500 : 700, color: C.text }}>{m.from}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {m.hasAttachment && <Paperclip size={11} color={C.textDim} />}
                      <span style={{ fontSize: 11, color: C.textDim }}>{m.date.split(" ")[1] || new Date(m.date).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: m.read ? 400 : 600, color: m.read ? C.textMuted : C.text, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.subject}</div>
                  <div style={{ fontSize: 12, color: C.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.preview}</div>
                  <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                    {m.labels.slice(0, 2).map(l => (
                      <span key={l} style={{ padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: l === "Urgente" ? C.dangerDim : l === "Importante" ? C.warningDim : C.surfaceAlt, color: l === "Urgente" ? C.danger : l === "Importante" ? C.warning : C.textMuted }}>{l}</span>
                    ))}
                    {m.thread > 1 && <span style={{ fontSize: 10, color: C.textDim, display: "flex", alignItems: "center", gap: 2 }}><MessageSquare size={10} />{m.thread}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, paddingTop: 2 }}>
                  <div onClick={e => { e.stopPropagation(); toggleStar(m.id); }} style={{ cursor: "pointer" }}>
                    {m.starred ? <Star size={14} fill={C.warning} color={C.warning} /> : <Star size={14} color={C.textDim} />}
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <EmptyState icon={Inbox} title="Nessun messaggio" desc="La casella è vuota" />}
          </Card>
        </div>

        {/* Message detail */}
        {selected && (
          <Card style={{ flex: 1, minWidth: 300, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>{selected.subject}</h3>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {selected.labels.map(l => (
                    <span key={l} style={{ padding: "2px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600, background: l === "Urgente" ? C.dangerDim : l === "Importante" ? C.warningDim : C.surfaceAlt, color: l === "Urgente" ? C.danger : l === "Importante" ? C.warning : C.textMuted }}>{l}</span>
                  ))}
                </div>
              </div>
              <IconBtn onClick={() => setSelectedMsg(null)}><X size={18} /></IconBtn>
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "14px 0", borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
              <Avatar initials={selected.from.split(" ").map(w => w[0]).join("")} size={40} color={C.accent} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{selected.from}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{selected.fromEmail} · {selected.company}</div>
              </div>
              <span style={{ fontSize: 12, color: C.textDim }}>{selected.date}</span>
            </div>

            <div style={{ flex: 1, fontSize: 14, color: C.text, lineHeight: 1.7, marginBottom: 16, padding: "0 4px" }}>
              {selected.preview}
              <div style={{ marginTop: 16, color: C.textMuted, fontSize: 13, fontStyle: "italic" }}>
                [Anteprima del messaggio — clicca per caricare il contenuto completo]
              </div>
            </div>

            {selected.hasAttachment && (
              <div style={{ padding: 12, background: C.bg, borderRadius: 10, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                <Paperclip size={16} color={C.textDim} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>Allegato</div>
                  <div style={{ fontSize: 11, color: C.textDim }}>1 file allegato</div>
                </div>
                <Btn variant="default" small icon={Download}>Scarica</Btn>
              </div>
            )}

            {/* Reply box */}
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <Btn variant="default" small icon={Reply}>Rispondi</Btn>
                <Btn variant="default" small icon={ReplyAll}>Rispondi a tutti</Btn>
                <Btn variant="default" small icon={Forward}>Inoltra</Btn>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <input value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Scrivi una risposta rapida..." style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, fontFamily: font, outline: "none" }} />
                <Btn variant="primary" icon={Send}>Invia</Btn>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

// ━━━ EMAIL TEMPLATES ━━━
const EmailTemplatesPage = () => {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("Tutti");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);

  const filtered = EMAIL_TEMPLATES.filter(t => {
    if (filterCategory !== "Tutti" && t.category !== filterCategory) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.subject.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const selected = selectedTemplate ? EMAIL_TEMPLATES.find(t => t.id === selectedTemplate) : null;

  return (
    <div>
      <PageHeader title="Template Email" desc={`${EMAIL_TEMPLATES.length} template · ${EMAIL_TEMPLATES.reduce((s, t) => s + t.usageCount, 0)} invii totali`}>
        <Btn variant="primary" icon={Plus}>Nuovo template</Btn>
      </PageHeader>

      <div style={{ display: "flex", gap: 16 }}>
        {/* Template list */}
        <div style={{ width: selected ? 380 : "100%", flexShrink: 0, transition: "width 0.2s" }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
            <SearchBar value={search} onChange={setSearch} placeholder="Cerca template..." />
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
            {TEMPLATE_CATEGORIES.map(cat => (
              <Btn key={cat} variant={filterCategory === cat ? "primary" : "default"} onClick={() => setFilterCategory(cat)} small>{cat}</Btn>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr" : "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
            {filtered.map(t => (
              <Card key={t.id} onClick={() => setSelectedTemplate(t.id)}
                style={{
                  cursor: "pointer", transition: "border-color 0.15s",
                  borderColor: selectedTemplate === t.id ? C.accent : C.border,
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.borderLight}
                onMouseLeave={e => { e.currentTarget.style.borderColor = selectedTemplate === t.id ? C.accent : C.border; }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 3 }}>{t.name}</div>
                    <span style={{ padding: "2px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600, background: C.accentDim, color: C.accentLight }}>{t.category}</span>
                  </div>
                  <IconBtn><MoreHorizontal size={14} /></IconBtn>
                </div>
                <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
                  <Mail size={11} /> {t.subject}
                </div>
                <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.4, marginBottom: 10, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{t.body.replace(/\n/g, " ")}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0 0", borderTop: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={{ fontSize: 11, color: C.textDim, display: "flex", alignItems: "center", gap: 3 }}>
                      <Send size={10} /> {t.usageCount} invii
                    </span>
                    <span style={{ fontSize: 11, color: C.textDim }}>Ultimo: {new Date(t.lastUsed).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}</span>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {t.variables.slice(0, 3).map(v => (
                      <span key={v} style={{ padding: "1px 5px", borderRadius: 3, fontSize: 9, fontWeight: 600, background: C.surfaceAlt, color: C.textDim, fontFamily: "monospace" }}>{`{${v}}`}</span>
                    ))}
                    {t.variables.length > 3 && <span style={{ fontSize: 9, color: C.textDim }}>+{t.variables.length - 3}</span>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
          {filtered.length === 0 && <EmptyState icon={Mail} title="Nessun template trovato" desc="Prova a cambiare categoria o ricerca" />}
        </div>

        {/* Template detail / editor */}
        {selected && (
          <Card style={{ flex: 1, minWidth: 340, position: "sticky", top: 0, alignSelf: "flex-start" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700, color: C.text }}>{selected.name}</h3>
                <span style={{ padding: "2px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600, background: C.accentDim, color: C.accentLight }}>{selected.category}</span>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <TabBar tabs={[{ key: false, label: "Modifica" }, { key: true, label: "Anteprima" }]} active={previewMode} onChange={setPreviewMode} />
                <IconBtn onClick={() => setSelectedTemplate(null)}><X size={16} /></IconBtn>
              </div>
            </div>

            {/* Subject */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Oggetto</label>
              <div style={{ padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, fontSize: 13, color: C.text }}>
                {previewMode ? selected.subject.replace(/\{(\w+)\}/g, (_, v) => `[${v}]`) : selected.subject}
              </div>
            </div>

            {/* Body */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Corpo</label>
              {!previewMode && (
                <div style={{ display: "flex", gap: 2, marginBottom: 8, padding: 4, background: C.surfaceAlt, borderRadius: 8 }}>
                  {[Bold, Italic, Underline, AlignLeft, Link2, Code].map((Icon, i) => (
                    <IconBtn key={i}><Icon size={14} /></IconBtn>
                  ))}
                </div>
              )}
              <div style={{
                padding: 14, borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg,
                fontSize: 13, color: C.text, lineHeight: 1.7, whiteSpace: "pre-wrap", minHeight: 200,
                maxHeight: 320, overflowY: "auto",
              }}>
                {previewMode
                  ? selected.body.replace(/\{(\w+)\}/g, (_, v) => `[${v}]`)
                  : selected.body.split(/(\{[^}]+\})/).map((part, i) =>
                      part.match(/^\{.*\}$/)
                        ? <span key={i} style={{ padding: "1px 4px", borderRadius: 3, background: C.accentDim, color: C.accentLight, fontFamily: "monospace", fontSize: 12, fontWeight: 600 }}>{part}</span>
                        : part
                    )
                }
              </div>
            </div>

            {/* Variables */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Variabili</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {selected.variables.map(v => (
                  <span key={v} style={{ padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: C.accentDim, color: C.accentLight, fontFamily: "monospace", cursor: "pointer" }}>{`{${v}}`}</span>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, padding: "14px 0 0", borderTop: `1px solid ${C.border}` }}>
              <Btn variant="primary" icon={Send} style={{ flex: 1, justifyContent: "center" }}>Usa template</Btn>
              <Btn variant="default" icon={Copy}>Duplica</Btn>
              <Btn variant="default" icon={Edit2}>Modifica</Btn>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

// ━━━ INVENTORY — MAGAZZINO ━━━
const InventoryPage = () => {
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedItem, setExpandedItem] = useState(null);

  const filtered = INVENTORY.filter(i => {
    if (filterCat !== "all" && i.category !== filterCat) return false;
    if (filterStatus !== "all" && i.status !== filterStatus) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase()) && !i.sku.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalValue = INVENTORY.reduce((s, i) => s + i.qty * i.value, 0);
  const alertCount = INVENTORY.filter(i => ["sottoscorta", "critico", "esaurito"].includes(i.status)).length;

  return (
    <div>
      <PageHeader title="Magazzino" desc={`${INVENTORY.length} articoli · ${alertCount} alert · ${fmt(totalValue)} valore totale`}>
        <Btn variant="default" icon={Download} small>Esporta</Btn>
        <Btn variant="primary" icon={Plus}>Nuovo articolo</Btn>
      </PageHeader>

      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <StatCard label="Articoli totali" value={INVENTORY.length} icon={Package} color={C.accent} />
        <StatCard label="Valore magazzino" value={fmt(totalValue)} icon={DollarSign} color={C.blue} />
        <StatCard label="Sottoscorta" value={INVENTORY.filter(i => i.status === "sottoscorta").length} icon={AlertTriangle} color={C.warning} />
        <StatCard label="Esauriti" value={INVENTORY.filter(i => ["critico", "esaurito"].includes(i.status)).length} icon={PackageX} color={C.danger} />
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Cerca per nome o SKU..." />
        <TabBar tabs={[
          { key: "all", label: `Tutti (${INVENTORY.length})` },
          { key: "ok", label: `OK (${INVENTORY.filter(i => i.status === "ok").length})` },
          { key: "sottoscorta", label: `Sottoscorta (${INVENTORY.filter(i => i.status === "sottoscorta").length})` },
          { key: "critico", label: `Critico (${INVENTORY.filter(i => ["critico", "esaurito"].includes(i.status)).length})` },
        ]} active={filterStatus} onChange={setFilterStatus} />
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        <Btn variant={filterCat === "all" ? "primary" : "default"} onClick={() => setFilterCat("all")} small>Tutte</Btn>
        {INVENTORY_CATEGORIES.map(c => (
          <Btn key={c} variant={filterCat === c ? "primary" : "default"} onClick={() => setFilterCat(c)} small>{c}</Btn>
        ))}
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {["Articolo", "SKU", "Ubicazione", "Giacenza", "Min/Max", "Livello", "Valore", "Stato", ""].map(h => (
                <th key={h} style={{ padding: "12px", textAlign: "left", color: C.textDim, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => {
              const pct = Math.min((item.qty / item.maxQty) * 100, 100);
              const barColor = item.status === "ok" ? C.success : item.status === "sottoscorta" ? C.warning : C.danger;
              const isExpanded = expandedItem === item.id;
              return (
                <React.Fragment key={item.id}>
                  <tr style={{ borderBottom: isExpanded ? "none" : `1px solid ${C.border}`, cursor: "pointer", transition: "background 0.15s" }}
                    onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                    onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "12px" }}>
                      <div style={{ fontWeight: 600, color: C.text }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: C.textDim }}>{item.category}</div>
                    </td>
                    <td style={{ padding: "12px", fontFamily: "monospace", fontSize: 11, color: C.textDim }}>{item.sku}</td>
                    <td style={{ padding: "12px", fontSize: 12, color: C.textMuted }}>{item.location}</td>
                    <td style={{ padding: "12px" }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: item.qty === 0 ? C.danger : C.text }}>{item.qty}</span>
                      <span style={{ fontSize: 11, color: C.textDim }}> {item.unit}</span>
                    </td>
                    <td style={{ padding: "12px", fontSize: 12, color: C.textDim }}>{item.minQty} / {item.maxQty}</td>
                    <td style={{ padding: "12px", width: 100 }}>
                      <div style={{ width: "100%", height: 6, borderRadius: 3, background: C.surfaceAlt }}>
                        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: barColor, transition: "width 0.3s", minWidth: item.qty > 0 ? 4 : 0 }} />
                      </div>
                      <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>{pct.toFixed(0)}%</div>
                    </td>
                    <td style={{ padding: "12px", fontWeight: 600, color: C.text }}>{fmt(item.qty * item.value)}</td>
                    <td style={{ padding: "12px" }}><StatusBadge status={item.status} map={inventoryStatusMap} /></td>
                    <td style={{ padding: "12px" }}>
                      <ChevronDown size={14} color={C.textDim} style={{ transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0)" }} />
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td colSpan={9} style={{ padding: "0 12px 14px", background: C.surfaceAlt }}>
                        <div style={{ display: "flex", gap: 12, padding: 14, background: C.bg, borderRadius: 10, marginTop: 4, flexWrap: "wrap" }}>
                          {[
                            { label: "Prezzo unitario", value: fmt(item.value), icon: DollarSign },
                            { label: "Ultimo movimento", value: new Date(item.lastMovement).toLocaleDateString("it-IT"), icon: Calendar },
                            { label: "Scorta minima", value: `${item.minQty} ${item.unit}`, icon: AlertTriangle },
                            { label: "Capienza max", value: `${item.maxQty} ${item.unit}`, icon: Package },
                          ].map(info => (
                            <div key={info.label} style={{ flex: 1, minWidth: 140, display: "flex", alignItems: "center", gap: 8, padding: 10, background: C.surfaceAlt, borderRadius: 8 }}>
                              <info.icon size={14} color={C.textDim} />
                              <div>
                                <div style={{ fontSize: 10, color: C.textDim }}>{info.label}</div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{info.value}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: "flex", gap: 6, marginTop: 10, paddingLeft: 14 }}>
                          <Btn variant="default" small icon={ArrowDownCircle}>Carico</Btn>
                          <Btn variant="default" small icon={ArrowUpCircle}>Scarico</Btn>
                          <Btn variant="default" small icon={RotateCw}>Rettifica</Btn>
                          <Btn variant="default" small icon={Edit2}>Modifica</Btn>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <EmptyState icon={Warehouse} title="Nessun articolo trovato" desc="Modifica i filtri di ricerca" />}
      </Card>
    </div>
  );
};

// ━━━ LOGISTICS — SPEDIZIONI ━━━
const LogisticsPage = () => {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedShipment, setSelectedShipment] = useState(null);

  const filtered = SHIPMENTS.filter(s => {
    if (filterStatus !== "all" && s.status !== filterStatus) return false;
    if (search && !s.id.toLowerCase().includes(search.toLowerCase()) && !s.company.toLowerCase().includes(search.toLowerCase()) && !s.trackingCode.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const activeShipments = SHIPMENTS.filter(s => ["in_preparazione", "spedito", "in_transito"].includes(s.status));
  const selected = selectedShipment ? SHIPMENTS.find(s => s.id === selectedShipment) : null;

  const ShipmentTimeline = ({ status }) => {
    const steps = ["in_preparazione", "spedito", "in_transito", "consegnato"];
    const idx = steps.indexOf(status);
    const hasProblem = status === "problema";
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 0, margin: "12px 0" }}>
        {steps.map((step, i) => {
          const isActive = !hasProblem && i <= idx;
          const isCurrent = !hasProblem && i === idx;
          const conf = shipmentStatusMap[step];
          return (
            <div key={step} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{
                  width: isCurrent ? 26 : 20, height: isCurrent ? 26 : 20, borderRadius: "50%",
                  background: isActive ? conf.color : C.surfaceAlt,
                  display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s",
                }}>
                  {isActive && <Check size={isCurrent ? 12 : 10} color="#fff" />}
                </div>
                <span style={{ fontSize: 9, color: isActive ? C.text : C.textDim, fontWeight: isCurrent ? 700 : 500, whiteSpace: "nowrap" }}>{conf.label}</span>
              </div>
              {i < steps.length - 1 && <div style={{ flex: 1, height: 2, background: !hasProblem && i < idx ? conf.color : C.surfaceAlt, margin: "0 4px", marginBottom: 18, borderRadius: 1 }} />}
            </div>
          );
        })}
        {hasProblem && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 8, marginBottom: 18 }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: C.dangerDim, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AlertOctagon size={12} color={C.danger} />
            </div>
            <span style={{ fontSize: 9, color: C.danger, fontWeight: 700 }}>Problema</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <PageHeader title="Spedizioni & Logistica" desc={`${SHIPMENTS.length} spedizioni · ${activeShipments.length} attive · ${SHIPMENTS.filter(s => s.status === "problema").length} problemi`}>
        <Btn variant="primary" icon={Plus}>Nuova spedizione</Btn>
      </PageHeader>

      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <StatCard label="Totale spedizioni" value={SHIPMENTS.length} icon={Truck} color={C.accent} />
        <StatCard label="In transito" value={SHIPMENTS.filter(s => s.status === "in_transito").length} icon={Package} color={C.warning} />
        <StatCard label="Consegnate" value={SHIPMENTS.filter(s => s.status === "consegnato").length} icon={PackageCheck} color={C.success} />
        <StatCard label="Problemi" value={SHIPMENTS.filter(s => s.status === "problema").length} icon={AlertOctagon} color={C.danger} />
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Cerca per ID, azienda o tracking..." />
        <TabBar tabs={[
          { key: "all", label: `Tutte (${SHIPMENTS.length})` },
          { key: "in_preparazione", label: `Preparazione (${SHIPMENTS.filter(s => s.status === "in_preparazione").length})` },
          { key: "in_transito", label: `In transito (${SHIPMENTS.filter(s => s.status === "in_transito").length})` },
          { key: "consegnato", label: `Consegnate (${SHIPMENTS.filter(s => s.status === "consegnato").length})` },
        ]} active={filterStatus} onChange={setFilterStatus} />
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map(s => {
              const daysUntil = s.estDelivery ? Math.ceil((new Date(s.estDelivery) - new Date()) / 86400000) : null;
              return (
                <Card key={s.id} onClick={() => setSelectedShipment(s.id)}
                  style={{ cursor: "pointer", borderColor: selectedShipment === s.id ? C.accent : C.border, transition: "border-color 0.15s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: C.accentLight }}>{s.id}</span>
                        <StatusBadge status={s.status} map={shipmentStatusMap} />
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginTop: 4 }}>{s.company}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, color: C.textMuted }}>{s.carrier}</div>
                      <div style={{ fontSize: 11, fontFamily: "monospace", color: C.textDim }}>{s.trackingCode.slice(0, 14)}...</div>
                    </div>
                  </div>
                  <ShipmentTimeline status={s.status} />
                  <div style={{ display: "flex", gap: 16, fontSize: 12, color: C.textDim }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={11} />{s.destination.split(",").pop().trim()}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Package size={11} />{s.items} articoli</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Box size={11} />{s.weight}</span>
                    {daysUntil != null && !["consegnato"].includes(s.status) && (
                      <span style={{ color: daysUntil < 0 ? C.danger : daysUntil <= 1 ? C.warning : C.textDim }}>
                        {daysUntil < 0 ? `In ritardo ${Math.abs(daysUntil)}g` : `Consegna in ${daysUntil}g`}
                      </span>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
          {filtered.length === 0 && <EmptyState icon={Truck} title="Nessuna spedizione trovata" desc="Modifica i filtri" />}
        </div>

        {/* Detail panel */}
        {selected && (
          <Card style={{ width: 300, flexShrink: 0, alignSelf: "flex-start", position: "sticky", top: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{selected.id}</div>
                <StatusBadge status={selected.status} map={shipmentStatusMap} />
              </div>
              <IconBtn onClick={() => setSelectedShipment(null)}><X size={16} /></IconBtn>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { icon: Building, label: "Destinatario", value: selected.company },
                { icon: MapPin, label: "Indirizzo", value: selected.destination },
                { icon: Truck, label: "Corriere", value: selected.carrier },
                { icon: Hash, label: "Tracking", value: selected.trackingCode },
                ...(selected.orderId ? [{ icon: ShoppingCart, label: "Ordine", value: selected.orderId }] : []),
                { icon: Calendar, label: "Consegna stimata", value: selected.estDelivery ? new Date(selected.estDelivery).toLocaleDateString("it-IT") : "—" },
                { icon: Package, label: "Colli", value: `${selected.items} articoli · ${selected.weight}` },
              ].map(info => (
                <div key={info.label} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: 8, background: C.bg, borderRadius: 8 }}>
                  <info.icon size={13} color={C.textDim} style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 10, color: C.textDim }}>{info.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text, wordBreak: "break-all" }}>{info.value}</div>
                  </div>
                </div>
              ))}
              {selected.notes && (
                <div style={{ padding: 8, background: C.bg, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: C.textDim }}>Note</div>
                  <div style={{ fontSize: 12, color: C.text }}>{selected.notes}</div>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
              <Btn variant="default" small icon={ExternalLink}>Traccia</Btn>
              <Btn variant="default" small icon={Printer}>Etichetta</Btn>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

// ━━━ SUPPLIERS — FORNITORI ━━━
const SuppliersPage = () => {
  const [search, setSearch] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  const filtered = SUPPLIERS.filter(s => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.category.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalSpent = SUPPLIERS.reduce((s, sup) => s + sup.totalSpent, 0);
  const selected = selectedSupplier ? SUPPLIERS.find(s => s.id === selectedSupplier) : null;

  const RatingStars = ({ rating }) => (
    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} size={12} fill={n <= Math.round(rating) ? C.warning : "transparent"} color={n <= Math.round(rating) ? C.warning : C.textDim} />
      ))}
      <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 4 }}>{rating}</span>
    </div>
  );

  return (
    <div>
      <PageHeader title="Fornitori" desc={`${SUPPLIERS.length} fornitori · ${SUPPLIERS.filter(s => s.status === "attivo").length} attivi · ${fmt(totalSpent)} speso totale`}>
        <Btn variant="primary" icon={Plus}>Nuovo fornitore</Btn>
      </PageHeader>

      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <StatCard label="Fornitori attivi" value={SUPPLIERS.filter(s => s.status === "attivo").length} icon={Building} color={C.accent} />
        <StatCard label="Ordini totali" value={SUPPLIERS.reduce((s, sup) => s + sup.totalOrders, 0)} icon={ShoppingCart} color={C.blue} />
        <StatCard label="Spesa totale" value={fmt(totalSpent)} icon={DollarSign} color={C.warning} />
        <StatCard label="Valutazione media" value={(SUPPLIERS.reduce((s, sup) => s + sup.rating, 0) / SUPPLIERS.length).toFixed(1)} icon={Star} color={C.success} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Cerca fornitori per nome o categoria..." />
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr" : "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
            {filtered.map(s => (
              <Card key={s.id} onClick={() => setSelectedSupplier(s.id)}
                style={{ cursor: "pointer", borderColor: selectedSupplier === s.id ? C.accent : C.border, transition: "border-color 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.borderLight}
                onMouseLeave={e => { e.currentTarget.style.borderColor = selectedSupplier === s.id ? C.accent : C.border; }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 2 }}>{s.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ padding: "2px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600, background: C.accentDim, color: C.accentLight }}>{s.category}</span>
                      <StatusBadge status={s.status} map={supplierStatusMap} />
                    </div>
                  </div>
                  <RatingStars rating={s.rating} />
                </div>
                <div style={{ display: "flex", gap: 16, marginBottom: 10, fontSize: 12, color: C.textMuted }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><User size={11} />{s.contact}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={11} />{s.city}</span>
                </div>
                <div style={{ display: "flex", gap: 12, padding: "10px 0 0", borderTop: `1px solid ${C.border}` }}>
                  {[
                    { label: "Ordini", value: s.totalOrders },
                    { label: "Speso", value: fmt(s.totalSpent) },
                    { label: "Termini", value: s.paymentTerms },
                  ].map(stat => (
                    <div key={stat.label} style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: C.textDim }}>{stat.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{stat.value}</div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
          {filtered.length === 0 && <EmptyState icon={Building} title="Nessun fornitore trovato" desc="Modifica la ricerca" />}
        </div>

        {selected && (
          <Card style={{ width: 300, flexShrink: 0, alignSelf: "flex-start", position: "sticky", top: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{selected.name}</div>
                <StatusBadge status={selected.status} map={supplierStatusMap} />
              </div>
              <IconBtn onClick={() => setSelectedSupplier(null)}><X size={16} /></IconBtn>
            </div>
            <RatingStars rating={selected.rating} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
              {[
                { icon: User, label: "Contatto", value: selected.contact },
                { icon: Mail, label: "Email", value: selected.email },
                { icon: Phone, label: "Telefono", value: selected.phone },
                { icon: MapPin, label: "Città", value: selected.city },
                { icon: Tag, label: "Categoria", value: selected.category },
                { icon: CreditCard, label: "Termini pag.", value: selected.paymentTerms },
                { icon: Calendar, label: "Ultimo ordine", value: new Date(selected.lastOrder).toLocaleDateString("it-IT") },
                { icon: ShoppingCart, label: "Totale ordini", value: selected.totalOrders.toString() },
                { icon: DollarSign, label: "Speso totale", value: fmt(selected.totalSpent) },
              ].map(info => (
                <div key={info.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, background: C.bg, borderRadius: 8 }}>
                  <info.icon size={13} color={C.textDim} />
                  <div>
                    <div style={{ fontSize: 10, color: C.textDim }}>{info.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{info.value}</div>
                  </div>
                </div>
              ))}
              {selected.notes && (
                <div style={{ padding: 8, background: C.bg, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: C.textDim }}>Note</div>
                  <div style={{ fontSize: 12, color: C.text, lineHeight: 1.4 }}>{selected.notes}</div>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
              <Btn variant="default" small icon={Mail}>Email</Btn>
              <Btn variant="default" small icon={Phone}>Chiama</Btn>
              <Btn variant="default" small icon={ShoppingCart}>Ordine</Btn>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

// ━━━ TIMESHEET — FOGLIO ORE ━━━
const TimesheetPage = () => {
  const [filterUser, setFilterUser] = useState("all");
  const [filterProject, setFilterProject] = useState("all");
  const [filterDate, setFilterDate] = useState("all");
  const [isTracking, setIsTracking] = useState(false);
  const [trackingSeconds, setTrackingSeconds] = useState(0);

  const users = [...new Set(TIMESHEET_ENTRIES.map(e => e.user))];
  const filtered = TIMESHEET_ENTRIES.filter(e => {
    if (filterUser !== "all" && e.user !== filterUser) return false;
    if (filterProject !== "all" && e.project !== filterProject) return false;
    if (filterDate === "today" && e.date !== "2026-02-20") return false;
    if (filterDate === "yesterday" && e.date !== "2026-02-19") return false;
    return true;
  });

  const totalHours = filtered.reduce((s, e) => s + e.hours, 0);
  const billableHours = filtered.filter(e => e.billable).reduce((s, e) => s + e.hours, 0);
  const billableRevenue = filtered.filter(e => e.billable).reduce((s, e) => s + e.hours * e.rate, 0);
  const avgRate = billableHours > 0 ? billableRevenue / billableHours : 0;

  // Group by user for summary
  const userSummary = users.map(u => {
    const entries = filtered.filter(e => e.user === u);
    const h = entries.reduce((s, e) => s + e.hours, 0);
    const bh = entries.filter(e => e.billable).reduce((s, e) => s + e.hours, 0);
    const rev = entries.filter(e => e.billable).reduce((s, e) => s + e.hours * e.rate, 0);
    return { user: u, avatar: entries[0]?.avatar || "??", hours: h, billable: bh, revenue: rev };
  });

  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div>
      <PageHeader title="Foglio Ore" desc={`${totalHours}h totali · ${billableHours}h fatturabili · ${fmt(billableRevenue)} ricavo`}>
        <Btn variant="default" icon={Download} small>Esporta</Btn>
        <Btn variant="primary" icon={Plus}>Nuova voce</Btn>
      </PageHeader>

      {/* Timer widget */}
      <Card style={{ marginBottom: 20, background: isTracking ? `${C.accent}08` : C.surface, border: isTracking ? `1px solid ${C.accent}40` : `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Timer size={18} color={isTracking ? C.accent : C.textDim} />
            <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>Timer</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: isTracking ? C.accent : C.text, fontFamily: "monospace", letterSpacing: 2 }}>{formatTime(trackingSeconds)}</div>
          <input placeholder="Su cosa stai lavorando?" style={{ flex: 1, padding: "9px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, fontFamily: font, outline: "none", minWidth: 200 }} />
          <select style={{ padding: "9px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 12, fontFamily: font, outline: "none" }}>
            {TIMESHEET_PROJECTS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <div style={{ display: "flex", gap: 4 }}>
            {!isTracking ? (
              <Btn variant="primary" icon={Play} onClick={() => setIsTracking(true)}>Avvia</Btn>
            ) : (
              <>
                <Btn variant="warning" icon={Pause} onClick={() => setIsTracking(false)}>Pausa</Btn>
                <Btn variant="danger" icon={Square} onClick={() => { setIsTracking(false); setTrackingSeconds(0); }}>Stop</Btn>
              </>
            )}
          </div>
        </div>
      </Card>

      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <StatCard label="Ore totali" value={`${totalHours}h`} icon={Clock} color={C.accent} />
        <StatCard label="Ore fatturabili" value={`${billableHours}h`} icon={Timer} color={C.success} />
        <StatCard label="Ricavo calcolato" value={fmt(billableRevenue)} icon={DollarSign} color={C.blue} />
        <StatCard label="Tariffa media" value={`${fmt(avgRate)}/h`} icon={TrendingUp} color={C.warning} />
      </div>

      {/* User summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 20 }}>
        {userSummary.map(u => (
          <Card key={u.user} onClick={() => setFilterUser(filterUser === u.user ? "all" : u.user)}
            style={{ cursor: "pointer", padding: 14, borderColor: filterUser === u.user ? C.accent : C.border, transition: "border-color 0.15s" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <Avatar initials={u.avatar} size={32} color={filterUser === u.user ? C.accent : C.textDim} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{u.user}</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>{u.hours}h totali</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, padding: 6, background: C.bg, borderRadius: 6, textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.success }}>{u.billable}h</div>
                <div style={{ fontSize: 9, color: C.textDim }}>Fatturabili</div>
              </div>
              <div style={{ flex: 1, padding: 6, background: C.bg, borderRadius: 6, textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{fmt(u.revenue)}</div>
                <div style={{ fontSize: 9, color: C.textDim }}>Ricavo</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <TabBar tabs={[
          { key: "all", label: "Tutti i giorni" },
          { key: "today", label: "Oggi" },
          { key: "yesterday", label: "Ieri" },
        ]} active={filterDate} onChange={setFilterDate} />
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 12, fontFamily: font, outline: "none" }}>
          <option value="all">Tutti i progetti</option>
          {TIMESHEET_PROJECTS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {["Utente", "Progetto", "Attività", "Data", "Ore", "Tariffa", "Totale", "Fatt.", "Stato"].map(h => (
                <th key={h} style={{ padding: "12px", textAlign: "left", color: C.textDim, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => (
              <tr key={e.id} style={{ borderBottom: `1px solid ${C.border}`, transition: "background 0.15s" }}
                onMouseEnter={ev => ev.currentTarget.style.background = C.surfaceAlt}
                onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}>
                <td style={{ padding: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Avatar initials={e.avatar} size={24} color={C.accent} />
                    <span style={{ fontWeight: 500, color: C.text }}>{e.user}</span>
                  </div>
                </td>
                <td style={{ padding: "12px" }}>
                  <span style={{ fontWeight: 600, color: e.project === "Interno" ? C.textMuted : C.text }}>{e.project}</span>
                </td>
                <td style={{ padding: "12px", color: C.textMuted }}>{e.task}</td>
                <td style={{ padding: "12px", color: C.textMuted, fontSize: 12 }}>{new Date(e.date).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}</td>
                <td style={{ padding: "12px", fontWeight: 700, color: C.text }}>{e.hours}h</td>
                <td style={{ padding: "12px", color: C.textMuted }}>{fmt(e.rate)}/h</td>
                <td style={{ padding: "12px", fontWeight: 600, color: e.billable ? C.text : C.textDim }}>{e.billable ? fmt(e.hours * e.rate) : "—"}</td>
                <td style={{ padding: "12px" }}>
                  {e.billable ? (
                    <CheckCircle size={16} color={C.success} />
                  ) : (
                    <Coffee size={16} color={C.textDim} />
                  )}
                </td>
                <td style={{ padding: "12px" }}>
                  <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: e.status === "approvato" ? C.successDim : C.warningDim, color: e.status === "approvato" ? C.success : C.warning, textTransform: "capitalize" }}>{e.status === "in_attesa" ? "In attesa" : e.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <EmptyState icon={Clock} title="Nessuna registrazione" desc="Modifica i filtri" />}
      </Card>
    </div>
  );
};

// ━━━ AUTOMATIONS — WORKFLOW BUILDER ━━━
const AutomationsPage = () => {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedAuto, setSelectedAuto] = useState(null);

  const filtered = AUTOMATIONS.filter(a => {
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalRuns = AUTOMATIONS.reduce((s, a) => s + a.runs, 0);
  const selected = selectedAuto ? AUTOMATIONS.find(a => a.id === selectedAuto) : null;

  const triggerColor = { CRM: "#6C5CE7", Fatturazione: "#FFAA2C", Logistica: "#4ECDC4", Report: "#818CF8", Sistema: "#00D68F", Operazioni: "#F59E0B" };

  return (
    <div>
      <PageHeader title="Automazioni & Workflow" desc={`${AUTOMATIONS.length} workflow · ${AUTOMATIONS.filter(a => a.status === "attivo").length} attivi · ${totalRuns} esecuzioni totali`}>
        <Btn variant="primary" icon={Plus}>Nuovo workflow</Btn>
      </PageHeader>

      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <StatCard label="Workflow attivi" value={AUTOMATIONS.filter(a => a.status === "attivo").length} icon={Zap} color={C.success} />
        <StatCard label="Esecuzioni totali" value={totalRuns} icon={Repeat} color={C.accent} />
        <StatCard label="Esecuzioni oggi" value={AUTOMATIONS.filter(a => a.lastRun?.startsWith("2026-02-20")).length} icon={Activity} color={C.blue} />
        <StatCard label="In pausa" value={AUTOMATIONS.filter(a => a.status === "in_pausa").length} icon={Pause} color={C.warning} />
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Cerca workflow..." />
        <TabBar tabs={[
          { key: "all", label: `Tutti (${AUTOMATIONS.length})` },
          { key: "attivo", label: `Attivi (${AUTOMATIONS.filter(a => a.status === "attivo").length})` },
          { key: "in_pausa", label: `In pausa (${AUTOMATIONS.filter(a => a.status === "in_pausa").length})` },
          { key: "bozza", label: `Bozze (${AUTOMATIONS.filter(a => a.status === "bozza").length})` },
        ]} active={filterStatus} onChange={setFilterStatus} />
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map(a => (
              <Card key={a.id} onClick={() => setSelectedAuto(a.id)}
                style={{ cursor: "pointer", borderColor: selectedAuto === a.id ? C.accent : C.border, transition: "border-color 0.15s" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: `${triggerColor[a.category] || C.accent}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Zap size={18} color={triggerColor[a.category] || C.accent} />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 3 }}>{a.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ padding: "2px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600, background: `${triggerColor[a.category] || C.accent}18`, color: triggerColor[a.category] || C.accent }}>{a.category}</span>
                        <StatusBadge status={a.status} map={automationStatusMap} />
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{a.runs}</div>
                    <div style={{ fontSize: 10, color: C.textDim }}>esecuzioni</div>
                  </div>
                </div>

                {/* Workflow visualization */}
                <div style={{ display: "flex", alignItems: "center", gap: 0, padding: "10px 0", overflowX: "auto" }}>
                  <div style={{ padding: "6px 12px", borderRadius: 8, background: C.accentDim, border: `1px dashed ${C.accent}40`, fontSize: 11, fontWeight: 600, color: C.accentLight, whiteSpace: "nowrap" }}>
                    ⚡ {a.trigger}
                  </div>
                  {a.actions.map((act, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center" }}>
                      <div style={{ width: 24, height: 1, background: C.border }} />
                      <ArrowRight size={12} color={C.textDim} />
                      <div style={{ width: 8, height: 1, background: C.border }} />
                      <div style={{ padding: "6px 10px", borderRadius: 8, background: C.surfaceAlt, fontSize: 11, color: C.textMuted, whiteSpace: "nowrap" }}>
                        {act}
                      </div>
                    </div>
                  ))}
                </div>

                {a.lastRun && (
                  <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>
                    Ultima esecuzione: {a.lastRun}
                  </div>
                )}
              </Card>
            ))}
          </div>
          {filtered.length === 0 && <EmptyState icon={Zap} title="Nessun workflow trovato" desc="Crea il tuo primo workflow automatico" />}
        </div>

        {selected && (
          <Card style={{ width: 300, flexShrink: 0, alignSelf: "flex-start", position: "sticky", top: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{selected.name}</div>
              <IconBtn onClick={() => setSelectedAuto(null)}><X size={16} /></IconBtn>
            </div>
            <StatusBadge status={selected.status} map={automationStatusMap} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
              <div style={{ padding: 10, background: C.bg, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.textDim }}>Trigger</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.accentLight }}>{selected.trigger}</div>
              </div>
              <div style={{ padding: 10, background: C.bg, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.textDim, marginBottom: 6 }}>Azioni ({selected.actions.length})</div>
                {selected.actions.map((act, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0" }}>
                    <div style={{ width: 18, height: 18, borderRadius: 4, background: C.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: C.textDim }}>{i + 1}</div>
                    <span style={{ fontSize: 12, color: C.text }}>{act}</span>
                  </div>
                ))}
              </div>
              {[
                { label: "Categoria", value: selected.category },
                { label: "Esecuzioni", value: selected.runs.toString() },
                { label: "Ultima esecuzione", value: selected.lastRun || "Mai" },
              ].map(info => (
                <div key={info.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: C.bg, borderRadius: 8 }}>
                  <span style={{ fontSize: 11, color: C.textDim }}>{info.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{info.value}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
              {selected.status === "attivo" ? (
                <Btn variant="warning" small icon={Pause} style={{ flex: 1, justifyContent: "center" }}>Pausa</Btn>
              ) : (
                <Btn variant="success" small icon={Play} style={{ flex: 1, justifyContent: "center" }}>Attiva</Btn>
              )}
              <Btn variant="default" small icon={Edit2}>Modifica</Btn>
              <Btn variant="default" small icon={Copy}>Duplica</Btn>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

// ━━━ INTEGRATIONS — INTEGRAZIONI ━━━
const IntegrationsPage = () => {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const filtered = INTEGRATIONS.filter(i => {
    if (filterStatus === "connesso" && i.status !== "connesso") return false;
    if (filterStatus === "disponibile" && i.status === "connesso") return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase()) && !i.category.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const connectedCount = INTEGRATIONS.filter(i => i.status === "connesso").length;

  return (
    <div>
      <PageHeader title="Integrazioni" desc={`${INTEGRATIONS.length} integrazioni · ${connectedCount} connesse · ${INTEGRATIONS.length - connectedCount} disponibili`}>
        <Btn variant="default" icon={Plug} small>Richiedi integrazione</Btn>
      </PageHeader>

      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <StatCard label="Connesse" value={connectedCount} icon={CheckCircle} color={C.success} />
        <StatCard label="Disponibili" value={INTEGRATIONS.filter(i => ["disconnesso", "disponibile"].includes(i.status)).length} icon={Plug} color={C.blue} />
        <StatCard label="Categorie" value={[...new Set(INTEGRATIONS.map(i => i.category))].length} icon={Layers} color={C.accent} />
        <StatCard label="Ultima sync" value="09:20" icon={RotateCw} color={C.warning} />
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Cerca integrazioni..." />
        <TabBar tabs={[
          { key: "all", label: `Tutte (${INTEGRATIONS.length})` },
          { key: "connesso", label: `Connesse (${connectedCount})` },
          { key: "disponibile", label: `Disponibili (${INTEGRATIONS.length - connectedCount})` },
        ]} active={filterStatus} onChange={setFilterStatus} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
        {filtered.map(i => (
          <Card key={i.id} style={{ transition: "border-color 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = C.borderLight}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>{i.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{i.name}</div>
                  <StatusBadge status={i.status} map={integrationStatusMap} />
                </div>
                <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.4, marginBottom: 8 }}>{i.desc}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ padding: "2px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600, background: C.surfaceAlt, color: C.textMuted }}>{i.category}</span>
                  {i.lastSync && <span style={{ fontSize: 10, color: C.textDim }}>Sync: {i.lastSync.split(" ")[1]}</span>}
                </div>
                {i.status === "connesso" && i.dataSync && (
                  <div style={{ fontSize: 11, color: C.textDim, padding: "6px 10px", background: C.bg, borderRadius: 6, marginBottom: 8 }}>
                    Dati: {i.dataSync}
                  </div>
                )}
                <div style={{ display: "flex", gap: 6 }}>
                  {i.status === "connesso" ? (
                    <>
                      <Btn variant="default" small icon={Settings}>Configura</Btn>
                      <Btn variant="default" small icon={RotateCw}>Sincronizza</Btn>
                      <Btn variant="ghost" small style={{ color: C.danger }}>Disconnetti</Btn>
                    </>
                  ) : (
                    <Btn variant="primary" small icon={Plug}>Connetti</Btn>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {filtered.length === 0 && <EmptyState icon={Plug} title="Nessuna integrazione trovata" desc="Prova a modificare i filtri" />}
    </div>
  );
};

// ━━━ ANALYTICS — BI AVANZATA ━━━
const AnalyticsPage = () => {
  const [period, setPeriod] = useState("6m");
  const maxRevenue = Math.max(...ANALYTICS_REVENUE_MONTHS.map(m => m.revenue));
  const maxPipelineVal = Math.max(...ANALYTICS_PIPELINE.map(p => p.value));
  const topClientMax = Math.max(...ANALYTICS_TOP_CLIENTS.map(c => c.revenue));

  const MiniSparkline = ({ data, color, width = 60, height = 20 }) => {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`).join(" ");
    return (
      <svg width={width} height={height} style={{ display: "block" }}>
        <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  return (
    <div>
      <PageHeader title="Analytics & Business Intelligence" desc="Performance, trend e metriche chiave del workspace">
        <TabBar tabs={[
          { key: "1m", label: "1M" },
          { key: "3m", label: "3M" },
          { key: "6m", label: "6M" },
          { key: "1y", label: "1A" },
        ]} active={period} onChange={setPeriod} />
        <Btn variant="default" icon={Download} small>Esporta</Btn>
      </PageHeader>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
        {ANALYTICS_KPI.map(kpi => (
          <Card key={kpi.label} style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4, fontWeight: 600 }}>{kpi.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{kpi.value}</div>
              </div>
              <MiniSparkline data={kpi.sparkline} color={kpi.positive ? C.success : C.danger} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {kpi.positive ? <TrendingUp size={12} color={C.success} /> : <TrendingDown size={12} color={C.danger} />}
              <span style={{ fontSize: 12, fontWeight: 600, color: kpi.positive ? C.success : C.danger }}>{kpi.change}</span>
              <span style={{ fontSize: 11, color: C.textDim }}>vs periodo prec.</span>
            </div>
          </Card>
        ))}
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        {/* Revenue Chart */}
        <Card style={{ flex: 2, minWidth: 400 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Andamento ricavi</div>
            <div style={{ display: "flex", gap: 12 }}>
              {[{ label: "Ricavi", color: C.accent }, { label: "Costi", color: C.danger }, { label: "Profitto", color: C.success }].map(l => (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
                  <span style={{ fontSize: 11, color: C.textMuted }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 180, padding: "0 4px" }}>
            {ANALYTICS_REVENUE_MONTHS.map(m => (
              <div key={m.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ width: "100%", display: "flex", gap: 2, alignItems: "flex-end", justifyContent: "center", height: 160 }}>
                  <div style={{ width: "28%", height: `${(m.revenue / maxRevenue) * 140}px`, background: `linear-gradient(180deg, ${C.accent}, ${C.accent}60)`, borderRadius: "4px 4px 0 0", transition: "height 0.3s" }} title={`Ricavi: €${m.revenue}`} />
                  <div style={{ width: "28%", height: `${(m.expenses / maxRevenue) * 140}px`, background: `linear-gradient(180deg, ${C.danger}80, ${C.danger}30)`, borderRadius: "4px 4px 0 0", transition: "height 0.3s" }} title={`Costi: €${m.expenses}`} />
                  <div style={{ width: "28%", height: `${(m.profit / maxRevenue) * 140}px`, background: `linear-gradient(180deg, ${C.success}, ${C.success}60)`, borderRadius: "4px 4px 0 0", transition: "height 0.3s" }} title={`Profitto: €${m.profit}`} />
                </div>
                <span style={{ fontSize: 11, color: C.textDim, fontWeight: 600 }}>{m.month}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Pipeline funnel */}
        <Card style={{ flex: 1, minWidth: 280 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 16 }}>Funnel Pipeline</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ANALYTICS_PIPELINE.map((p, i) => (
              <div key={p.stage}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: C.textMuted }}>{p.stage}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{p.count} deal</span>
                    <span style={{ fontSize: 12, color: C.textDim }}>{fmt(p.value)}</span>
                  </div>
                </div>
                <div style={{ width: "100%", height: 8, borderRadius: 4, background: C.surfaceAlt }}>
                  <div style={{
                    width: `${(p.value / maxPipelineVal) * 100}%`, height: "100%", borderRadius: 4,
                    background: p.color, transition: "width 0.3s",
                  }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, padding: "10px 0 0", borderTop: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: C.textMuted }}>Valore pipeline totale</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.accent }}>{fmt(ANALYTICS_PIPELINE.reduce((s, p) => s + p.value, 0))}</span>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* Top clients */}
        <Card style={{ flex: 1, minWidth: 300 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 16 }}>Top 5 Clienti per ricavi</div>
          {ANALYTICS_TOP_CLIENTS.map((c, i) => (
            <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < ANALYTICS_TOP_CLIENTS.length - 1 ? `1px solid ${C.border}` : "none" }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: `${c.color}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: c.color }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{c.name}</div>
                <div style={{ fontSize: 11, color: C.textDim }}>{c.deals} deal</div>
              </div>
              <div style={{ width: 120, marginRight: 8 }}>
                <div style={{ width: "100%", height: 6, borderRadius: 3, background: C.surfaceAlt }}>
                  <div style={{ width: `${(c.revenue / topClientMax) * 100}%`, height: "100%", borderRadius: 3, background: c.color }} />
                </div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text, minWidth: 80, textAlign: "right" }}>{fmt(c.revenue)}</span>
            </div>
          ))}
        </Card>

        {/* Performance metrics */}
        <Card style={{ flex: 1, minWidth: 300 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 16 }}>Metriche team</div>
          {[
            { label: "Task completati questa settimana", value: "24", total: "31", pct: 77, color: C.accent },
            { label: "Ore fatturabili vs totali", value: "38h", total: "48h", pct: 79, color: C.success },
            { label: "Tasso risposta email", value: "< 2h", total: "target 4h", pct: 92, color: C.blue },
            { label: "Customer satisfaction", value: "4.6/5", total: "32 review", pct: 92, color: C.warning },
            { label: "Uptime piattaforma", value: "99.97%", total: "SLA 99.9%", pct: 99, color: C.success },
          ].map(m => (
            <div key={m.label} style={{ padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: C.textMuted }}>{m.label}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{m.value}</span>
                  <span style={{ fontSize: 11, color: C.textDim }}>/ {m.total}</span>
                </div>
              </div>
              <div style={{ width: "100%", height: 6, borderRadius: 3, background: C.surfaceAlt }}>
                <div style={{ width: `${m.pct}%`, height: "100%", borderRadius: 3, background: m.color, transition: "width 0.3s" }} />
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
};

// ━━━ SECURITY — AUDIT & SICUREZZA ━━━
const SecurityPage = () => {
  const [logFilter, setLogFilter] = useState("all");
  const [logSearch, setLogSearch] = useState("");

  const sec = SECURITY_SETTINGS;
  const filteredLogs = AUDIT_LOG.filter(l => {
    if (logFilter !== "all" && l.level !== logFilter) return false;
    if (logSearch && !l.action.toLowerCase().includes(logSearch.toLowerCase()) && !l.user.toLowerCase().includes(logSearch.toLowerCase())) return false;
    return true;
  });

  const levelStyles = {
    info: { bg: "rgba(129,140,248,0.12)", color: "#818CF8" },
    warning: { bg: "rgba(255,170,44,0.12)", color: "#FFAA2C" },
    danger: { bg: "rgba(255,107,107,0.12)", color: "#FF6B6B" },
  };

  return (
    <div>
      <PageHeader title="Sicurezza & Audit" desc="Impostazioni di sicurezza, log attività e conformità">
        <Btn variant="default" icon={Download} small>Esporta log</Btn>
      </PageHeader>

      {/* Security score */}
      <Card style={{ marginBottom: 20, background: `linear-gradient(135deg, ${C.surface}, ${C.success}08)`, border: `1px solid ${C.success}30` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div style={{ position: "relative", width: 80, height: 80 }}>
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="34" fill="none" stroke={C.surfaceAlt} strokeWidth="6" />
              <circle cx="40" cy="40" r="34" fill="none" stroke={C.success} strokeWidth="6"
                strokeDasharray={`${(85 / 100) * 2 * Math.PI * 34} ${2 * Math.PI * 34}`}
                strokeLinecap="round" transform="rotate(-90 40 40)" />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: C.text }}>85</span>
              <span style={{ fontSize: 8, color: C.textDim, fontWeight: 600 }}>/ 100</span>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>Security Score: Buono</div>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 8 }}>Il tuo workspace ha un buon livello di sicurezza. Attiva 2FA per tutti gli utenti per raggiungere il punteggio massimo.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: C.successDim, color: C.success }}>2FA attivo</span>
              <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: C.successDim, color: C.success }}>Backup attivo</span>
              <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: C.warningDim, color: C.warning }}>1 utente senza 2FA</span>
            </div>
          </div>
        </div>
      </Card>

      <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        {/* 2FA */}
        <Card style={{ flex: 1, minWidth: 250 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: C.successDim, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShieldCheck size={18} color={C.success} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Autenticazione a 2 fattori</div>
              <div style={{ fontSize: 12, color: C.success, fontWeight: 600 }}>Attiva</div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: C.textMuted }}>Utenti iscritti</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{sec.twoFactor.enrolledUsers} / {sec.twoFactor.totalUsers}</span>
          </div>
          <div style={{ width: "100%", height: 6, borderRadius: 3, background: C.surfaceAlt, marginBottom: 6 }}>
            <div style={{ width: `${(sec.twoFactor.enrolledUsers / sec.twoFactor.totalUsers) * 100}%`, height: "100%", borderRadius: 3, background: C.success }} />
          </div>
          <div style={{ fontSize: 11, color: C.textDim }}>Metodo: {sec.twoFactor.method}</div>
        </Card>

        {/* Password policy */}
        <Card style={{ flex: 1, minWidth: 250 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: C.accentDim, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Key size={18} color={C.accent} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Policy password</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>Configurazione attuale</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[
              { label: "Lunghezza minima", value: `${sec.passwordPolicy.minLength} caratteri`, ok: true },
              { label: "Maiuscole", value: "Richieste", ok: sec.passwordPolicy.requireUppercase },
              { label: "Numeri", value: "Richiesti", ok: sec.passwordPolicy.requireNumbers },
              { label: "Caratteri speciali", value: "Richiesti", ok: sec.passwordPolicy.requireSpecial },
              { label: "Scadenza", value: `Ogni ${sec.passwordPolicy.expiryDays} giorni`, ok: true },
            ].map(p => (
              <div key={p.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, color: C.textMuted }}>
                  <CheckCircle size={12} color={p.ok ? C.success : C.textDim} />
                  {p.label}
                </div>
                <span style={{ color: C.text, fontWeight: 500 }}>{p.value}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Session settings */}
        <Card style={{ flex: 1, minWidth: 250 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: C.warningDim, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Fingerprint size={18} color={C.warning} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Sessioni & Accesso</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>Controllo sessioni</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[
              { label: "Sessioni concorrenti", value: `Max ${sec.sessions.maxConcurrent}` },
              { label: "Timeout sessione", value: `${sec.sessions.timeout} min` },
              { label: "Auto-logout inattività", value: sec.sessions.idleLogout ? "Attivo" : "Disattivo" },
              { label: "IP whitelist", value: `${sec.ipWhitelist.length} range` },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12 }}>
                <span style={{ color: C.textMuted }}>{s.label}</span>
                <span style={{ color: C.text, fontWeight: 500 }}>{s.value}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4 }}>IP Whitelist</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {sec.ipWhitelist.map(ip => (
                <span key={ip} style={{ padding: "3px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600, background: C.surfaceAlt, color: C.textMuted, fontFamily: "monospace" }}>{ip}</span>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Audit Log */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 16px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Log attività</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: 9, color: C.textDim }} />
              <input value={logSearch} onChange={e => setLogSearch(e.target.value)} placeholder="Cerca log..." style={{ padding: "8px 10px 8px 30px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 12, fontFamily: font, outline: "none", width: 200 }} />
            </div>
            <TabBar tabs={[
              { key: "all", label: "Tutti" },
              { key: "warning", label: "Avvisi" },
              { key: "danger", label: "Critici" },
            ]} active={logFilter} onChange={setLogFilter} />
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {["", "Azione", "Utente", "IP", "Dispositivo", "Data"].map(h => (
                <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: C.textDim, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map(l => {
              const ls = levelStyles[l.level];
              return (
                <tr key={l.id} style={{ borderBottom: `1px solid ${C.border}`, transition: "background 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "10px 12px", width: 30 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 4, background: ls.color }} />
                  </td>
                  <td style={{ padding: "10px 12px", fontWeight: 500, color: l.level === "danger" ? C.danger : C.text }}>{l.action}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Avatar initials={l.user === "Sistema" ? "SY" : l.user === "Admin" ? "AD" : l.user.split(" ").map(w => w[0]).join("").slice(0, 2)} size={22} color={l.level === "danger" ? C.danger : C.accent} />
                      <span style={{ fontSize: 12, color: C.textMuted }}>{l.user}</span>
                    </div>
                  </td>
                  <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 11, color: C.textDim }}>{l.ip}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: C.textMuted }}>{l.device}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: C.textMuted }}>{l.date}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredLogs.length === 0 && <EmptyState icon={Shield} title="Nessun log trovato" desc="Modifica i filtri" />}
      </Card>
    </div>
  );
};

// ━━━ TASKS ━━━
const TasksPage = () => {
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", priority: "medium", assignee: "", status: "todo" });

  const filtered = tasks.filter(t => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const toggleStar = id => setTasks(ts => ts.map(t => t.id === id ? { ...t, starred: !t.starred } : t));
  const cycleStatus = id => {
    const order = ["todo", "in_progress", "done"];
    setTasks(ts => ts.map(t => t.id === id ? { ...t, status: order[(order.indexOf(t.status) + 1) % 3] } : t));
  };
  const deleteTask = id => setTasks(ts => ts.filter(t => t.id !== id));
  const addTask = () => {
    if (!newTask.title.trim()) return;
    setTasks(ts => [...ts, { ...newTask, id: Date.now(), due: "2026-03-01", tags: [], starred: false }]);
    setNewTask({ title: "", priority: "medium", assignee: "", status: "todo" });
    setShowAdd(false);
  };

  const counts = { all: tasks.length, todo: tasks.filter(t => t.status === "todo").length, in_progress: tasks.filter(t => t.status === "in_progress").length, done: tasks.filter(t => t.status === "done").length };

  return (
    <div>
      <PageHeader title="Task" desc="Gestisci e monitora le tue attività">
        <Btn variant="primary" icon={Plus} onClick={() => setShowAdd(!showAdd)}>Nuovo task</Btn>
      </PageHeader>

      {showAdd && (
        <Card style={{ marginBottom: 20, border: `1px solid ${C.accent}40` }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: 2, minWidth: 200 }}>
              <label style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Titolo</label>
              <input value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} placeholder="Descrizione del task..." style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, fontFamily: font, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ minWidth: 130 }}>
              <label style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Priorità</label>
              <select value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value })} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, fontFamily: font, outline: "none" }}>
                <option value="high">Alta</option><option value="medium">Media</option><option value="low">Bassa</option>
              </select>
            </div>
            <div style={{ minWidth: 150 }}>
              <label style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Assegna a</label>
              <input value={newTask.assignee} onChange={e => setNewTask({ ...newTask, assignee: e.target.value })} placeholder="Nome..." style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, fontFamily: font, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="primary" onClick={addTask} icon={Check}>Aggiungi</Btn>
              <Btn variant="ghost" onClick={() => setShowAdd(false)} icon={X}>Annulla</Btn>
            </div>
          </div>
        </Card>
      )}

      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Cerca task..." />
        <TabBar tabs={[
          { key: "all", label: `Tutti (${counts.all})` },
          { key: "todo", label: `Da fare (${counts.todo})` },
          { key: "in_progress", label: `In corso (${counts.in_progress})` },
          { key: "done", label: `Fatti (${counts.done})` },
        ]} active={filterStatus} onChange={setFilterStatus} />
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <th style={{ width: 36, padding: "12px 8px" }} />
              <th style={{ padding: "12px 8px", textAlign: "left", color: C.textDim, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>Task</th>
              <th style={{ padding: "12px 8px", textAlign: "left", color: C.textDim, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>Stato</th>
              <th style={{ padding: "12px 8px", textAlign: "left", color: C.textDim, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>Priorità</th>
              <th style={{ padding: "12px 8px", textAlign: "left", color: C.textDim, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>Assegnato</th>
              <th style={{ padding: "12px 8px", textAlign: "left", color: C.textDim, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>Scadenza</th>
              <th style={{ padding: "12px 8px", width: 80 }} />
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.id} style={{ borderBottom: `1px solid ${C.border}`, transition: "background 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <td style={{ padding: "8px" }}>
                  <IconBtn onClick={() => toggleStar(t.id)}>
                    {t.starred ? <Star size={14} fill={C.warning} color={C.warning} /> : <StarOff size={14} />}
                  </IconBtn>
                </td>
                <td style={{ padding: "12px 8px" }}>
                  <div style={{ fontWeight: 600, color: C.text }}>{t.title}</div>
                  <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                    {t.tags.map(tag => (
                      <span key={tag} style={{ padding: "1px 6px", borderRadius: 4, fontSize: 10, background: C.accentDim, color: C.accentLight, fontWeight: 600 }}>{tag}</span>
                    ))}
                  </div>
                </td>
                <td style={{ padding: "12px 8px" }}>
                  <div onClick={() => cycleStatus(t.id)} style={{ cursor: "pointer" }}>
                    <StatusBadge status={t.status} map={taskStatusMap} />
                  </div>
                </td>
                <td style={{ padding: "12px 8px" }}><StatusBadge status={t.priority} map={priorityMap} /></td>
                <td style={{ padding: "12px 8px", color: C.textMuted, fontSize: 12 }}>{t.assignee}</td>
                <td style={{ padding: "12px 8px", color: C.textMuted, fontSize: 12 }}>{t.due}</td>
                <td style={{ padding: "8px" }}>
                  <div style={{ display: "flex", gap: 2 }}>
                    <IconBtn><Edit2 size={13} /></IconBtn>
                    <IconBtn onClick={() => deleteTask(t.id)}><Trash2 size={13} /></IconBtn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

// ━━━ USERS & LEADS ━━━
const UsersPage = () => {
  const [tab, setTab] = useState("users");
  const [search, setSearch] = useState("");

  const filteredUsers = INITIAL_USERS.filter(u => !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));
  const filteredLeads = INITIAL_LEADS.filter(l => !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.company.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <PageHeader title="Utenti & Lead" desc="Gestisci il tuo team e i potenziali clienti">
        <Btn variant="primary" icon={UserPlus}>{tab === "users" ? "Nuovo utente" : "Nuovo lead"}</Btn>
      </PageHeader>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
        <SearchBar value={search} onChange={setSearch} placeholder={tab === "users" ? "Cerca utenti..." : "Cerca lead..."} />
        <TabBar tabs={[
          { key: "users", label: `Utenti (${INITIAL_USERS.length})` },
          { key: "leads", label: `Lead (${INITIAL_LEADS.length})` },
        ]} active={tab} onChange={setTab} />
      </div>

      {tab === "users" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
          {filteredUsers.map(u => (
            <Card key={u.id} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <Avatar initials={u.avatar} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{u.name}</div>
                  <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: u.status === "active" ? C.successDim : C.surfaceAlt, color: u.status === "active" ? C.success : C.textDim, textTransform: "uppercase" }}>{u.status === "active" ? "Attivo" : "Inattivo"}</span>
                </div>
                <div style={{ fontSize: 12, color: C.accentLight, marginBottom: 8 }}>{u.role}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.textMuted }}><Mail size={12} />{u.email}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.textMuted }}><Phone size={12} />{u.phone}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.textMuted }}><Building size={12} />{u.company}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {["Lead", "Azienda", "Origine", "Stato", "Score", "Contatto"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: C.textDim, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map(l => (
                <tr key={l.id} style={{ borderBottom: `1px solid ${C.border}`, transition: "background 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar initials={l.avatar} size={32} color={C.blue} />
                      <div>
                        <div style={{ fontWeight: 600, color: C.text }}>{l.name}</div>
                        <div style={{ fontSize: 11, color: C.textMuted }}>{l.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px 8px", color: C.textMuted }}>{l.company}</td>
                  <td style={{ padding: "12px 8px", color: C.textMuted }}>{l.source}</td>
                  <td style={{ padding: "12px 8px" }}><StatusBadge status={l.status} map={leadStatusMap} /></td>
                  <td style={{ padding: "12px 8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 48, height: 5, borderRadius: 3, background: C.surfaceAlt, overflow: "hidden" }}>
                        <div style={{ width: `${l.score}%`, height: "100%", borderRadius: 3, background: l.score >= 80 ? C.success : l.score >= 70 ? C.warning : C.textDim }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: l.score >= 80 ? C.success : l.score >= 70 ? C.warning : C.textMuted }}>{l.score}</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 8px" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <IconBtn><Mail size={14} /></IconBtn>
                      <IconBtn><Phone size={14} /></IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
};

// ━━━ ACCOUNT / SETTINGS ━━━
const AccountPage = () => {
  const [settings, setSettings] = useState({ darkMode: true, notifications: true, emailDigest: false, language: "it", twoFactor: false, publicProfile: true });
  const toggle = key => setSettings(s => ({ ...s, [key]: !s[key] }));

  const Section = ({ title, children }) => (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 16 }}>{title}</div>
      {children}
    </Card>
  );

  const SettingRow = ({ icon: Icon, label, desc, children, last }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: last ? "none" : `1px solid ${C.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: C.accentDim, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={16} color={C.accent} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{label}</div>
          {desc && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{desc}</div>}
        </div>
      </div>
      {children}
    </div>
  );

  return (
    <div>
      <PageHeader title="Account & Impostazioni" desc="Gestisci il tuo profilo e le preferenze" />
      <Section title="Profilo">
        <div style={{ display: "flex", gap: 20, alignItems: "center", marginBottom: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: 16, background: `linear-gradient(135deg, ${C.accent}, ${C.accentLight})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700, color: "#fff" }}>AD</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>Admin Demo</div>
            <div style={{ fontSize: 13, color: C.textMuted }}>admin@example.com</div>
            <div style={{ fontSize: 12, color: C.accentLight, marginTop: 2 }}>Piano Pro · Membro dal Gen 2025</div>
          </div>
          <Btn variant="default" icon={Edit2}>Modifica</Btn>
        </div>
      </Section>
      <Section title="Preferenze">
        <SettingRow icon={settings.darkMode ? Moon : Sun} label="Tema scuro" desc="Attiva la modalità scura dell'interfaccia"><Toggle checked={settings.darkMode} onChange={() => toggle("darkMode")} /></SettingRow>
        <SettingRow icon={Bell} label="Notifiche push" desc="Ricevi notifiche in tempo reale"><Toggle checked={settings.notifications} onChange={() => toggle("notifications")} /></SettingRow>
        <SettingRow icon={Mail} label="Digest email" desc="Ricevi un riepilogo giornaliero via email"><Toggle checked={settings.emailDigest} onChange={() => toggle("emailDigest")} /></SettingRow>
        <SettingRow icon={Globe} label="Lingua" desc="Seleziona la lingua dell'interfaccia" last>
          <select value={settings.language} onChange={e => setSettings(s => ({ ...s, language: e.target.value }))} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, fontFamily: font, outline: "none" }}>
            <option value="it">Italiano</option><option value="en">English</option><option value="es">Español</option>
          </select>
        </SettingRow>
      </Section>
      <Section title="Sicurezza">
        <SettingRow icon={Lock} label="Autenticazione a due fattori" desc="Aggiungi un ulteriore livello di sicurezza"><Toggle checked={settings.twoFactor} onChange={() => toggle("twoFactor")} /></SettingRow>
        <SettingRow icon={Eye} label="Profilo pubblico" desc="Rendi il tuo profilo visibile agli altri utenti"><Toggle checked={settings.publicProfile} onChange={() => toggle("publicProfile")} /></SettingRow>
        <SettingRow icon={Lock} label="Cambia password" desc="Aggiorna la tua password di accesso" last><Btn variant="default">Modifica</Btn></SettingRow>
      </Section>
      <Section title="Piano & Fatturazione">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: C.successDim, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CreditCard size={16} color={C.success} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Piano Pro</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>€29/mese · Rinnovo il 1 Mar 2026</div>
            </div>
          </div>
          <Btn variant="default">Gestisci piano</Btn>
        </div>
        <div style={{ padding: "16px 0 4px", display: "flex", justifyContent: "center" }}>
          <Btn variant="danger" icon={LogOut}>Esci dall'account</Btn>
        </div>
      </Section>
    </div>
  );
};

// ─── APP SHELL ───────────────────────────────────────────────
const NAV_SECTIONS = [
  { label: "PRINCIPALE", items: [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  ]},
  { label: "CRM & VENDITE", items: [
    { key: "deals", label: "Pipeline", icon: Briefcase },
    { key: "contacts", label: "Contatti", icon: Users },
    { key: "companies", label: "Aziende", icon: Building },
    { key: "quotes", label: "Preventivi", icon: FileText },
  ]},
  { label: "CATALOGO & ORDINI", items: [
    { key: "products", label: "Catalogo", icon: Package },
    { key: "orders", label: "Ordini", icon: ShoppingCart },
  ]},
  { label: "LOGISTICA", items: [
    { key: "inventory", label: "Magazzino", icon: Warehouse },
    { key: "logistics", label: "Spedizioni", icon: Truck },
    { key: "suppliers", label: "Fornitori", icon: Handshake },
  ]},
  { label: "FATTURAZIONE", items: [
    { key: "invoices", label: "Fatture", icon: Receipt },
    { key: "expenses", label: "Note spese", icon: Wallet },
    { key: "billing", label: "Abbonamento", icon: CreditCard },
  ]},
  { label: "OPERAZIONI", items: [
    { key: "tasks", label: "Task", icon: ListTodo },
    { key: "taskboard", label: "Board", icon: Grid3X3 },
    { key: "calendar", label: "Calendario", icon: Calendar },
    { key: "timesheet", label: "Foglio ore", icon: Timer },
    { key: "documents", label: "Documenti", icon: FileText },
    { key: "users", label: "Team", icon: UserPlus },
  ]},
  { label: "COMUNICAZIONE", items: [
    { key: "inbox", label: "Posta", icon: Inbox },
    { key: "templates", label: "Template", icon: MailOpen },
  ]},
  { label: "ANALYTICS", items: [
    { key: "analytics", label: "BI & Report", icon: BarChart3 },
  ]},
  { label: "SISTEMA", items: [
    { key: "automations", label: "Automazioni", icon: Zap },
    { key: "integrations", label: "Integrazioni", icon: Plug },
    { key: "security", label: "Sicurezza", icon: ShieldCheck },
    { key: "account", label: "Impostazioni", icon: Settings },
  ]},
];

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const PAGES = {
    dashboard: () => <DashboardPage setPage={setPage} />,
    deals: () => <DealsPage setPage={setPage} setSelectedCustomer={setSelectedCustomer} />,
    contacts: () => <ContactsPage setPage={setPage} setSelectedCustomer={setSelectedCustomer} />,
    companies: () => <CompaniesPage setPage={setPage} />,
    quotes: () => <QuotesPage setPage={setPage} />,
    products: () => <ProductsPage />,
    orders: () => <OrdersPage />,
    calendar: () => <CalendarPage />,
    invoices: () => <InvoicesPage />,
    expenses: () => <ExpensesPage />,
    billing: () => <BillingPage />,
    taskboard: () => <TaskBoardPage setPage={setPage} />,
    documents: () => <DocumentsPage />,
    inbox: () => <InboxPage />,
    templates: () => <EmailTemplatesPage />,
    inventory: () => <InventoryPage />,
    logistics: () => <LogisticsPage />,
    suppliers: () => <SuppliersPage />,
    timesheet: () => <TimesheetPage />,
    automations: () => <AutomationsPage />,
    integrations: () => <IntegrationsPage />,
    analytics: () => <AnalyticsPage />,
    security: () => <SecurityPage />,
    "customer-detail": () => <CustomerDetailPage customerId={selectedCustomer} setPage={setPage} />,
    tasks: () => <TasksPage />,
    users: () => <UsersPage />,
    account: () => <AccountPage />,
  };

  const PageComp = PAGES[page] || PAGES.dashboard;

  return (
    <div style={{ fontFamily: font, background: C.bg, color: C.text, minHeight: "100vh", display: "flex" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* SIDEBAR */}
      <aside style={{ width: sidebarCollapsed ? 64 : 230, background: C.surface, borderRight: `1px solid ${C.border}`, padding: "20px 10px", display: "flex", flexDirection: "column", transition: "width 0.2s", flexShrink: 0, overflow: "hidden", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 6px", marginBottom: 24, cursor: "pointer" }} onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: `linear-gradient(135deg, ${C.accent}, #8B7CF0)`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, color: "#fff", flexShrink: 0, letterSpacing: -0.5 }}>df</div>
          {!sidebarCollapsed && <span style={{ fontSize: 16, fontWeight: 800, color: C.text, whiteSpace: "nowrap" }}>DoFlow</span>}
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
          {NAV_SECTIONS.map(section => (
            <div key={section.label}>
              {!sidebarCollapsed && (
                <div style={{ fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: 1, padding: "12px 12px 6px", textTransform: "uppercase" }}>{section.label}</div>
              )}
              {sidebarCollapsed && <div style={{ height: 8 }} />}
              {section.items.map(n => {
                const active = page === n.key || (n.key === "contacts" && page === "customer-detail");
                return (
                  <button key={n.key} onClick={() => setPage(n.key)} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: sidebarCollapsed ? "10px 0" : "9px 12px",
                    justifyContent: sidebarCollapsed ? "center" : "flex-start",
                    borderRadius: 10, border: "none", cursor: "pointer", fontFamily: font,
                    background: active ? C.accentDim : "transparent",
                    color: active ? C.accent : C.textMuted,
                    fontWeight: active ? 700 : 500, fontSize: 13,
                    transition: "all 0.15s", width: "100%",
                  }}>
                    <n.icon size={18} />
                    {!sidebarCollapsed && <span style={{ whiteSpace: "nowrap" }}>{n.label}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div style={{ padding: sidebarCollapsed ? "8px 0" : "12px", borderRadius: 10, background: C.surfaceAlt, display: "flex", alignItems: "center", gap: 10, justifyContent: sidebarCollapsed ? "center" : "flex-start", marginTop: 8 }}>
          <Avatar initials="AD" size={30} />
          {!sidebarCollapsed && (
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text, whiteSpace: "nowrap" }}>Admin Demo</div>
              <div style={{ fontSize: 10, color: C.textMuted, whiteSpace: "nowrap" }}>Pro Plan</div>
            </div>
          )}
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ flex: 1, padding: 32, overflowY: "auto", maxHeight: "100vh" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <PageComp />
        </div>
      </main>
    </div>
  );
}
