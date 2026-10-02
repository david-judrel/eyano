'use strict';

/**
 * Kepler Image dans le chat (experimental) : detection deterministe d'une
 * demande d'image, drapeau, et enregistrement de l'image (moteur et base
 * remplaces par des faux injectes).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  detectImageRequest,
  shouldUseKepler,
  runKeplerInChat,
  keplerFailureText,
  KEPLER_SUCCESS_TEXT,
  MAX_KEPLER_IMAGE_BYTES,
} = require(path.join(__dirname, '..', 'dist', 'modules', 'image', 'kepler-chat.js'));
const { ImageGenerationError } = require('@eyano/gnoxe-brains');

// ---------------------------------------------------------------- detection

test('detection : demandes d image reconnues', () => {
  for (const message of [
    'Génère une image de chat roux',
    'genere moi une image de montagne',
    'Crée un logo pour ma boulangerie',
    'Dessine-moi un mouton',
    'fais une belle illustration de Paris la nuit',
    "Crée-moi une affiche pour un concert",
    'Generate an image of a red fox',
    'draw me a picture of the sea',
    'tu peux me genre une image de chien?',
    'Tu peux me générer une image de chien ?',
    'Peux-tu créer une image de plage ?',
    'Est-ce que tu peux dessiner un portrait de chat ?',
    'Can you generate an image of a dog?',
    "Genere moi l'image d'un mouton",
    'Génère-moi la photo d un coucher de soleil',
    'crée le logo de mon entreprise',
  ]) {
    assert.equal(detectImageRequest(message), true, message);
  }
});

test('detection : conversations ordinaires ignorees', () => {
  for (const message of [
    'Bonjour, comment vas-tu ?',
    'Comment générer une image avec Python ?',
    'Quel genre de musique aimes-tu ?',
    'Tu peux me donner un exemple ?',
    "Décris-moi l'image que tu imagines",
    'Fais le résumé de ce texte',
    'Explique-moi ce qu est une image Docker',
    'Peux-tu résumer ce document ?',
    'How do I create an image in Docker?',
    'Crée un plan de projet',
    '',
  ]) {
    assert.equal(detectImageRequest(message), false, message);
  }
  assert.equal(detectImageRequest(undefined), false);
});

test('drapeau : coupe, Kepler ne prend jamais la main', () => {
  assert.equal(shouldUseKepler('Génère une image de chat', {}), false);
  assert.equal(shouldUseKepler('Génère une image de chat', { KEPLER_IMAGE_ENABLED: 'false' }), false);
  assert.equal(shouldUseKepler('Génère une image de chat', { KEPLER_IMAGE_ENABLED: 'true' }), true);
  assert.equal(shouldUseKepler('Bonjour', { KEPLER_IMAGE_ENABLED: 'true' }), false);
});

// ------------------------------------------------------------ enregistrement

function fakeDb() {
  const created = [];
  return {
    created,
    attachment: {
      async create({ data, select }) {
        created.push(data);
        const row = { id: `att-${created.length}`, ...data };
        return Object.fromEntries(Object.keys(select).map((key) => [key, row[key]]));
      },
    },
  };
}

test('succes : image enregistree sur le message, octets jamais renvoyes', async () => {
  const db = fakeDb();
  const generate = async () => ({ data: Buffer.from('PNG!').toString('base64'), mimeType: 'image/png' });
  const outcome = await runKeplerInChat('Génère une image', 'msg-1', { generate, db });

  assert.equal(outcome.text, KEPLER_SUCCESS_TEXT);
  assert.deepEqual(outcome.attachment, { id: 'att-1', fileName: 'kepler-image.png', mimeType: 'image/png', size: 4 });
  assert.equal(db.created[0].messageId, 'msg-1');
  assert.equal(db.created[0].storageKey, 'db:kepler');
  assert.equal(db.created[0].data.toString(), 'PNG!');
});

test('echec du moteur : reponse d Eyano, rien en base', async () => {
  const db = fakeDb();
  const generate = async () => {
    throw new ImageGenerationError('QUOTA_EXHAUSTED', 'quota');
  };
  const outcome = await runKeplerInChat('Génère une image', 'msg-1', { generate, db });

  assert.equal(outcome.code, 'QUOTA_EXHAUSTED');
  assert.equal(outcome.text, keplerFailureText('QUOTA_EXHAUSTED'));
  assert.equal(outcome.attachment, undefined);
  assert.equal(db.created.length, 0);
});

test('erreur inattendue : code FAILED, ne leve jamais', async () => {
  const db = fakeDb();
  const outcome = await runKeplerInChat('x', 'msg-1', { generate: async () => { throw new Error('boom'); }, db });
  assert.equal(outcome.code, 'FAILED');
  assert.equal(db.created.length, 0);
});

test('image vide ou trop lourde : refusee, rien en base', async () => {
  const db = fakeDb();
  const empty = await runKeplerInChat('x', 'm', { generate: async () => ({ data: '', mimeType: 'image/png' }), db });
  assert.equal(empty.code, 'NO_IMAGE');

  const huge = Buffer.alloc(MAX_KEPLER_IMAGE_BYTES + 1).toString('base64');
  const big = await runKeplerInChat('x', 'm', { generate: async () => ({ data: huge, mimeType: 'image/png' }), db });
  assert.equal(big.code, 'TOO_LARGE');
  assert.equal(db.created.length, 0);
});
