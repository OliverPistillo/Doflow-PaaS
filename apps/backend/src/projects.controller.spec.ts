import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsController } from './projects.controller';
import { AuditService } from './audit.service';
import { ProjectsEventsService } from './realtime/projects-events.service';
import { Request, Response } from 'express';

describe('ProjectsController', () => {
  let controller: ProjectsController;
  let auditService: jest.Mocked<AuditService>;
  let projectsEvents: jest.Mocked<ProjectsEventsService>;

  beforeEach(async () => {
    auditService = {
      log: jest.fn(),
    } as any;

    projectsEvents = {
      taskCreated: jest.fn(),
      taskStatusChanged: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [
        { provide: AuditService, useValue: auditService },
        { provide: ProjectsEventsService, useValue: projectsEvents },
      ],
    }).compile();

    controller = module.get<ProjectsController>(ProjectsController);
  });

  describe('tenantId validation (safeSchema)', () => {
    it('should throw an error if an invalid tenantId is passed', async () => {
      const mockReq = {
        authUser: { email: 'test@example.com', role: 'editor' },
        tenantId: 'tenant; DROP TABLE users; --',
        tenantConnection: {
          query: jest.fn(),
        },
      } as unknown as Request;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await expect(controller.listProjects(mockReq, mockRes)).rejects.toThrow(
        /\[safeSchema @ ProjectsController\] Invalid schema name:/
      );
    });

    it('should pass and correctly query if a valid tenantId is provided', async () => {
      const mockQuery = jest.fn().mockResolvedValue([{ id: 1, name: 'Project 1' }]);
      const mockReq = {
        authUser: { email: 'test@example.com', role: 'editor' },
        tenantId: 'valid_tenant',
        tenantConnection: {
          query: mockQuery,
        },
      } as unknown as Request;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await controller.listProjects(mockReq, mockRes);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('from "valid_tenant".projects')
      );
      expect(mockRes.json).toHaveBeenCalledWith({ projects: [{ id: 1, name: 'Project 1' }] });
    });

    it('should fallback to public if no tenantId is provided', async () => {
      const mockQuery = jest.fn().mockResolvedValue([]);
      const mockReq = {
        authUser: { email: 'test@example.com', role: 'editor' },
        tenantConnection: {
          query: mockQuery,
        },
      } as unknown as Request;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await controller.listProjects(mockReq, mockRes);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('from "public".projects')
      );
      expect(mockRes.json).toHaveBeenCalledWith({ projects: [] });
    });
  });
});
