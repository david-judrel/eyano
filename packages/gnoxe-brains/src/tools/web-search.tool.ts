import { Tool } from './tool';

export interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
}

/** `fetch` remplacable (tests) ; aucune cle ni compte requis. */
type FetchLike = typeof fetch;

const USER_AGENT = 'Eyano/1.0 (assistant; recherche documentaire)';
const TIMEOUT_MS = 8000;

/**
 * Recherche gratuite, assemblee a partir de sources ouvertes, en parallele :
 *   - Wikipedia (vraie recherche, puis la section la plus pertinente) ;
 *   - actualites (flux RSS public : titres recents, date, source) ;
 *   - DuckDuckGo (reponses instantanees), en complement.
 * Une source en echec est ignoree ; jamais d'exception.
 */
export async function webSearch(
  query: string,
  maxResults: number = 5,
  fetchImpl: FetchLike = (...args) => fetch(...args)
): Promise<WebSearchResult[]> {
  const keywords = searchKeywords(query) || query.trim();
  if (!keywords) return [];

  const [wiki, news, ddg] = await Promise.all([
    searchWikipediaFull(keywords, fetchImpl).catch(() => []),
    searchNewsRss(keywords, fetchImpl).catch(() => []),
    searchDuckDuckGo(keywords, 2, fetchImpl).catch(() => []),
  ]);

  // Actualites d'abord (le plus recent), puis les faits, puis le complement.
  return [...news, ...wiki, ...ddg].slice(0, Math.max(1, maxResults));
}

// --------------------------------------------------------------- mots-cles

/** Mots vides (FR/EN) retires de la question pour former la requete. */
const STOPWORDS = new Set(
  (
    'le la les l un une des de du d au aux a à et ou en dans sur pour par avec sans ce cet cette ces ' +
    'mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs je tu il elle on nous vous ils elles ' +
    'me te se moi toi lui y est sont etait était ete été suis es sommes etes êtes avoir ai as ont ' +
    'quoi que qu qui quel quelle quels quelles quand comment pourquoi combien est-ce ' +
    'c ça ca cela ceci peux peut pouvez pourrais pourrait dis dit dire donne donner sais savoir connais ' +
    'stp svp please bro mec frere frère salut bonjour hey yo merci peux-tu ' +
    'the an of to in on for is are was what who when how which tell about'
  ).split(/\s+/)
);

