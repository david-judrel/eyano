'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  FileWhatsAppHistoryStore,
  InMemoryWhatsAppHistoryStore,
} = require('../dist/modules/whatsapp/whatsapp.store.js');

const JID = '242061234567@s.whatsapp.net';

function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eyano-wa-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('chargement d un JID inconnu renvoie une liste vide', async () => {
  const store = new FileWhatsAppHistoryStore(path.join(os.tmpdir(), 'eyano-wa-missing'));
  assert.deepEqual(await store.load('inconnu@s.whatsapp.net'), []);
});

test('aller-retour save / load conserve le contexte durablement', async (t) => {
  const dir = tempDir(t);

  const store = new FileWhatsAppHistoryStore(dir);
  await store.save(JID, [
    { role: 'user', content: 'Bonjour' },
    { role: 'assistant', content: 'Salut !' },
  ]);

  // Un nouveau couple (dossier + store) simule un redemarrage du processus.
  const restarted = new FileWhatsAppHistoryStore(dir);
  assert.deepEqual(await restarted.load(JID), [
    { role: 'user', content: 'Bonjour' },
    { role: 'assistant', content: 'Salut !' },
  ]);

  const otherDir = tempDir(t);
  const elsewhere = new FileWhatsAppHistoryStore(otherDir);
  assert.deepEqual(await elsewhere.load(JID), []);
});

test('les images ne sont pas persistees (base64 trop volumineux)', async (t) => {
  const dir = tempDir(t);
  const store = new FileWhatsAppHistoryStore(dir);

  await store.save(JID, [
    { role: 'user', content: 'Regarde', images: [{ mimeType: 'image/jpeg', data: 'AAAA' }] },
  ]);

  const loaded = await store.load(JID);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].content, 'Regarde');
  assert.equal(loaded[0].images, undefined);

  const raw = fs.readFileSync(path.join(dir, fs.readdirSync(dir)[0]), 'utf8');
  assert.ok(!raw.includes('AAAA'), 'les donnees base64 doivent rester en memoire uniquement');
});

test('un fichier corrompu est ignore au lieu de planter le service', async (t) => {
  const dir = tempDir(t);
  const store = new FileWhatsAppHistoryStore(dir);

  const safe = JID.replace(/[^a-zA-Z0-9._-]/g, '_');
  fs.writeFileSync(path.join(dir, `${safe}.json`), '{ pas du json', 'utf-8');

  assert.deepEqual(await store.load(JID), []);
});

test('les JIDs sont sanitises pour ne pas creer de chemin arbitraire', async (t) => {
  const dir = tempDir(t);
  const store = new FileWhatsAppHistoryStore(dir);

  await store.save('../../etc/evil', [{ role: 'user', content: 'x' }]);

  const files = fs.readdirSync(dir);
  assert.equal(files.length, 1);
  assert.ok(!files[0].includes('/'), 'aucun separateur de chemin accepte');
  assert.ok(!files[0].includes('\\'), 'aucun separateur de chemin accepte');
  assert.ok(files[0].endsWith('.json'));

  // Le fichier reste bien dans le dossier cible, meme pour un JID hostile.
  const resolved = path.resolve(dir, files[0]);
  assert.ok(resolved.startsWith(path.resolve(dir) + path.sep), 'ecriture confinee au dossier');
});

test('les histos de deux JIDs sont isoles', async (t) => {
  const store = new FileWhatsAppHistoryStore(tempDir(t));

  await store.save('a@s.whatsapp.net', [{ role: 'user', content: 'A' }]);
  await store.save('b@s.whatsapp.net', [{ role: 'user', content: 'B' }]);

  assert.deepEqual(await store.load('a@s.whatsapp.net'), [{ role: 'user', content: 'A' }]);
  assert.deepEqual(await store.load('b@s.whatsapp.net'), [{ role: 'user', content: 'B' }]);
});

test('l implementation memoire respecte le meme contrat', async () => {
  const store = new InMemoryWhatsAppHistoryStore();

  assert.deepEqual(await store.load(JID), []);
  await store.save(JID, [{ role: 'user', content: 'Salut', images: [{ mimeType: 'image/png', data: 'BB' }] }]);
  assert.deepEqual(await store.load(JID), [{ role: 'user', content: 'Salut' }]);
  assert.deepEqual(await store.load('autre@s.whatsapp.net'), []);
});

test('whatsapp.service : contexte transmis a chatFlowSync', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'modules', 'whatsapp', 'whatsapp.service.ts'),
    'utf8'
  );

  assert.ok(source.includes("channel: 'whatsapp'"), 'canal WhatsApp transmis');
  assert.ok(source.includes('userName'), 'nom du contact transmis');
  assert.ok(source.includes('WhatsAppHistoryStore'), 'persistance via abstraction');
  assert.ok(source.includes('MAX_HISTORY'), 'historique borne');

  const imports = [
    ...source.matchAll(/\bimport\s*\{([^}]*)\}\s*from\s*['"]@eyano\/gnoxe-brains['"]/g),
  ]
    .flatMap((m) => m[1].split(','))
    .map((s) => s.trim())
    .filter(Boolean);
  assert.deepEqual(imports, ['chatFlowSync'], 'aucun nouveau symbole importe par WhatsApp');
});

