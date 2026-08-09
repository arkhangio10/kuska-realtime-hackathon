export type NewsArticle = {
  id: string;
  title: string;
  url: string;
  domain: string;
  publishedAt: string;
  imageUrl?: string;
  language?: string;
  sourceCountry?: string;
};

export type NewsFeed = {
  articles: NewsArticle[];
  updatedAt: string;
  source: "GDELT DOC 2.0";
  searchUrl: string;
  unavailable: boolean;
  note?: string;
};
