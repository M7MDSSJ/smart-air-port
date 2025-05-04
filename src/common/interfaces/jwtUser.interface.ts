export interface JwtUser {
  id: string; // Maps to "sub" from JWT
  email: string;
  name: string;
  roles?: string[]; // Optional roles field
}