/** « c'est quoi le dernier album de Fally Ipupa ? » -> « dernier album Fally Ipupa ». */
export function searchKeywords(question: string): string {
  return question
    .replace(/[’ʼ]/g, "'")
    .replace(/[?!.,;:«»"()[\]]/g, ' ')
    .split(/\s+/)
    .flatMap((word) => word.split("'"))
    .filter((word) => word && !STOPWORDS.has(word.toLowerCase()))
    .join(' ')
    .slice(0, 120)
    .trim();
}

// -------------------------------------------------------------- Wikipedia

/** Recherche plein texte, puis intro + section la plus pertinente des 2 meilleures pages. */
async function searchWikipediaFull(keywords: string, fetchImpl: FetchLike): Promise<WebSearchResult[]> {
  const api = 'https://fr.wikipedia.org/w/api.php';
  const search = await getJson(
    fetchImpl,
    `${api}?action=query&list=search&srsearch=${encodeURIComponent(keywords)}&srlimit=2&format=json&origin=*`
  );
  const titles: string[] = (search?.query?.search ?? []).map((r: any) => r.title).filter(Boolean);
  if (titles.length === 0) return [];

  const pages = await getJson(
    fetchImpl,
    `${api}?action=query&prop=extracts&explaintext=1&titles=${encodeURIComponent(titles.join('|'))}&format=json&origin=*`
  );
  const byTitle = new Map<string, string>();
  for (const page of Object.values<any>(pages?.query?.pages ?? {})) {
    if (page?.title && typeof page.extract === 'string') byTitle.set(page.title, page.extract);
  }

  const terms = keywords.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  return titles
    .filter((title) => byTitle.has(title))
    .map((title) => ({
      title: `Wikipedia : ${title}`,
      snippet: relevantExcerpt(byTitle.get(title)!, terms),
      url: `https://fr.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
    }));
}

/** Intro de la page + la section dont le titre ou le texte correspond le mieux aux termes. */
export function relevantExcerpt(text: string, terms: string[], max = 1500): string {
  const parts = text.split(/\n(?==+ )/);
  const intro = (parts[0] ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
  const asksForWorks = terms.some((t) => /album|chanson|film|titre|sorti|dernier|oeuvre|œuvre/.test(t));

  let best = '';
  let bestScore = 0;
  for (const section of parts.slice(1)) {
    const lower = section.toLowerCase();
    const heading = lower.split('\n')[0];
    let score = 0;
    for (const t of terms) {
      if (heading.includes(t)) score += 5;
      score += Math.min(3, lower.split(t).length - 1);
    }
    if (asksForWorks && /discograph|albums?|filmograph|oeuvres|œuvres/.test(heading)) score += 5;
    if (score > bestScore) {
      bestScore = score;
      best = section;
    }
  }

  const body = best
    .replace(/=+ ([^=]+) =+/g, '[$1]')
    .replace(/\n{2,}/g, '\n')
    .replace(/\n/g, ' ; ')
    .trim();
  return (body ? `${intro} ${body}` : intro).slice(0, max);
}

// ------------------------------------------------------- Actualites (RSS)

/** Flux RSS public : les titres les plus recents, avec date et source. */
async function searchNewsRss(keywords: string, fetchImpl: FetchLike): Promise<WebSearchResult[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(keywords)}&hl=fr&gl=FR&ceid=FR:fr`;
  const res = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) return [];
  const items = parseNewsRss(await res.text()).slice(0, 6);
  if (items.length === 0) return [];
  return [
    {
      title: 'Actualites recentes',
      snippet: items.map((i) => `${i.date} : ${i.title}`).join(' | '),
      url: items[0].link,
    },
  ];
}

const RSS_ITEM = /<item>([\s\S]*?)<\/item>/g;

function rssTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return (match?.[1] ?? '')
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

/** Elements d'un flux RSS : titre, date (AAAA-MM-JJ), lien ; les plus recents d'abord. */
export function parseNewsRss(xml: string): { title: string; date: string; link: string; time: number }[] {
  const items = [...xml.matchAll(RSS_ITEM)].map((m) => {
    const time = Date.parse(rssTag(m[1], 'pubDate'));
    return {
      title: rssTag(m[1], 'title'),
      link: rssTag(m[1], 'link'),
      time: Number.isNaN(time) ? 0 : time,
      date: Number.isNaN(time) ? '' : new Date(time).toISOString().slice(0, 10),
    };
  });
  return items.filter((i) => i.title).sort((a, b) => b.time - a.time);
}

async function getJson(fetchImpl: FetchLike, url: string): Promise<any> {
  const res = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) return null;
  return res.json();
}

async function searchDuckDuckGo(query: string, maxResults: number, fetchImpl: FetchLike): Promise<WebSearchResult[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const res = await fetchImpl(url, {
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

export function buildSearchContext(query: string, results: WebSearchResult[]): string {
  if (results.length === 0) return '';

  let context = `\n\n[Resultats de recherche web pour "${query}"]\n`;
  for (const r of results) {
    context += `- ${r.title}: ${r.snippet}\n`;
  }
  context += `\nCes resultats sont plus recents que tes connaissances : en cas de contradiction, ils l'emportent (sorties, dates, evenements). Appuie-toi sur eux quand ils sont pertinents et donne les dates ; s'ils ne repondent pas a la question, dis ce que tu sais en precisant que l'information peut avoir change.`;

  return context;
}

/**
 * Declaration `Tool` de la recherche web.
 * Elle delegue integralement a `webSearch()` : la logique de recherche
 * (Wikipedia, actualites, DuckDuckGo) n'est pas modifiee ici.
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
