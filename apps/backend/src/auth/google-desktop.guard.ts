import { BadRequestException, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DESKTOP_GOOGLE_STATE_PREFIX } from './desktop-google-oauth.service';

@Injectable()
export class GoogleDesktopAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const flow = String(request.query?.flow || '').trim();
    if (flow.length < 32 || flow.length > 128 || !/^[A-Za-z0-9_-]+$/.test(flow)) {
      throw new BadRequestException('Desktop OAuth flow non valido');
    }
    return {
      state: `${DESKTOP_GOOGLE_STATE_PREFIX}${flow}`,
      prompt: 'select_account',
    };
  }
}
