import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { NextFunction, Request, Response } from 'express';
import { JwtPayload } from '../types/interfaces';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly jwtService: JwtService;

  constructor(private readonly configService: ConfigService) {
    this.jwtService = new JwtService({
      secret: this.configService.get<string>('jwt.secret') ?? 'change-me-in-production'
    });
  }

  use(request: Request, _response: Response, next: NextFunction): void {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('缺少 Bearer Token');
    }

    const token = authorization.slice('Bearer '.length);
    const payload = this.jwtService.verify<JwtPayload>(token);
    request.user = {
      id: payload.sub,
      role: payload.role,
      name: payload.name
    };
    next();
  }
}
