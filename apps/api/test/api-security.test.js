'use strict';

/**
 * Etape 46 : invariants de securite de l'API (authentification, propriete).
 *
 * Aucune base reelle : `@eyano/database` est remplace, AVANT tout chargement,
 * par un faux Prisma en memoire. Controleurs, services et gardes sont ceux
 * de `dist/`, sans aucune modification de production.
 *
 * Resultats ATTENDUS, figes avant execution :
 *   I1  B ne lit, ne liste, ne modifie ni ne supprime une conversation de A.
 *   I2  B ne lit ni n'ajoute de message dans une conversation de A.
 *   I3  B ne peut pas utiliser chat, chat/stream ni regenerate sur une
 *       conversation de A.
 *   I4  B ne liste ni n'ajoute de piece jointe sur un message de A.
 *       (suspicion issue de la lecture du code : FilesService ne recoit pas
 *       l'utilisateur ; un echec ici DEMONTRE la faille)
 *   I5  sans jeton, avec un jeton invalide, ou avec un compte non ACTIVE :
 *       refuse ; identite et role relus en base, jamais pris du jeton.
 *   I6  seul un SUPER_ADMIN change un role ; personne ne modifie son propre
 *       role ni son propre statut.
 *   (I7, statut d'un SUPER_ADMIN par un ADMIN : choix fonctionnel, non teste.)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// ------------------------------------------------------------ faux Prisma

function createFakePrisma() {
  const tables = { user: [], conversation: [], message: [], attachment: [], auditLog: [] };
  let sequence = 0;

  const matches = (row, where = {}) =>
    Object.entries(where).every(([key, value]) =>
      value !== null && typeof value === 'object' && !(value instanceof Date) ? true : row[key] === value
    );

  function model(name) {
    const rows = tables[name];
    return {
      async findUnique({ where }) {
        return rows.find((row) => matches(row, where)) ?? null;
      },
      async findFirst({ where } = {}) {
        return rows.find((row) => matches(row, where)) ?? null;
      },
      async findMany({ where } = {}) {
        return rows.filter((row) => matches(row, where)).map((row) => ({ attachments: [], aiRequests: [], ...row }));
      },
      async count({ where } = {}) {
        return rows.filter((row) => matches(row, where)).length;
      },
      async create({ data }) {
        const row = { id: `${name}-${++sequence}`, createdAt: new Date(), ...data };
        rows.push(row);
        return row;
      },
      async update({ where, data }) {
        const row = rows.find((candidate) => matches(candidate, where));
        if (!row) throw new Error(`${name} introuvable`);
        Object.assign(row, data);
        return row;
      },
      async delete({ where }) {
        const index = rows.findIndex((candidate) => matches(candidate, where));
        if (index < 0) throw new Error(`${name} introuvable`);
        return rows.splice(index, 1)[0];
      },
      async aggregate() {
        return { _sum: {} };
      },
    };
  }

  return {
    tables,
    user: model('user'),
    conversation: model('conversation'),
    message: model('message'),
    attachment: model('attachment'),
    auditLog: model('auditLog'),
  };
}

const prisma = createFakePrisma();
const databasePath = require.resolve('@eyano/database', { paths: [path.join(__dirname, '..')] });
require.cache[databasePath] = {
  id: databasePath,
  filename: databasePath,
  loaded: true,
  exports: { prisma },
};

// --------------------------------------------- code de production (dist/)

const dist = (file) => require(path.join(__dirname, '..', 'dist', file));
const { generateToken } = require('@eyano/auth');
const { AuthGuard } = dist('guards/auth.guard.js');
const { SuperAdminGuard } = dist('guards/admin.guard.js');
const { ConversationsService } = dist('modules/conversations/conversations.service.js');
const { ConversationsController } = dist('modules/conversations/conversations.controller.js');
const { MessagesService } = dist('modules/messages/messages.service.js');
const { MessagesController } = dist('modules/messages/messages.controller.js');
const { FilesService } = dist('modules/files/files.service.js');
const { FilesController } = dist('modules/files/files.controller.js');
const { AiService } = dist('modules/ai/ai.service.js');
const { AiController } = dist('modules/ai/ai.controller.js');
const { AdminService } = dist('modules/admin/admin.service.js');
const { AdminController } = dist('modules/admin/admin.controller.js');

// ---------------------------------------------------------------- donnees

const A = { id: 'user-A', email: 'a@test', role: 'USER', status: 'ACTIVE', name: 'A' };
const B = { id: 'user-B', email: 'b@test', role: 'USER', status: 'ACTIVE', name: 'B' };
const ADMIN = { id: 'user-admin', email: 'admin@test', role: 'ADMIN', status: 'ACTIVE' };
const SUPER = { id: 'user-super', email: 'super@test', role: 'SUPER_ADMIN', status: 'ACTIVE' };
const SUSPENDED = { id: 'user-sus', email: 'sus@test', role: 'USER', status: 'SUSPENDED' };
prisma.tables.user.push(A, B, ADMIN, SUPER, SUSPENDED);

const conversationA = { id: 'conv-A', userId: A.id, title: 'secret de A', archived: false };
prisma.tables.conversation.push(conversationA);
const messageA = { id: 'msg-A', conversationId: conversationA.id, role: 'user', content: 'contenu de A' };
prisma.tables.message.push(messageA);
const attachmentA = { id: 'att-A', messageId: messageA.id, fileName: 'contrat-A.pdf', mimeType: 'application/pdf', size: 10, storageKey: 'uploads/msg-A/contrat-A.pdf' };
prisma.tables.attachment.push(attachmentA);
const keplerImageA = { id: 'att-kepler-A', messageId: messageA.id, fileName: 'kepler-image.png', mimeType: 'image/png', size: 4, storageKey: 'db:kepler', data: Buffer.from('PNG!') };
prisma.tables.attachment.push(keplerImageA);

const req = (user) => ({ user: { userId: user.id, email: user.email, role: user.role } });
const httpContext = (request) => ({ switchToHttp: () => ({ getRequest: () => request }) });
const audit = { async log() {} };

const conversations = new ConversationsController(new ConversationsService());
const messagesService = new MessagesService();
const messages = new MessagesController(messagesService);
const files = new FilesController(new FilesService());
const aiService = new AiService(messagesService, { async record() {} }, { async create() {} });
const ai = new AiController(aiService, audit);
const admin = new AdminController(new AdminService(), audit);

// --------------------------------------------------------------------- I1

test('I1 : A accede a sa conversation (temoin)', async () => {
  const found = await conversations.findOne(conversationA.id, req(A));
  assert.equal(found.id, conversationA.id);
});

test('I1 : B ne lit pas la conversation de A', async () => {
  await assert.rejects(conversations.findOne(conversationA.id, req(B)));
});

test('I1 : la liste de B ne contient pas la conversation de A', async () => {
  const list = await conversations.findAll(req(B));
  const ids = (Array.isArray(list) ? list : list.conversations ?? list.data ?? []).map((c) => c.id);
  assert.equal(ids.includes(conversationA.id), false);
});

test('I1 : B ne modifie ni ne supprime la conversation de A', async () => {
  await assert.rejects(conversations.update(conversationA.id, req(B), { title: 'pirate' }));
  await assert.rejects(conversations.remove(conversationA.id, req(B)));
  assert.equal(conversationA.title, 'secret de A');
  assert.ok(prisma.tables.conversation.includes(conversationA));
});

// --------------------------------------------------------------------- I2

test('I2 : B ne lit pas les messages de A', async () => {
  await assert.rejects(messages.findAll(conversationA.id, req(B)));
});

test('I2 : B n ajoute pas de message dans la conversation de A', async () => {
  const before = prisma.tables.message.length;
  await assert.rejects(messages.create(conversationA.id, { content: 'intrus' }, req(B)));
  assert.equal(prisma.tables.message.length, before);
});

// --------------------------------------------------------------------- I3

test('I3 : B ne peut pas chatter dans la conversation de A', async () => {
  await assert.rejects(ai.chat(req(B), { conversationId: conversationA.id, message: 'x' }));
});

test('I3 : B ne peut pas streamer dans la conversation de A', async () => {
  const chunks = [];
  for await (const chunk of aiService.chatStream(B.id, conversationA.id, 'x')) chunks.push(chunk);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].type, 'error');
  assert.equal(chunks[0].code, 'CONVERSATION_NOT_FOUND');
});

test('I3 : B ne peut pas regenerer dans la conversation de A', async () => {
  await assert.rejects(ai.regenerate(req(B), { conversationId: conversationA.id }));
});

// --------------------------------------------------------------------- I4

test('I4 : B ne liste pas les pieces jointes d un message de A', async () => {
  await assert.rejects(
    Promise.resolve().then(() => files.findByMessage(messageA.id, req(B))),
    'B a obtenu les pieces jointes de A'
  );
});

test('I4 : B n ajoute pas de piece jointe a un message de A', async () => {
  const before = prisma.tables.attachment.length;
  const file = { originalname: 'intrus.pdf', mimetype: 'application/pdf', size: 10 };
  await assert.rejects(
    Promise.resolve().then(() => files.upload(messageA.id, file, req(B))),
    'B a attache un fichier au message de A'
  );
  assert.equal(prisma.tables.attachment.length, before);
});

function fakeResponse() {
  const res = { headers: {}, body: null };
  res.setHeader = (key, value) => { res.headers[key] = value; };
  res.end = (body) => { res.body = body; };
  return res;
}

test('I4 : A lit le contenu de son image Kepler (temoin)', async () => {
  const res = fakeResponse();
  await files.content(keplerImageA.id, req(A), res);
  assert.equal(res.headers['Content-Type'], 'image/png');
  assert.equal(res.body.toString(), 'PNG!');
});

test('I4 : B ne lit pas le contenu d une image Kepler de A', async () => {
  const res = fakeResponse();
  await assert.rejects(
    Promise.resolve().then(() => files.content(keplerImageA.id, req(B), res)),
    'B a lu l image de A'
  );
  assert.equal(res.body, null);
});

test('I4 : une piece jointe sans octets en base n a pas de contenu', async () => {
  await assert.rejects(Promise.resolve().then(() => files.content(attachmentA.id, req(A), fakeResponse())));
});

// --------------------------------------------------------------------- I5

test('I5 : sans jeton -> refuse', async () => {
  await assert.rejects(new AuthGuard().canActivate(httpContext({ headers: {} })));
});

test('I5 : jeton invalide -> refuse', async () => {
  await assert.rejects(
    new AuthGuard().canActivate(httpContext({ headers: { authorization: 'Bearer pas-un-jeton' } }))
  );
});

test('I5 : compte non ACTIVE -> refuse', async () => {
  const token = generateToken({ userId: SUSPENDED.id, email: SUSPENDED.email, role: SUSPENDED.role });
  await assert.rejects(
    new AuthGuard().canActivate(httpContext({ headers: { authorization: `Bearer ${token}` } }))
  );
});

test('I5 : identite et role relus en base, jamais pris du jeton', async () => {
  const forged = generateToken({ userId: A.id, email: 'autre@test', role: 'SUPER_ADMIN' });
  const request = { headers: { authorization: `Bearer ${forged}` } };
  assert.equal(await new AuthGuard().canActivate(httpContext(request)), true);
  assert.deepEqual(request.user, { userId: A.id, email: A.email, role: 'USER' });
});

// --------------------------------------------------------------------- I6

test('I6 : un ADMIN ne change pas un role (SuperAdminGuard)', () => {
  assert.throws(() => new SuperAdminGuard().canActivate(httpContext(req(ADMIN))));
  assert.equal(new SuperAdminGuard().canActivate(httpContext(req(SUPER))), true);
});

test('I6 : personne ne modifie son propre role ni son propre statut', async () => {
  await assert.rejects(admin.updateRole(SUPER.id, { role: 'USER' }, req(SUPER)));
  await assert.rejects(admin.updateStatus(ADMIN.id, { status: 'SUSPENDED' }, req(ADMIN)));
  assert.equal(SUPER.role, 'SUPER_ADMIN');
  assert.equal(ADMIN.status, 'ACTIVE');
});

// ----------------------------------------- I7 : suivi des conversations (admin)

test('I7 : lire les conversations des utilisateurs exige SUPER_ADMIN (lecture seule)', () => {
  const guardsOf = (method) => (Reflect.getMetadata('__guards__', AdminController.prototype[method]) || []).map((g) => g.name);
  for (const method of ['listConversations', 'getConversation', 'getAttachmentContent']) {
    assert.ok(guardsOf(method).includes('SuperAdminGuard'), `${method} protege par SuperAdminGuard`);
  }
  assert.throws(() => new SuperAdminGuard().canActivate(httpContext(req(ADMIN))), 'un ADMIN est refuse');
  const routes = Object.getOwnPropertyNames(AdminController.prototype).filter((m) => /conversation/i.test(m));
  assert.deepEqual(routes.sort(), ['getConversation', 'listConversations'], 'aucune route de modification');
});

test('I7 : chaque conversation lue par un SUPER_ADMIN est journalisee', async () => {
  const logs = [];
  const tracked = new AdminController(
    { getConversation: async (id) => ({ id, user: { id: A.id }, messages: [] }) },
    { async log(entry) { logs.push(entry); } }
  );
  await tracked.getConversation(conversationA.id, req(SUPER));
  assert.deepEqual(logs.map((l) => [l.userId, l.action, l.target, l.details.ownerId]), [
    [SUPER.id, 'VIEW_USER_CONVERSATION', conversationA.id, A.id],
  ]);
});
