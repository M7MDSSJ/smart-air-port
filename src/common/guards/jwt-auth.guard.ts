// src/core/auth/guards/jwt-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/modules/users/users.service';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService, // Inject UsersService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) return false;

    try {
      const token = authHeader.split(' ')[1]; // Extract token from header
      const decoded = this.jwtService.verify<{ sub: string }>(token, {
        // Verify the token
        secret: process.env.JWT_ACCESS_SECRET, // Secret key for verification
      });

      // Fetch the full user document from the database
      const user = await this.usersService.getUserById(decoded.sub); // `sub` is the user ID
      if (!user) return false; // If no user is found, return false

      // Attach the complete user document to the request
      request.user = user;
      return true;
    } catch {
      return false; // If there was an error verifying the token, return false
    }
  }
}
