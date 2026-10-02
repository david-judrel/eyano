import { Controller, Post, Get, Param, UseInterceptors, UploadedFile, UseGuards, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FilesService } from './files.service';
import { AuthGuard } from '../../guards/auth.guard';

@ApiTags('files')
@Controller('files')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload/:messageId')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024, files: 5 } }))
  @ApiOperation({ summary: 'Uploader un fichier' })
  @ApiConsumes('multipart/form-data')
  async upload(
    @Param('messageId') messageId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any
  ) {
    return this.filesService.upload(messageId, file, req.user.userId);
  }

  @Get('message/:messageId')
  @ApiOperation({ summary: 'Fichiers d\'un message' })
  async findByMessage(@Param('messageId') messageId: string, @Req() req: any) {
    return this.filesService.findByMessage(messageId, req.user.userId);
  }

  @Get(':id/content')
  @ApiOperation({ summary: "Contenu d'une image generee (Kepler)" })
  async content(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
    const file = await this.filesService.getContent(id, req.user.userId);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', String(file.data.length));
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(file.data);
  }
}
