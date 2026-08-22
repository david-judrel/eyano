import { Controller, Post, Body, Get, UseGuards, Req, Res, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from '../../guards/auth.guard';

class RegisterDto {
  email!: string;
  password!: string;
  name!: string;
}

class LoginDto {
  email!: string;
  password!: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Créer un compte' })
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post('login')
  @ApiOperation({ summary: 'Se connecter' })
  async login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Profil utilisateur' })
  async me(@Req() req: any) {
    return this.authService.getProfile(req.user.userId);
  }

  @Get('google')
  async googleAuth(@Res() res: Response) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const backendUrl = process.env.GOOGLE_REDIRECT_URI || `http://localhost:${process.env.PORT || 3001}`;
    const redirectUri = backendUrl.includes('/api/auth/google/callback') ? backendUrl : `${backendUrl}/api/auth/google/callback`;
    const scope = 'email profile';
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline`;
    console.log('[OAuth] Google redirect URL:', url);
    console.log('[OAuth] Client ID:', clientId);
    res.redirect(url);
  }

  @Get('google/callback')
  async googleCallback(@Query('code') code: string, @Res() res: Response) {
    try {
      const result = await this.authService.oauthLogin('google', code);
      const frontendUrl = process.env.FRONTEND_URL;
      res.redirect(`${frontendUrl}/auth/callback?token=${result.token}`);
    } catch {
      const frontendUrl = process.env.FRONTEND_URL;
      res.redirect(`${frontendUrl}/login?error=oauth_failed`);
    }
  }

  @Get('apple')
  async appleAuth(@Res() res: Response) {
    const clientId = process.env.APPLE_CLIENT_ID;
    const backendUrl = process.env.APPLE_REDIRECT_URI || `http://localhost:${process.env.PORT || 3001}`;
    const redirectUri = backendUrl.includes('/api/auth/apple/callback') ? backendUrl : `${backendUrl}/api/auth/apple/callback`;
    const scope = 'name email';
    const url = `https://appleid.apple.com/auth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code id_token&scope=${encodeURIComponent(scope)}&response_mode=query`;
    res.redirect(url);
  }

  @Get('apple/callback')
  async appleCallback(@Query('code') code: string, @Res() res: Response) {
    try {
      const result = await this.authService.oauthLogin('apple', code);
      const frontendUrl = process.env.FRONTEND_URL;
      res.redirect(`${frontendUrl}/auth/callback?token=${result.token}`);
    } catch {
      const frontendUrl = process.env.FRONTEND_URL;
      res.redirect(`${frontendUrl}/login?error=oauth_failed`);
    }
  }
}
