export interface PromoItem { id: string; name: string; pitch: string; href: string }
export interface Catalog {
  version?: string;
  properties: Record<string, { name: string; href?: string; pitch: string; aliases?: string[] }>;
  audiences: Record<string, string[]>;
  titles?: Record<string, string>;
}
export interface Theme { accent?: string; text?: string; muted?: string; bg?: string; border?: string; heading?: string }
export interface PickOptions {
  /** Who the reader is: makers, publishers, podcasters, developers, freelancers, merchants, shoppers. */
  audience?: string | string[];
  /** The sending site (host or URL). It never promotes itself. */
  site?: string;
  limit?: number;
  /** Rotates everything after the first `pin` items, stably per seed (e.g. the recipient email). */
  seed?: string;
  pin?: number;
  /** Add utm_source/utm_medium/utm_campaign (default true). */
  utm?: boolean;
  campaign?: string;
  exclude?: string[];
}
export interface FetchOptions { url?: string; ttlMs?: number; timeoutMs?: number; fetch?: typeof fetch; now?: () => number; bundled?: boolean }
export interface PromoBlock { items: PromoItem[]; title: string; text: string; markdown: string; html: string }
export interface PromoOptions extends PickOptions { title?: string; theme?: Theme; fetchOptions?: FetchOptions }

export const CATALOG_URL: string;
export const bundled: Catalog;
export function getCatalog(opts?: FetchOptions): Promise<Catalog>;
export function resetCache(): void;
export function hostOf(site?: string): string;
export function pick(opts?: PickOptions & { catalog?: Catalog }): PromoItem[];
export function renderText(items: PromoItem[], title: string): string;
export function renderMarkdown(items: PromoItem[], title: string): string;
export function renderHtml(items: PromoItem[], title: string, theme?: Theme): string;
export function promoBlock(opts: PromoOptions): Promise<PromoBlock>;
export function promoBlockSync(opts: PromoOptions): PromoBlock;
export function audiences(catalog?: Catalog): string[];
