'use strict';

/**
 * Kepler Image sur WhatsApp : le vrai service (dist/), un faux socket et un
 * faux moteur d'images ; aucun reseau, aucune connexion WhatsApp.
 */

process.env.KEPLER_IMAGE_ENABLED = 'true';
delete process.env.KEPLER_IMAGE_EDIT_ENABLED;

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { GnoxeBrains, setGnoxeBrains } = require('@eyano/gnoxe-brains');
const { WhatsAppService } = require(path.join(__dirname, '..', 'dist', 'modules', 'whatsapp', 'whatsapp.service.js'));
const { InMemoryWhatsAppHistoryStore } = require(path.join(__dirname, '..', 'dist', 'modules', 'whatsapp', 'whatsapp.store.js'));
const { KEPLER_EDIT_UNSUPPORTED_TEXT, KEPLER_IMAGE_MARKER } = require(path.join(__dirname, '..', 'dist', 'modules', 'image', 'kepler-chat.js'));

const PNG = Buffer.from('PNG!');
const JID = '33600000000@s.whatsapp.net';

function setup() {
  const prompts = [];
  setGnoxeBrains(new GnoxeBrains({
    modelProvider: {
      name: 'faux',
      capabilities: () => ({ streaming: false, structuredOutput: false, images: false, imageGeneration: true, models: [] }),
      async generate() { throw new Error('le chat ne doit pas etre appele'); },
      async *stream() {},
      async structuredOutput() { return {}; },
      async generateImage(request) { prompts.push(request.prompt); return { data: PNG.toString('base64'), mimeType: 'image/png', model: 'kepler-image-1', provider: 'faux' }; },
    },
  }));

  const service = new WhatsAppService();
  const sent = [];
  service.sock = {
    async sendMessage(jid, content) { sent.push({ jid, content }); },
    async sendPresenceUpdate() {},
  };
  service.store = new InMemoryWhatsAppHistoryStore();
  return { service, sent, prompts };
}

const text = (body) => ({ key: { remoteJid: JID, fromMe: false }, pushName: 'Awa', message: { conversation: body } });

test('whatsapp : une demande d image renvoie l image avec sa legende', { timeout: 30_000 }, async () => {
  const { service, sent, prompts } = setup();
  await service.handleMessage(text('génère une image d un médecin dans un hôpital'));

  assert.equal(prompts.length, 1);
  assert.match(prompts[0], /dark-skinned person$/, 'representation par defaut appliquee');
  assert.equal(sent.length, 1);
  assert.deepEqual(Buffer.from(sent[0].content.image), PNG);
  assert.equal(sent[0].content.mimetype, 'image/png');
  assert.equal(sent[0].content.caption, "Voici l'image générée.");

  const history = await service.getHistory(JID);
  assert.equal(history.messages.at(-1).content, `Voici l'image générée. ${KEPLER_IMAGE_MARKER}`, 'marque, jamais les octets');
});

test('whatsapp : une retouche juste apres une image est refusee, sans generation', { timeout: 30_000 }, async () => {
  const { service, sent, prompts } = setup();
  await service.handleMessage(text('génère une image de chat'));
  await service.handleMessage(text('plus réaliste'));

  assert.equal(prompts.length, 1, 'aucune seconde generation');
  assert.equal(sent.at(-1).content.text, KEPLER_EDIT_UNSUPPORTED_TEXT);
});
