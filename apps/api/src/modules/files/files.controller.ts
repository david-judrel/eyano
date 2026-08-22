import { Controller, Post, Get, Param, UseInterceptors, UploadedFile, UseGuards, Req } from '@nestjs/common';
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
    @UploadedFile() file: Express.Multer.File
  ) {
    return this.filesService.upload(messageId, file);
  }

  @Get('message/:messageId')
  @ApiOperation({ summary: 'Fichiers d\'un message' })
  async findByMessage(@Param('messageId') messageId: string) {
    return this.filesService.findByMessage(messageId);
  }
}
