import { IS_MOCK } from "../config";
import { mockTickerNews } from "../data/mockCatalysts";
import { marketData } from "./alpacaClient";
import type { NewsItem } from "../types";

interface AlpacaNewsArticle {
  id: number;
  headline: string;
  author: string;
  created_at: string;
  updated_at: string;
  url: string;
  source: string;
  symbols: string[];
}

interface AlpacaNewsResponse {
  news: AlpacaNewsArticle[];
  next_page_token?: string | null;
}

const ONE_WEEK_MS = 7 * 86_400_000;

function withinLastWeek(publishedAt: string): boolean {
  return Date.now() - new Date(publishedAt).getTime() <= ONE_WEEK_MS;
}

export async function fetchTickerNews(
  symbol: string,
  signal?: AbortSignal,
  limit = 50,
): Promise<NewsItem[]> {
  const sym = symbol.toUpperCase();

  if (IS_MOCK) {
    await new Promise((r) => setTimeout(r, 200));
    if (signal?.aborted) return [];
    return mockTickerNews(sym).filter((n) => withinLastWeek(n.publishedAt));
  }

  const res = await marketData.get<AlpacaNewsResponse>("/v1beta1/news", {
    symbols: sym,
    limit: String(limit),
    sort: "desc",
  });

  return (res.news ?? [])
    .map((n) => ({
      id: String(n.id),
      headline: n.headline,
      source: n.source || n.author || "Alpaca",
      url: n.url,
      publishedAt: n.created_at,
    }))
    .filter((n) => withinLastWeek(n.publishedAt));
}
