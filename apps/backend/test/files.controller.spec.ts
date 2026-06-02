import { Test, TestingModule } from '@nestjs/testing';
import { FilesController } from '../src/files.controller';
import { FileStorageService } from '../src/file-storage.service';
import { AuditService } from '../src/audit.service';
import { Request, Response } from 'express';

describe('FilesController', () => {
  let controller: FilesController;
  let fileStorageService: jest.Mocked<FileStorageService>;
  let auditService: jest.Mocked<AuditService>;

  beforeEach(async () => {
    // Create mock instances
    const mockFileStorageService = {
      listFiles: jest.fn(),
      downloadFileStream: jest.fn(),
      uploadFile: jest.fn(),
    };

    const mockAuditService = {
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [
        {
          provide: FileStorageService,
          useValue: mockFileStorageService,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    controller = module.get<FilesController>(FilesController);
    fileStorageService = module.get(FileStorageService) as jest.Mocked<FileStorageService>;
    auditService = module.get(AuditService) as jest.Mocked<AuditService>;
  });

  describe('list', () => {
    it('should return 401 if authUser is not present', async () => {
      // Mock request and response
      const req = {} as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await controller.list(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
      expect(fileStorageService.listFiles).not.toHaveBeenCalled();
    });

    it('should return files list if authUser is present', async () => {
      // Mock request with authUser
      const req = {
        authUser: { id: 'user-id' },
      } as unknown as Request;

      const res = {
        json: jest.fn(),
      } as unknown as Response;

      const mockFiles = [
        { id: 1, name: 'file1.txt' },
        { id: 2, name: 'file2.txt' },
      ];

      fileStorageService.listFiles.mockResolvedValue(mockFiles as any);

      await controller.list(req, res);

      expect(fileStorageService.listFiles).toHaveBeenCalledWith(req);
      expect(res.json).toHaveBeenCalledWith({ files: mockFiles });
    });
  });
});
