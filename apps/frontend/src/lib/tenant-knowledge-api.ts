"use client";

import { apiFetch } from "@/lib/api";

export type KnowledgeParams = Record<string, string | number | boolean | null | undefined>;
export type ListResponse<T> = { items: T[]; total?: number; limit?: number; offset?: number };

export type KnowledgeSummary = {
  publishedArticles?: number;
  draftArticles?: number;
  articlesDueForReview?: number;
  totalAssets?: number;
  activeTemplates?: number;
  favoritesCount?: number;
  recentlyUpdatedCount?: number;
  systemTemplatesCount?: number;
  knowledgeRisksCount?: number;
  recentArticles?: KnowledgeArticle[];
  reviewArticles?: KnowledgeArticle[];
  activeTemplateItems?: OperationalTemplate[];
  recentAssets?: AssetItem[];
  sources?: Record<string, boolean>;
};

export type KnowledgeOptions = {
  article_types?: string[];
  asset_types?: string[];
  categories?: string[];
  content_formats?: string[];
  entity_types?: string[];
  priorities?: string[];
  relation_types?: string[];
  statuses?: string[];
  template_types?: string[];
  visibilities?: string[];
  [key: string]: unknown;
};

export type KnowledgeCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  parent_id?: string | null;
  icon?: string | null;
  color?: string | null;
  visibility?: string | null;
  is_system?: boolean;
  sort_order?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type KnowledgeTag = {
  id: string;
  name: string;
  slug: string;
  color?: string | null;
  description?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type KnowledgeArticle = {
  id: string;
  category_id?: string | null;
  category_name?: string | null;
  title: string;
  slug?: string | null;
  excerpt?: string | null;
  content?: string | null;
  content_format?: string | null;
  article_type?: string | null;
  status?: string | null;
  visibility?: string | null;
  priority?: string | null;
  owner_user_id?: string | null;
  published_at?: string | null;
  review_due_at?: string | null;
  last_reviewed_at?: string | null;
  view_count?: number | null;
  metadata?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
};

export type KnowledgeArticleVersion = {
  id: string;
  article_id?: string;
  version_number: number;
  title?: string | null;
  excerpt?: string | null;
  content?: string | null;
  content_format?: string | null;
  change_summary?: string | null;
  created_by?: string | null;
  created_at?: string | null;
};

export type KnowledgeArticleLink = {
  id: string;
  article_id?: string;
  entity_type: string;
  entity_id: string;
  relation_type?: string | null;
  metadata?: unknown;
  created_at?: string | null;
};

export type KnowledgeFavorite = {
  id: string;
  target_type: string;
  target_id: string;
  title?: string | null;
  created_at?: string | null;
};

export type AssetCollection = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  visibility?: string | null;
  is_system?: boolean;
  sort_order?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AssetItem = {
  id: string;
  collection_id?: string | null;
  collection_name?: string | null;
  document_id?: string | null;
  name: string;
  description?: string | null;
  asset_type?: string | null;
  status?: string | null;
  visibility?: string | null;
  external_url?: string | null;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  version?: string | null;
  owner_user_id?: string | null;
  metadata?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
};

export type OperationalTemplate = {
  id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  template_type?: string | null;
  category?: string | null;
  status?: string | null;
  visibility?: string | null;
  content?: unknown;
  variables?: unknown;
  instructions?: string | null;
  metadata?: unknown;
  usage_count?: number | null;
  last_used_at?: string | null;
  is_system?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type OperationalTemplateVersion = {
  id: string;
  template_id?: string;
  version_number: number;
  content?: unknown;
  variables?: unknown;
  instructions?: string | null;
  change_summary?: string | null;
  created_by?: string | null;
  created_at?: string | null;
};

export type OperationalTemplateUsage = {
  id: string;
  template_id?: string;
  action?: string | null;
  target_entity_type?: string | null;
  target_entity_id?: string | null;
  actor_user_id?: string | null;
  result_payload?: unknown;
  created_at?: string | null;
};

export type KnowledgeActivity = {
  id: string;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  actor_user_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: unknown;
  created_at?: string | null;
};

export type KnowledgeSearchResult = {
  id?: string;
  target_id?: string;
  target_type?: string;
  title?: string;
  excerpt?: string | null;
  type?: string | null;
  category?: string | null;
  status?: string | null;
  visibility?: string | null;
  updated_at?: string | null;
};

export type CreateKnowledgeArticleInput = Partial<KnowledgeArticle>;
export type UpdateKnowledgeArticleInput = Partial<KnowledgeArticle> & { change_summary?: string };
export type CreateAssetInput = Partial<AssetItem>;
export type UpdateAssetInput = Partial<AssetItem>;
export type CreateOperationalTemplateInput = Partial<OperationalTemplate>;
export type UpdateOperationalTemplateInput = Partial<OperationalTemplate> & { change_summary?: string };

function qs(params?: KnowledgeParams) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === "__all__") return;
    query.set(key, String(value));
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}

