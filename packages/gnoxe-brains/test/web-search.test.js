'use strict';

/**
 * Recherche gratuite (Wikipedia, actualites RSS, DuckDuckGo) : sans reseau,
 * avec un `fetch` simule.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { webSearch, searchKeywords, parseNewsRss, relevantExcerpt, buildSearchContext } = require('../dist/tools/web-search.tool.js');

const RSS = `<rss><channel>
<item><title>XX Delirium de Fally Ipupa, un hommage - ACP</title><link>https://news.example/2</link><pubDate>Wed, 23 Sep 2026 08:00:00 GMT</pubDate></item>
<item><title><![CDATA[Fally Ipupa voit double avec &quot;XX&quot; - RFI]]></title><link>https://news.example/1</link><pubDate>Fri, 17 Apr 2026 08:00:00 GMT</pubDate></item>
</channel></rss>`;

const WIKI_TEXT = "Fally Ipupa est un chanteur congolais.\n\n== Biographie ==\nNe a Kinshasa.\n\n== Discographie ==\n\n=== Albums solo ===\n2022 : Formule 7\n2026 : XX\n2026 : XX : Délirium\n\n== Distinctions ==\nPlusieurs prix.";

function fakeFetch(overrides = {}) {
  const calls = [];
  const impl = async (url) => {
    calls.push(url);
    for (const [pattern, handler] of Object.entries(overrides)) if (url.includes(pattern)) return handler(url);
    if (url.includes('list=search')) return Response.json({ query: { search: [{ title: 'Fally Ipupa' }] } });
    if (url.includes('prop=extracts')) return Response.json({ query: { pages: { 1: { title: 'Fally Ipupa', extract: WIKI_TEXT } } } });
    if (url.includes('news.google.com')) return new Response(RSS, { status: 200 });
    if (url.includes('duckduckgo')) return Response.json({});
    return new Response('', { status: 404 });
  };
  return { calls, impl };
}

test('mots-cles : la question devient une requete', () => {
  assert.equal(searchKeywords("c'est quoi le dernier album de Fally Ipupa ?"), 'dernier album Fally Ipupa');
  assert.equal(searchKeywords('Quel est le prix du riz à Kinshasa'), 'prix riz Kinshasa');
});

test('RSS : titres decodes, dates, plus recents d abord', () => {
  const items = parseNewsRss(RSS);
  assert.deepEqual(items.map((i) => [i.date, i.title]), [
    ['2026-09-23', 'XX Delirium de Fally Ipupa, un hommage - ACP'],
    ['2026-04-17', 'Fally Ipupa voit double avec "XX" - RFI'],
  ]);
});

test('Wikipedia : intro + section la plus pertinente (discographie pour un album)', () => {
  const excerpt = relevantExcerpt(WIKI_TEXT, ['dernier', 'album', 'fally', 'ipupa']);
  assert.match(excerpt, /^Fally Ipupa est un chanteur congolais\./);
  assert.match(excerpt, /2026 : XX : Délirium/);
  assert.doesNotMatch(excerpt, /Distinctions/);
});

test('recherche : actualites puis Wikipedia, requetes construites sur les mots-cles', async () => {
  const http = fakeFetch();
  const results = await webSearch('Quel est le dernier album de Fally Ipupa ?', 5, http.impl);

  assert.equal(results[0].title, 'Actualites recentes');
  assert.match(results[0].snippet, /^2026-09-23 : XX Delirium/);
  assert.equal(results[1].title, 'Wikipedia : Fally Ipupa');
  assert.match(results[1].snippet, /2026 : XX/);
  assert.ok(http.calls.some((u) => u.includes('news.google.com/rss/search?q=dernier%20album%20Fally%20Ipupa')));

  const context = buildSearchContext('dernier album', results);
  assert.match(context, /plus recents que tes connaissances/);
});

test('recherche : une source en panne est ignoree, jamais d exception', async () => {
  const http = fakeFetch({
    'news.google.com': () => { throw new Error('reseau'); },
    'list=search': () => new Response('', { status: 503 }),
  });
  const results = await webSearch('dernier album Fally Ipupa', 5, http.impl);
  assert.deepEqual(results, []);
});

test('Wikipedia : fautes de frappe -> suggestion, puis n importe lequel des mots', async () => {
  const searches = [];
  const http = fakeFetch({
    'list=search': (url) => {
      const q = decodeURIComponent(new URL(url).searchParams.get('srsearch'));
      searches.push(q);
      if (q === 'dernie albul fallu ipupa') return Response.json({ query: { search: [], searchinfo: { suggestion: 'dernie album fally ipupa' } } });
      if (q.includes(' OR ')) return Response.json({ query: { search: [{ title: 'Fally Ipupa' }] } });
      return Response.json({ query: { search: [] } });
    },
  });
  const results = await webSearch("c'est uoi le dernie albul de fallu ipupa", 5, http.impl);

  assert.deepEqual(searches, ['uoi dernie albul fallu ipupa', ...searches.slice(1)]);
  assert.ok(searches.includes('dernie OR album OR fally OR ipupa') || searches.some((q) => q.includes(' OR ')), 'repli OR');
  assert.ok(results.some((r) => r.title === 'Wikipedia : Fally Ipupa'));
});
