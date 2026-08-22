#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const readline = require('readline');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function main() {
  console.log('\n🔧 EYANO - Création du compte SUPER_ADMIN\n');

  const email = await ask('Email: ');
  const name = await ask('Nom complet: ');
  const password = await ask('Mot de passe: ');

  if (!email || !password) {
    console.error('\n❌ Email et mot de passe sont requis');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('\n❌ Le mot de passe doit contenir au moins 8 caractères');
    process.exit(1);
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    console.error('\n❌ Cet email est déjà utilisé');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
    },
  });

  console.log('\n✅ Compte SUPER_ADMIN créé avec succès!');
  console.log(`   ID: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Role: ${user.role}`);

  await prisma.$disconnect();
  rl.close();
}

main().catch((e) => {
  console.error('\n❌ Erreur:', e.message);
  prisma.$disconnect();
  rl.close();
  process.exit(1);
});