export const knowledgeApi = {
  getKnowledgeSummary: () => apiFetch<KnowledgeSummary>("/tenant/knowledge/summary"),
  getKnowledgeOptions: () => apiFetch<KnowledgeOptions>("/tenant/knowledge/options"),
  searchKnowledge: (params?: KnowledgeParams) => apiFetch<ListResponse<KnowledgeSearchResult>>(`/tenant/knowledge/search${qs(params)}`),
  seedKnowledgeBase: () => apiFetch<Record<string, unknown>>("/tenant/knowledge/seed-base", { method: "POST", body: JSON.stringify({}) }),

  listKnowledgeCategories: (params?: KnowledgeParams) => apiFetch<ListResponse<KnowledgeCategory>>(`/tenant/knowledge/categories${qs(params)}`),
  createKnowledgeCategory: (body: Partial<KnowledgeCategory>) => apiFetch<KnowledgeCategory>("/tenant/knowledge/categories", { method: "POST", body: JSON.stringify(body) }),
  getKnowledgeCategory: (categoryId: string) => apiFetch<KnowledgeCategory>(`/tenant/knowledge/categories/${categoryId}`),
  updateKnowledgeCategory: (categoryId: string, body: Partial<KnowledgeCategory>) => apiFetch<KnowledgeCategory>(`/tenant/knowledge/categories/${categoryId}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteKnowledgeCategory: (categoryId: string) => apiFetch<{ deleted?: boolean }>(`/tenant/knowledge/categories/${categoryId}`, { method: "DELETE" }),

  listKnowledgeTags: (params?: KnowledgeParams) => apiFetch<ListResponse<KnowledgeTag>>(`/tenant/knowledge/tags${qs(params)}`),
  createKnowledgeTag: (body: Partial<KnowledgeTag>) => apiFetch<KnowledgeTag>("/tenant/knowledge/tags", { method: "POST", body: JSON.stringify(body) }),
  updateKnowledgeTag: (tagId: string, body: Partial<KnowledgeTag>) => apiFetch<KnowledgeTag>(`/tenant/knowledge/tags/${tagId}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteKnowledgeTag: (tagId: string) => apiFetch<{ deleted?: boolean }>(`/tenant/knowledge/tags/${tagId}`, { method: "DELETE" }),

  listKnowledgeArticles: (params?: KnowledgeParams) => apiFetch<ListResponse<KnowledgeArticle>>(`/tenant/knowledge/articles${qs(params)}`),
  createKnowledgeArticle: (body: CreateKnowledgeArticleInput) => apiFetch<KnowledgeArticle>("/tenant/knowledge/articles", { method: "POST", body: JSON.stringify(body) }),
  getKnowledgeArticle: (articleId: string) => apiFetch<KnowledgeArticle>(`/tenant/knowledge/articles/${articleId}`),
  updateKnowledgeArticle: (articleId: string, body: UpdateKnowledgeArticleInput) => apiFetch<KnowledgeArticle>(`/tenant/knowledge/articles/${articleId}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteKnowledgeArticle: (articleId: string) => apiFetch<{ deleted?: boolean }>(`/tenant/knowledge/articles/${articleId}`, { method: "DELETE" }),
  publishKnowledgeArticle: (articleId: string) => apiFetch<KnowledgeArticle>(`/tenant/knowledge/articles/${articleId}/publish`, { method: "PATCH", body: JSON.stringify({}) }),
  archiveKnowledgeArticle: (articleId: string) => apiFetch<KnowledgeArticle>(`/tenant/knowledge/articles/${articleId}/archive`, { method: "PATCH", body: JSON.stringify({}) }),
  reviewKnowledgeArticle: (articleId: string) => apiFetch<KnowledgeArticle>(`/tenant/knowledge/articles/${articleId}/review`, { method: "PATCH", body: JSON.stringify({}) }),
  addArticleTag: (articleId: string, tagId: string) => apiFetch<Record<string, unknown>>(`/tenant/knowledge/articles/${articleId}/tags/${tagId}`, { method: "POST", body: JSON.stringify({}) }),
  removeArticleTag: (articleId: string, tagId: string) => apiFetch<{ deleted?: boolean }>(`/tenant/knowledge/articles/${articleId}/tags/${tagId}`, { method: "DELETE" }),
  listArticleVersions: (articleId: string) => apiFetch<ListResponse<KnowledgeArticleVersion>>(`/tenant/knowledge/articles/${articleId}/versions`),
  createArticleVersion: (articleId: string, body: Partial<KnowledgeArticleVersion>) => apiFetch<KnowledgeArticleVersion>(`/tenant/knowledge/articles/${articleId}/versions`, { method: "POST", body: JSON.stringify(body) }),
  listArticleLinks: (articleId: string) => apiFetch<ListResponse<KnowledgeArticleLink>>(`/tenant/knowledge/articles/${articleId}/links`),
  createArticleLink: (articleId: string, body: Partial<KnowledgeArticleLink>) => apiFetch<KnowledgeArticleLink>(`/tenant/knowledge/articles/${articleId}/links`, { method: "POST", body: JSON.stringify(body) }),
  deleteArticleLink: (articleId: string, linkId: string) => apiFetch<{ deleted?: boolean }>(`/tenant/knowledge/articles/${articleId}/links/${linkId}`, { method: "DELETE" }),
  exportKnowledgeArticle: (articleId: string) => apiFetch<Record<string, unknown>>(`/tenant/knowledge/articles/${articleId}/export`),

  listKnowledgeFavorites: (params?: KnowledgeParams) => apiFetch<ListResponse<KnowledgeFavorite>>(`/tenant/knowledge/favorites${qs(params)}`),
  createKnowledgeFavorite: (body: Partial<KnowledgeFavorite>) => apiFetch<KnowledgeFavorite>("/tenant/knowledge/favorites", { method: "POST", body: JSON.stringify(body) }),
  deleteKnowledgeFavorite: (favoriteId: string) => apiFetch<{ deleted?: boolean }>(`/tenant/knowledge/favorites/${favoriteId}`, { method: "DELETE" }),

  listAssetCollections: (params?: KnowledgeParams) => apiFetch<ListResponse<AssetCollection>>(`/tenant/knowledge/assets/collections${qs(params)}`),
  createAssetCollection: (body: Partial<AssetCollection>) => apiFetch<AssetCollection>("/tenant/knowledge/assets/collections", { method: "POST", body: JSON.stringify(body) }),
  getAssetCollection: (collectionId: string) => apiFetch<AssetCollection>(`/tenant/knowledge/assets/collections/${collectionId}`),
  updateAssetCollection: (collectionId: string, body: Partial<AssetCollection>) => apiFetch<AssetCollection>(`/tenant/knowledge/assets/collections/${collectionId}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteAssetCollection: (collectionId: string) => apiFetch<{ deleted?: boolean }>(`/tenant/knowledge/assets/collections/${collectionId}`, { method: "DELETE" }),

  listKnowledgeAssets: (params?: KnowledgeParams) => apiFetch<ListResponse<AssetItem>>(`/tenant/knowledge/assets${qs(params)}`),
  createKnowledgeAsset: (body: CreateAssetInput) => apiFetch<AssetItem>("/tenant/knowledge/assets", { method: "POST", body: JSON.stringify(body) }),
  getKnowledgeAsset: (assetId: string) => apiFetch<AssetItem>(`/tenant/knowledge/assets/${assetId}`),
  updateKnowledgeAsset: (assetId: string, body: UpdateAssetInput) => apiFetch<AssetItem>(`/tenant/knowledge/assets/${assetId}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteKnowledgeAsset: (assetId: string) => apiFetch<{ deleted?: boolean }>(`/tenant/knowledge/assets/${assetId}`, { method: "DELETE" }),
  archiveKnowledgeAsset: (assetId: string) => apiFetch<AssetItem>(`/tenant/knowledge/assets/${assetId}/archive`, { method: "PATCH", body: JSON.stringify({}) }),
  addAssetTag: (assetId: string, tagId: string) => apiFetch<Record<string, unknown>>(`/tenant/knowledge/assets/${assetId}/tags/${tagId}`, { method: "POST", body: JSON.stringify({}) }),
  removeAssetTag: (assetId: string, tagId: string) => apiFetch<{ deleted?: boolean }>(`/tenant/knowledge/assets/${assetId}/tags/${tagId}`, { method: "DELETE" }),
  exportKnowledgeAsset: (assetId: string) => apiFetch<Record<string, unknown>>(`/tenant/knowledge/assets/${assetId}/export`),

  listOperationalTemplates: (params?: KnowledgeParams) => apiFetch<ListResponse<OperationalTemplate>>(`/tenant/knowledge/templates${qs(params)}`),
  createOperationalTemplate: (body: CreateOperationalTemplateInput) => apiFetch<OperationalTemplate>("/tenant/knowledge/templates", { method: "POST", body: JSON.stringify(body) }),
  getOperationalTemplate: (templateId: string) => apiFetch<OperationalTemplate>(`/tenant/knowledge/templates/${templateId}`),
  updateOperationalTemplate: (templateId: string, body: UpdateOperationalTemplateInput) => apiFetch<OperationalTemplate>(`/tenant/knowledge/templates/${templateId}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteOperationalTemplate: (templateId: string) => apiFetch<{ deleted?: boolean }>(`/tenant/knowledge/templates/${templateId}`, { method: "DELETE" }),
  activateOperationalTemplate: (templateId: string) => apiFetch<OperationalTemplate>(`/tenant/knowledge/templates/${templateId}/activate`, { method: "PATCH", body: JSON.stringify({}) }),
  archiveOperationalTemplate: (templateId: string) => apiFetch<OperationalTemplate>(`/tenant/knowledge/templates/${templateId}/archive`, { method: "PATCH", body: JSON.stringify({}) }),
  duplicateOperationalTemplate: (templateId: string) => apiFetch<OperationalTemplate>(`/tenant/knowledge/templates/${templateId}/duplicate`, { method: "POST", body: JSON.stringify({}) }),
  previewOperationalTemplate: (templateId: string, body: { variables?: unknown }) => apiFetch<Record<string, unknown>>(`/tenant/knowledge/templates/${templateId}/preview`, { method: "POST", body: JSON.stringify(body) }),
  useOperationalTemplate: (templateId: string, body: Record<string, unknown>) => apiFetch<OperationalTemplateUsage>(`/tenant/knowledge/templates/${templateId}/use`, { method: "POST", body: JSON.stringify(body) }),
  listOperationalTemplateVersions: (templateId: string) => apiFetch<ListResponse<OperationalTemplateVersion>>(`/tenant/knowledge/templates/${templateId}/versions`),
  createOperationalTemplateVersion: (templateId: string, body: Partial<OperationalTemplateVersion>) => apiFetch<OperationalTemplateVersion>(`/tenant/knowledge/templates/${templateId}/versions`, { method: "POST", body: JSON.stringify(body) }),
  listOperationalTemplateUsage: (templateId: string) => apiFetch<ListResponse<OperationalTemplateUsage>>(`/tenant/knowledge/templates/${templateId}/usage`),
  exportOperationalTemplate: (templateId: string) => apiFetch<Record<string, unknown>>(`/tenant/knowledge/templates/${templateId}/export`),

  getKnowledgeActivity: (params?: KnowledgeParams) => apiFetch<ListResponse<KnowledgeActivity>>(`/tenant/knowledge/activity${qs(params)}`),
  exportKnowledge: (params?: KnowledgeParams) => apiFetch<Record<string, unknown>>(`/tenant/knowledge/export${qs(params)}`),
};
