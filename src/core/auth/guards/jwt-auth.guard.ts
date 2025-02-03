// src/core/auth/guards/jwt-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Observable } from 'rxjs';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request: Request = context.switchToHttp().getRequest();

    const authHeader = request.headers['authorization'];
    if (!authHeader) {
      return false; // No token found
    }

    try {
      const token = authHeader.split(' ')[1]; // Bearer token
      const decoded = this.jwtService.verify<{ id: string; username: string }>(
        token,
      ); // Verifies the token
      request.user = decoded as { id: string; username: string }; // Attach decoded user to request object
      return true;
    } catch {
      return false; // Invalid token
    }
  }
}
