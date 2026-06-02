import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { BloomController } from '../src/bloom.controller';
import { RedisScriptManager } from '../src/redis/redis-script.manager';

describe('BloomController', () => {
  let controller: BloomController;
  let redisScriptManager: RedisScriptManager;

  const mockRedisScriptManager = {
    executeScript: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BloomController],
      providers: [
        {
          provide: RedisScriptManager,
          useValue: mockRedisScriptManager,
        },
      ],
    }).compile();

    controller = module.get<BloomController>(BloomController);
    redisScriptManager = module.get<RedisScriptManager>(RedisScriptManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('test', () => {
    it('should throw an HttpException if key is missing', async () => {
      await expect(controller.test('', 'utente1')).rejects.toThrow(
        new HttpException('Missing key or item', HttpStatus.BAD_REQUEST),
      );
    });

    it('should throw an HttpException if item is missing', async () => {
      await expect(controller.test('login', '')).rejects.toThrow(
        new HttpException('Missing key or item', HttpStatus.BAD_REQUEST),
      );
    });

    it('should return alreadySeen: true if executeScript returns 1', async () => {
      mockRedisScriptManager.executeScript.mockResolvedValue(1);

      const result = await controller.test('login', 'utente1');

      expect(mockRedisScriptManager.executeScript).toHaveBeenCalledWith(
        'dual_probe',
        ['doflow:bf:login:current', 'doflow:bf:login:prev'],
        ['utente1', 3600],
      );

      expect(result).toEqual({
        status: 'ok',
        key: 'login',
        item: 'utente1',
        alreadySeen: true,
        backend_version: 'v3.5-redis-guard',
      });
    });

    it('should return alreadySeen: false if executeScript returns 0', async () => {
      mockRedisScriptManager.executeScript.mockResolvedValue(0);

      const result = await controller.test('login', 'utente1');

      expect(mockRedisScriptManager.executeScript).toHaveBeenCalledWith(
        'dual_probe',
        ['doflow:bf:login:current', 'doflow:bf:login:prev'],
        ['utente1', 3600],
      );

      expect(result).toEqual({
        status: 'ok',
        key: 'login',
        item: 'utente1',
        alreadySeen: false,
        backend_version: 'v3.5-redis-guard',
      });
    });

    it('should return error status and message if executeScript throws an Error', async () => {
      mockRedisScriptManager.executeScript.mockRejectedValue(new Error('Redis is down'));

      const result = await controller.test('login', 'utente1');

      expect(result).toEqual({
        status: 'error',
        message: 'Redis is down',
      });
    });

    it('should return error status and unknown message if executeScript throws a non-Error', async () => {
      mockRedisScriptManager.executeScript.mockRejectedValue('Some string error');

      const result = await controller.test('login', 'utente1');

      expect(result).toEqual({
        status: 'error',
        message: 'Unknown script execution error',
      });
    });
  });
});
