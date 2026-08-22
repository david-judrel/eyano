import { Injectable, ConflictException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { prisma } from '../../lib/prisma';
import { hashPassword, verifyPassword, generateToken } from '@eyano/auth';
import { LoginInput, RegisterInput, AuthUser } from '@eyano/auth';

@Injectable()
export class AuthService {
  async register(input: RegisterInput): Promise<{ user: AuthUser; token: string }> {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException('Un compte existe déjà avec cet email');
    }

    const passwordHash = await hashPassword(input.password);
    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash,
      },
    });

    await prisma.account.create({
      data: {
        userId: user.id,
        provider: 'EMAIL',
        providerAccountId: user.id,
      },
    });

    const token = generateToken({ userId: user.id, email: user.email });

    return {
      user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
      token,
    };
  }

  async login(input: LoginInput): Promise<{ user: AuthUser; token: string }> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Compte desactive');
    }

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = generateToken({ userId: user.id, email: user.email });

    return {
      user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
      token,
    };
  }

  async getProfile(userId: string): Promise<AuthUser> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, role: user.role, status: user.status, createdAt: user.createdAt };
  }

  async oauthLogin(provider: 'google' | 'apple', code: string): Promise<{ user: AuthUser; token: string }> {
    let email: string;
    let name: string | null = null;

    if (provider === 'google') {
      const backendUrl = process.env.GOOGLE_REDIRECT_URI || `http://localhost:${process.env.PORT || 3001}`;
      const redirectUri = backendUrl.includes('/api/auth/google/callback') ? backendUrl : `${backendUrl}/api/auth/google/callback`;
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID || '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      const tokenData = await tokenRes.json();

      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userInfo = await userInfoRes.json();
      email = userInfo.email;
      name = userInfo.name;
    } else {
      email = `${code}@appleid.com`;
      name = 'Utilisateur Apple';
    }

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name,
          emailVerified: true,
        },
      });

      await prisma.account.create({
        data: {
          userId: user.id,
          provider: provider.toUpperCase() as any,
          providerAccountId: email,
        },
      });
    } else if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Compte desactive');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = generateToken({ userId: user.id, email: user.email });

    return {
      user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
      token,
    };
  }
}