// ------------------------------------------------- etape 41 : coordonnees

const {
  appendBounded,
  resolveStoredHistory,
} = require('../dist/modules/whatsapp/whatsapp.store.js');
const { buildChatContext } = require('@eyano/gnoxe-brains');

test('e41 : le tour reel du premier message est persiste', async (t) => {
  const dir = tempDir(t);
  const store = new FileWhatsAppHistoryStore(dir);

  await store.save(JID, [{ role: 'user', content: 'x' }], 11);
  const restarted = new FileWhatsAppHistoryStore(dir);

  assert.deepEqual(await restarted.loadHistory(JID), {
    messages: [{ role: 'user', content: 'x' }],
    firstTurn: 11,
  });
  assert.deepEqual(await restarted.load(JID), [{ role: 'user', content: 'x' }], 'load inchange');
});

test('e41 : ancien format (tableau) lu sans coordonnees', async (t) => {
  const dir = tempDir(t);
  const safe = JID.replace(/[^a-zA-Z0-9._-]/g, '_');
  fs.writeFileSync(path.join(dir, `${safe}.json`), JSON.stringify([{ role: 'user', content: 'ancien' }]));

  const loaded = await new FileWhatsAppHistoryStore(dir).loadHistory(JID);
  assert.deepEqual(loaded, { messages: [{ role: 'user', content: 'ancien' }] });
  assert.equal(loaded.firstTurn, undefined);
});

test('e41 : coordonnees de l ancien format', () => {
  const short = { messages: [{ role: 'user', content: 'a' }] };
  const full = { messages: Array.from({ length: 30 }, () => ({ role: 'user', content: 'a' })) };

  assert.equal(resolveStoredHistory(short, 30).firstTurn, 1, 'jamais tronque');
  assert.equal(resolveStoredHistory(full, 30).firstTurn, null, 'peut-etre tronque, sans trace');
  assert.equal(resolveStoredHistory({ messages: [], firstTurn: 7 }, 30).firstTurn, 7);
  assert.equal(resolveStoredHistory({ messages: [], firstTurn: null }, 30).firstTurn, null);
});

test('e41 : la troncature decale le premier tour du nombre de questions retirees', () => {
  const history = { messages: [], firstTurn: 1 };
  for (let turn = 1; turn <= 24; turn += 1) {
    appendBounded(history, { role: 'user', content: `q${turn}` }, 30);
    appendBounded(history, { role: 'assistant', content: `r${turn}` }, 30);
  }
  appendBounded(history, { role: 'user', content: 'q25' }, 30);

  assert.equal(history.messages.length, 30);
  assert.equal(history.messages[0].content, 'r10', 'reponse orpheline du tour 10');
  assert.equal(history.firstTurn, 11, 'premiere question conservee : tour 11');
  assert.equal(history.messages[1].content, 'q11');
});

test('e41 : numerotation inconnue reste inconnue', () => {
  const history = { messages: [], firstTurn: null };
  for (let i = 0; i < 40; i += 1) appendBounded(history, { role: 'user', content: `q${i}` }, 30);
  assert.equal(history.firstTurn, null);
});

test('e41 : bout en bout, le tour 12 reel rend la question du tour 12', () => {
  const history = { messages: [], firstTurn: 1 };
  for (let turn = 1; turn <= 24; turn += 1) {
    appendBounded(history, { role: 'user', content: `question du tour ${turn}` }, 30);
    appendBounded(history, { role: 'assistant', content: `reponse du tour ${turn}` }, 30);
  }
  appendBounded(history, { role: 'user', content: "Qu'est-ce que je t'ai demandé au tour 20 ?" }, 30);

  const context = buildChatContext(history.messages, 20, undefined, 'whatsapp', 'VOIX', {
    historyCoverage: { firstTurn: history.firstTurn },
  });
  const last = context[context.length - 1].content;

  assert.ok(last.includes('Status: FOUND'), 'tour 20 visible');
  assert.ok(last.includes('"question du tour 20"'));
  assert.ok(context[0].content.includes("d'une conversation de 25 tours"));
});

test('e41 : le service declare la couverture au cerveau', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'modules', 'whatsapp', 'whatsapp.service.ts'),
    'utf8'
  );
  assert.ok(source.includes('historyCoverage: { firstTurn: history.firstTurn }'));
  assert.ok(source.includes('appendBounded(history, message, MAX_HISTORY)'));
  assert.ok(source.includes('this.store.save(jid, history.messages, history.firstTurn)'));
});
