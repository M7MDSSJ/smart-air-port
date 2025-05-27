# User Module API Documentation

## Overview
The User Module provides comprehensive user management functionality including authentication, registration, profile management, and role-based access control.

## Base URL
```
https://your-api-domain.com/users
```

## Authentication
Most endpoints require JWT authentication. Include the access token in the Authorization header:
```
Authorization: Bearer <access_token>
```

## Table of Contents
1. [Authentication Endpoints](#authentication-endpoints)
2. [User Management Endpoints](#user-management-endpoints)
3. [Profile Management](#profile-management)
4. [Admin Endpoints](#admin-endpoints)
5. [Data Models](#data-models)
6. [Error Handling](#error-handling)

---

## Authentication Endpoints

### 1. Register User
**POST** `/users/register`

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "Password123!@",
  "firstName": "Ahmed",
  "lastName": "Mohamed",
  "phoneNumber": "+201234567890",
  "country": "Egypt",
  "birthdate": "1990-01-01"
}
```

**Validation Rules:**
- `email`: Valid email format, required
- `password`: Minimum 10 characters, must contain 1 uppercase, 1 lowercase, 1 number, 1 symbol
- `firstName`: Minimum 3 characters, required
- `lastName`: Minimum 3 characters, required
- `phoneNumber`: Valid international format (optional)
- `country`: Valid country name or ISO code (optional)
- `birthdate`: Date string (optional)

**Response (201):**
```json
{
  "success": true,
  "data": {
    "message": "User registered successfully",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "firstName": "Ahmed",
      "lastName": "Mohamed",
      "email": "user@example.com",
      "country": "Egypt",
      "phoneNumber": "+201234567890",
      "isVerified": false,
      "birthdate": "1990-01-01"
    }
  }
}
```

### 2. Login User
**POST** `/users/login`

Authenticate user and receive access/refresh tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "Password123!@"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "User logged in successfully",
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4="
  }
}
```

**Token Information:**
- `accessToken`: Valid for 15 minutes
- `refreshToken`: Valid for 7 days

### 3. Refresh Token
**POST** `/users/refresh-token`
**Authentication:** Required

Refresh expired access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "your-refresh-token-here"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4="
  }
}
```

### 4. Logout
**POST** `/users/logout`
**Authentication:** Required

Logout user and invalidate refresh token.

**Request Body:**
```json
{
  "refreshToken": "your-refresh-token-here"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "User logged out successfully"
  }
}
```

---

## Email Verification

### 5. Verify Email
**POST** `/users/verify-email`

Verify user email with verification code.

**Request Body:**
```json
{
  "email": "user@example.com",
  "code": "A1B2C3"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Email verified successfully"
  }
}
```

### 6. Resend Verification Email
**POST** `/users/resend-verification`

Resend email verification code.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Verification email sent successfully"
  }
}
```

---

## Password Management

### 7. Request Password Reset
**POST** `/users/request-reset-password`

Request password reset code via email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Password reset code sent to email"
  }
}
```

### 8. Reset Password
**POST** `/users/reset-password`

Reset password using reset code.

**Request Body:**
```json
{
  "code": "ABC12",
  "newPassword": "NewPassword123!@"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Password reset successfully"
  }
}
```

### 9. Change Password
**PUT** `/users/change-password`
**Authentication:** Required

Change password for authenticated user.

**Request Body:**
```json
{
  "oldPassword": "OldPassword123!@",
  "newPassword": "NewPassword123!@"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Password changed successfully"
  }
}
```

---

## Profile Management

### 10. Get User Profile
**GET** `/users/profile`
**Authentication:** Required

Get current user's profile information.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "User profile retrieved successfully",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "firstName": "Ahmed",
      "lastName": "Mohamed",
      "email": "user@example.com",
      "country": "Egypt",
      "phoneNumber": "+201234567890",
      "isVerified": true,
      "birthdate": "1990-01-01",
      "roles": ["user"],
      "gender": "male",
      "preferredLanguage": "en",
      "preferredAirlines": ["EgyptAir", "Emirates"],
      "deviceType": "mobile",
      "loyaltyProgram": {
        "status": "gold",
        "points": 15000
      },
      "preferredCabinClass": "economy",
      "useRecommendationSystem": true
    }
  }
}
```

### 11. Update User Profile
**PATCH** `/users/profile`
**Authentication:** Required

Update user profile information.

**Request Body (all fields optional):**
```json
{
  "firstName": "Ahmed",
  "lastName": "Mohamed",
  "phoneNumber": "+201234567890",
  "country": "Egypt",
  "birthdate": "1990-01-01",
  "gender": "male",
  "preferredLanguage": "en",
  "preferredAirlines": ["EgyptAir", "Emirates"],
  "deviceType": "mobile",
  "loyaltyProgram": {
    "status": "gold",
    "points": 15000
  },
  "preferredCabinClass": "economy",
  "useRecommendationSystem": true
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Profile updated successfully",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "firstName": "Ahmed",
      "lastName": "Mohamed",
      "email": "user@example.com",
      "country": "Egypt",
      "phoneNumber": "+201234567890",
      "isVerified": true,
      "birthdate": "1990-01-01"
    }
  }
}
```

