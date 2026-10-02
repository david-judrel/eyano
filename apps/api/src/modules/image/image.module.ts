import { Module } from '@nestjs/common';
import { ImageController } from './image.controller';
import { ImageService } from './image.service';

/**
 * Kepler Image (experimental, non commercial).
 *
 * Module isole : il ne touche ni au chat, ni aux missions. Il n'est importe
 * dans `AppModule` que si `KEPLER_IMAGE_ENABLED=true` (voir `kepler-flag`).
 */
@Module({
  controllers: [ImageController],
  providers: [ImageService],
})
export class ImageModule {}
