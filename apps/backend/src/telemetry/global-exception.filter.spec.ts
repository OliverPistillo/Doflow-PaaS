import { ArgumentsHost, HttpException } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

function hostFor(response: { status: jest.Mock; json: jest.Mock; headersSent?: boolean }): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        ip: '127.0.0.1',
        method: 'GET',
        tenantId: 'tenant-test',
        url: '/api/tenant/notifications',
      }),
      getResponse: () => response,
      getNext: () => undefined,
    }),
  } as ArgumentsHost;
}

describe('GlobalExceptionFilter', () => {
  it.each([400, 401, 403, 404, 409, 419, 429])(
    'preserves expected HTTP %s responses without broadcasting system errors',
    (expectedStatus) => {
    const telemetry = { logRequest: jest.fn() };
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    new GlobalExceptionFilter(telemetry as never).catch(
      new HttpException('Expected application rejection', expectedStatus),
      hostFor(response),
    );

    expect(telemetry.logRequest).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(expectedStatus);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: expectedStatus,
      error: 'Expected application rejection',
    }));
    },
  );

  it('broadcasts unexpected 5xx responses as system errors', () => {
    const telemetry = { logRequest: jest.fn() };
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    new GlobalExceptionFilter(telemetry as never).catch(
      new Error('Unexpected failure'),
      hostFor(response),
    );

    expect(telemetry.logRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/tenant/notifications',
        tenantId: 'tenant-test',
        type: 'SYSTEM_ERROR',
      }),
    );
    expect(response.status).toHaveBeenCalledWith(500);
  });

  it('does not attempt a second response when Express has already sent headers', () => {
    const telemetry = { logRequest: jest.fn() };
    const response = {
      headersSent: true,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    new GlobalExceptionFilter(telemetry as never).catch(
      new Error('Late failure'),
      hostFor(response),
    );

    expect(telemetry.logRequest).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
  });
});
