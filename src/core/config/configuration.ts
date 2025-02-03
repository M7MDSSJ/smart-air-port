import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT || '3000'),
  env: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET,
  mongoUri: process.env.MONGO_URI,
}));
