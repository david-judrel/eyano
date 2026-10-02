import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../guards/auth.guard';
import { RateLimitGuard } from '../../guards/rate-limit.guard';
import { ImageService, KeplerImageResult } from './image.service';

class GenerateImageDto {
  prompt!: string;
}

/**
 * Kepler Image (experimental). Pas de choix de modele cote client en V1 :
 * le modele logique par defaut (`kepler-image-1`) est utilise.
 */
@ApiTags('image')
@Controller('image')
@UseGuards(AuthGuard, RateLimitGuard)
@ApiBearerAuth()
export class ImageController {
  constructor(private readonly imageService: ImageService) {}

  @Post('generate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Kepler Image : generer une image a partir d un prompt (experimental)' })
  async generate(@Body() body: GenerateImageDto): Promise<KeplerImageResult> {
    return this.imageService.generate(body?.prompt);
  }
}
