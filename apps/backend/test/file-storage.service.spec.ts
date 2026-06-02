import { Test, TestingModule } from '@nestjs/testing';
import { FileStorageService } from '../src/file-storage.service';
import { Request } from 'express';
import { DataSource } from 'typeorm';

describe('FileStorageService', () => {
  let service: FileStorageService;

  beforeEach(async () => {
    // Mock environment variables used in constructor
    process.env.S3_BUCKET = 'test-bucket';
    process.env.S3_REGION = 'us-east-1';
    process.env.S3_ACCESS_KEY_ID = 'test-access-key';
    process.env.S3_SECRET_ACCESS_KEY = 'test-secret-key';

    const module: TestingModule = await Test.createTestingModule({
      providers: [FileStorageService],
    }).compile();

    service = module.get<FileStorageService>(FileStorageService);
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.S3_BUCKET;
    delete process.env.S3_REGION;
    delete process.env.S3_ACCESS_KEY_ID;
    delete process.env.S3_SECRET_ACCESS_KEY;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getConn', () => {
    it('should throw an error if tenantConnection is not present on the request', () => {
      const mockReq = {} as Request;

      expect(() => {
        (service as any).getConn(mockReq);
      }).toThrow('No tenant connection on request');
    });

    it('should return the connection if tenantConnection is present on the request', () => {
      const mockDataSource = {
        name: 'mockConnection'
      } as unknown as DataSource;

      const mockReq = {
        tenantConnection: mockDataSource
      } as unknown as Request;

      const conn = (service as any).getConn(mockReq);
      expect(conn).toBe(mockDataSource);
    });
  });
});
