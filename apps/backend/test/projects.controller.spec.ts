import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';
import { DataSource } from 'typeorm';
import { ProjectsController } from '../src/projects.controller';
import { AuditService } from '../src/audit.service';
import { ProjectsEventsService } from '../src/realtime/projects-events.service';

describe('ProjectsController', () => {
  let controller: ProjectsController;
  let mockAuditService: any;
  let mockProjectsEventsService: any;

  beforeEach(async () => {
    mockAuditService = {
      log: jest.fn(),
    };

    mockProjectsEventsService = {
      taskCreated: jest.fn(),
      taskStatusChanged: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [
        { provide: AuditService, useValue: mockAuditService },
        { provide: ProjectsEventsService, useValue: mockProjectsEventsService },
      ],
    }).compile();

    controller = module.get<ProjectsController>(ProjectsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getConn', () => {
    it('should return the tenant connection if it exists on the request', () => {
      const mockDataSource = {} as DataSource;
      const req = {
        tenantConnection: mockDataSource,
      } as unknown as Request;

      const conn = (controller as any).getConn(req);
      expect(conn).toBe(mockDataSource);
    });

    it('should throw an error if no tenant connection exists on the request', () => {
      const req = {} as unknown as Request;

      expect(() => {
        (controller as any).getConn(req);
      }).toThrow('No tenant connection on request');
    });
  });
});