---

## Admin Endpoints

### 12. Get All Users
**GET** `/users/all`
**Authentication:** Required (Admin/Moderator only)

Get list of all users (admin/moderator access only).

**Response (200):**
```json
{
  "message": "Users retrieved successfully",
  "users": [
    {
      "id": "507f1f77bcf86cd799439011",
      "firstName": "Ahmed",
      "lastName": "Mohamed",
      "email": "user@example.com",
      "country": "Egypt",
      "phoneNumber": "+201234567890",
      "isVerified": true,
      "birthdate": "1990-01-01",
      "roles": ["user"]
    }
  ]
}
```

### 13. Update User Roles
**PATCH** `/users/roles`
**Authentication:** Required (Admin only)

Update user roles (admin access only).

**Request Body:**
```json
{
  "email": "user@example.com",
  "roles": ["user", "mod"]
}
```

**Available Roles:**
- `user`: Regular user
- `mod`: Moderator
- `admin`: Administrator

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "User roles updated successfully",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "firstName": "Ahmed",
      "lastName": "Mohamed",
      "email": "user@example.com",
      "roles": ["user", "mod"]
    }
  }
}
```

### 14. Delete User
**DELETE** `/users/:email`
**Authentication:** Required (Admin only)

Delete user by email (admin access only).

**Response (200):**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

### 15. Admin Dashboard
**GET** `/users/admin-dashboard`
**Authentication:** Required (Admin/Moderator only)

Access admin dashboard (admin/moderator access only).

**Response (200):**
```json
{
  "message": "Admin-only content"
}
```

### 16. Flight Management
**GET** `/users/flight-management`
**Authentication:** Required (Admin/Moderator only)

Access flight management dashboard (admin/moderator access only).

**Response (200):**
```json
{
  "message": "Flight management dashboard"
}
```

---

## Data Models

### User Object
```typescript
interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  country?: string;
  birthdate?: string;
  isVerified: boolean;
  roles: string[];
  gender?: string;
  preferredLanguage?: string;
  preferredAirlines?: string[];
  deviceType?: string;
  loyaltyProgram?: {
    status: string;
    points: number;
  };
  bookingHistory?: Array<{
    airline: string;
    date: Date;
    cabinClass: string;
  }>;
  preferredCabinClass?: string;
  useRecommendationSystem?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Error Handling

### Standard Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": "Error type",
  "statusCode": 400,
  "timestamp": "2025-02-27T09:05:47.193Z",
  "path": "/users/register",
  "errors": {
    "email": "Invalid email format",
    "password": "Password must contain: 1 uppercase, 1 lowercase, 1 number, 1 symbol"
  }
}
```

### Common Error Codes

| Status Code | Error Type | Description |
|-------------|------------|-------------|
| 400 | Bad Request | Invalid request data or validation errors |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Insufficient permissions for the requested action |
| 404 | Not Found | Requested resource not found |
| 409 | Conflict | Resource already exists (e.g., email already registered) |
| 422 | Unprocessable Entity | Request data is valid but cannot be processed |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server-side error |

### Validation Error Examples

**Email Validation:**
```json
{
  "success": false,
  "message": "Please check the following fields",
  "errors": {
    "email": "Invalid email format"
  }
}
```

**Password Validation:**
```json
{
  "success": false,
  "message": "Please check the following fields",
  "errors": {
    "password": "Password must contain: 1 uppercase, 1 lowercase, 1 number, 1 symbol"
  }
}
```

**Authentication Errors:**
```json
{
  "success": false,
  "message": "Invalid credentials",
  "statusCode": 401
}
```

```json
{
  "success": false,
  "message": "Email not verified",
  "statusCode": 401
}
```

---

## Rate Limiting

The API implements rate limiting to prevent abuse:
- **General endpoints**: 10 requests per minute per IP
- **Authentication endpoints**: Additional restrictions may apply

When rate limit is exceeded:
```json
{
  "success": false,
  "message": "Too many requests",
  "statusCode": 429
}
```

---

## Security Notes

1. **Password Requirements**: Minimum 10 characters with uppercase, lowercase, number, and symbol
2. **JWT Tokens**: Access tokens expire in 15 minutes, refresh tokens in 7 days
3. **Email Verification**: Required before accessing protected features
4. **Role-Based Access**: Admin and moderator roles have additional permissions
5. **Input Validation**: All inputs are validated and sanitized
6. **Rate Limiting**: Prevents brute force attacks and API abuse

---

## Mobile/Frontend Integration Tips

1. **Token Management**: Store tokens securely and implement automatic refresh
2. **Error Handling**: Implement proper error handling for all status codes
3. **Validation**: Implement client-side validation matching server requirements
4. **User Experience**: Show appropriate loading states and error messages
5. **Offline Support**: Cache user profile data for offline access
6. **Security**: Never store passwords or sensitive data in plain text
