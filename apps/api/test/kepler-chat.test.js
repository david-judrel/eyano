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
  planKepler,
  imageThread,
  detectImageFollowUp,
  keplerChatNote,
  historyContentForChat,
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
    "Génère moi une imag relaist d'un mc musclé et humain",
    'gnere une image de lion',
    'fais une phot de la tour eiffel',
    'génère un iamge de voiture',
    'dessine un portait de femme',
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
    'Crée un mage pour ma campagne de jeu de rôle',
    'mais une image vaut mille mots',
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

test('mode image choisi dans l interface : Kepler, sans detection', () => {
  const on = { KEPLER_IMAGE_ENABLED: 'true' };
  assert.equal(shouldUseKepler('un mouton sur la lune', on, 'image'), true);
  assert.equal(shouldUseKepler('un mouton sur la lune', on), false);
  assert.equal(shouldUseKepler('un mouton sur la lune', {}, 'image'), false, 'drapeau coupe : jamais');
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

// ------------------------------------------------- suite d'une image (contexte)

const ON = { KEPLER_IMAGE_ENABLED: 'true' };
const user = (content) => ({ role: 'user', content, attachments: [] });
const image = () => ({ role: 'assistant', content: "Voici l'image générée.", attachments: [{ storageKey: 'db:kepler' }] });
const reply = (content) => ({ role: 'assistant', content, attachments: [] });

test('retouche : « fais le plus mieux » apres une image reprend la demande d origine', () => {
  const history = [user("Génère moi une imag relaist d'un mc musclé et humain"), image()];
  const plan = planKepler('fais le plus mieux', history, undefined, ON);
  assert.ok(plan, 'Kepler doit prendre la main');
  assert.match(plan.prompt, /mc musclé et humain/);
  assert.match(plan.prompt, /fais le plus mieux/);
});

test('retouches successives : toute la chaine, dans l ordre', () => {
  const history = [user('génère une image de chat'), image(), user('plus réaliste'), image()];
  assert.deepEqual(imageThread(history), ['génère une image de chat', 'plus réaliste']);
  const plan = planKepler('ajoute un chapeau', history, undefined, ON);
  assert.match(plan.prompt, /^génère une image de chat\. Modifications demandées, dans l'ordre : plus réaliste ; ajoute un chapeau$/);
});

test('retouche : jamais si la derniere reponse n est pas une image', () => {
  const history = [user('génère une image de chat'), image(), user('merci'), reply('Avec plaisir !')];
  assert.equal(planKepler('plus réaliste', history, undefined, ON), null);
});

test('apres une image, une vraie question reste au chat', () => {
  const history = [user('génère une image de chat'), image()];
  for (const message of ['merci beaucoup', 'c est qui ce chat ?', 'explique-moi la photosynthèse', 'comment tu as fait ?']) {
    assert.equal(planKepler(message, history, undefined, ON), null, message);
  }
});

test('apres une image, une nouvelle demande complete repart de zero', () => {
  const history = [user('génère une image de chat'), image()];
  assert.deepEqual(planKepler('génère une image de voiture rouge', history, undefined, ON), { prompt: 'génère une image de voiture rouge' });
});

test('detection des retouches', () => {
  for (const message of ['fais le plus mieux', 'plus réaliste', 'change le fond', 'ajoute un chapeau', 'refais-le', 'en noir avec un sourire', 'make it brighter']) {
    assert.equal(detectImageFollowUp(message), true, message);
  }
  for (const message of ['merci', 'ok', 'super', 'qui est-ce ?']) {
    assert.equal(detectImageFollowUp(message), false, message);
  }
});

test('drapeau coupe : aucune retouche, aucune consigne', () => {
  const history = [user('génère une image de chat'), image()];
  assert.equal(planKepler('plus réaliste', history, undefined, {}), null);
  assert.equal(keplerChatNote({}), '');
});

test('le chat sait qu il cree des images et voit lesquelles', () => {
  assert.match(keplerChatNote(ON), /Kepler/);
  assert.match(keplerChatNote(ON), /Ne dis jamais que tu ne peux pas/);
  assert.equal(historyContentForChat(image()), "Voici l'image générée. [Image créée par Kepler]");
  assert.equal(historyContentForChat(reply('Bonjour')), 'Bonjour');
});
