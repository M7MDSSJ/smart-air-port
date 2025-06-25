import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtUser } from '../interfaces/jwtUser.interface';
import { FastifyRequest } from 'fastify';

export const User = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): JwtUser => {

    const request: FastifyRequest = ctx.switchToHttp().getRequest();
    const user = request.user;

    console.log('User from request:', user);
    if(!user || !user.id) throw new UnauthorizedException('User not found');

    return user as JwtUser;

  },
);
