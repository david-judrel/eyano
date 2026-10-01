import { Tool } from './tool';

export interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
}

export async function webSearch(query: string, maxResults: number = 5): Promise<WebSearchResult[]> {
  try {
    const results = await searchDuckDuckGo(query, maxResults);
    if (results.length > 0) return results;
    return await searchWikipedia(query, maxResults);
  } catch {
    return [];
  }
}

async function searchDuckDuckGo(query: string, maxResults: number): Promise<WebSearchResult[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Eyano/1.0' },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) return [];

  const data = await res.json();
  const results: WebSearchResult[] = [];

  if (data.AbstractText) {
    results.push({
      title: data.Heading || query,
      snippet: data.AbstractText,
      url: data.AbstractURL || '',
    });
  }

  if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
    for (const topic of data.RelatedTopics) {
      if (results.length >= maxResults) break;
      if (topic.Text && topic.FirstURL) {
        results.push({
          title: topic.Text.substring(0, 100),
          snippet: topic.Text,
          url: topic.FirstURL,
        });
      }
      if (topic.Topics && Array.isArray(topic.Topics)) {
        for (const sub of topic.Topics) {
          if (results.length >= maxResults) break;
          if (sub.Text && sub.FirstURL) {
            results.push({
              title: sub.Text.substring(0, 100),
              snippet: sub.Text,
              url: sub.FirstURL,
            });
          }
        }
      }
    }
  }

  return results.slice(0, maxResults);
}

async function searchWikipedia(query: string, maxResults: number): Promise<WebSearchResult[]> {
  try {
    const searchUrl = `https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Eyano/1.0' },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return [];

    const data = await res.json();
    if (data.extract) {
      return [{
        title: data.title || query,
        snippet: data.extract,
        url: data.content_urls?.desktop?.page || '',
      }];
    }
    return [];
  } catch {
    return [];
  }
}

export function buildSearchContext(query: string, results: WebSearchResult[]): string {
  if (results.length === 0) return '';

  let context = `\n\n[Resultats de recherche web pour "${query}"]\n`;
  for (const r of results) {
    context += `- ${r.title}: ${r.snippet}\n`;
  }
  context += `\nUtilise ces informations si elles sont pertinentes. Si elles sont dated ou ne correspondent pas, combine-les avec tes connaissances.`;

  return context;
}

/**
 * Declaration `Tool` de la recherche web.
 * Elle delegue integralement a `webSearch()` : la logique de recherche
 * (DuckDuckGo, repli Wikipedia) n'est pas modifiee ici.
 */
export const webSearchTool: Tool = {
  name: 'web-search',
  description:
    'Recherche une information actualisee sur le web et retourne des resultats cites (titre, resume, source).',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Requete de recherche',
      },
      maxResults: {
        type: 'number',
        description: 'Nombre maximum de resultats (defaut 5)',
      },
    },
    required: ['query'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    const query = typeof args.query === 'string' ? args.query.trim() : '';
    if (!query) {
      return 'Erreur: requete de recherche vide';
    }

    const maxResults = typeof args.maxResults === 'number' ? args.maxResults : 5;
    const results = await webSearch(query, maxResults);

    if (results.length === 0) {
      return `Aucun resultat trouve pour "${query}".`;
    }

    return results.map((r) => `- ${r.title}: ${r.snippet} (${r.url})`).join('\n');
  },
};
