1.1 Register User
Endpoint: POST /users/register
Access: Public
Description: Register a new user.


{
  "firstName": "cse",
  "lastName": "zag",
  "email": "zag.ces@gmail.com",
  "password": "A12LD@LAFSA",
  "country":"Egypt",
  "phoneNumber": "+20123456789",
   "birthdate": "1990-01-01"
}




1.2 Verify Email
Endpoint: GET /users/verify-email?token=
Access: Public
Description: Verify user's email using the token sent to their email.


Success Response (200):
{
  "success": true,
  "data": { "message": "Email verified successfully" }
}
Error Responses:
400 Bad Request: Invalid/missing token or already verified.
404 Not Found: User not found.


1.3 Resend Verification Email
Endpoint: POST /users/resend-verification
Access: Public
Description: Resend verification email to unverified users.


Request Body (Example):
{ "email": "zag.cse@example.com" }
Success Response (200):
{
  "success": true,
  "data": { "message": "Verification email sent successfully" }
}
Error Responses:
404 Not Found: Email not registered.
400 Bad Request: User already verified.


1.4 Login
Endpoint: POST /users/login
Access: Public
Description: Authenticate user and return JWT tokens.

Request Body (Example):
{
  "email": "cse.zag@example.com",
  "password": "SecurePassword123!"
}
Success Response (200):
{
  "success": true,
  "data": {
    "message": "User logged in successfully",
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
Error Responses:
401 Unauthorized: Invalid credentials or email not verified.


1.5 Refresh Token
Endpoint: POST /users/refresh-token
Access: Requires valid JWT
Description: Generate new access token using refresh token.

Request Body (Example):
{ "refreshToken": "eyJhbGciOiJIUzI1NiIs..." }
Success Response (200):
{
  "success": true,
  "data": {
    "accessToken": "new_access_token",
    "refreshToken": "new_refresh_token"
  }
}
Error Responses:
401 Unauthorized: Invalid/expired refresh token.


1.6 Logout
Endpoint: POST /users/logout
Access: Requires valid JWT
Description: Invalidate the user's refresh token.

Request Body (Example):
{ "refreshToken": "eyJhbGciOiJIUzI1NiIs..." }
Success Response (200):
{
  "success": true,
  "data": { "message": "User logged out successfully" }
}
Error Responses:
401 Unauthorized: Invalid credentials.


2. Password Management
2.1 Change Password
Endpoint: PUT /users/change-password
Access: Requires valid JWT
Description: Change user's password after verifying the old password.

Request Body (Example):
{
  "oldPassword": "OldPassword123!",
  "newPassword": "NewSecurePassword456!"
}
Success Response (200):
{
  "success": true,
  "data": { "message": "Password changed successfully" }
}
Error Responses:
401 Unauthorized: Invalid old password.
404 Not Found: User not found.


2.2 Request Password Reset
Endpoint: POST /users/request-password-reset
Access: Public
Description: Send password reset instructions to the user's email.

Request Body (Example):
{ "email": "cse.zag@example.com" }
Error Responses:
404 Not Found: Email not registered.
400 Bad Request: User not verified.


2.3 Reset Password
Endpoint: GET /users/reset-password?token=&newPassword=
Access: Public
Description: Reset password using a valid token from email.

Success Response (200):
{
  "success": true,
  "data": { "message": "Password reset successfully" }
}
Error Responses:
400 Bad Request: Invalid/expired token or missing parameters.


3. Profile Management
3.1 Get Profile
Endpoint: GET /users/profile
Access: Requires valid JWT
Description: Retrieve authenticated user's profile.

Success Response (200):
{
  "success": true,
  "data": {
    "message": "Profile retrieved",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "firstName": "cse",
      "lastName": "zag",
      "email": "cse.zag@example.com",
      "country": "EGY",
      "phoneNumber": "+1234567890",
      "isVerified": true
    }
  }
}
Error Responses:
404 Not Found: User not found.


3.2 Update Profile
Endpoint: PATCH /users/profile
Access: Requires valid JWT
Description: Update user profile. Changing email requires re-verification.

Request Body (Example):
{
  "firstName": "sayed",
  "email": "sayed.email@example.com"
}
Success Response (200):
{
  "success": true,
  "data": {
    "message": "Profile updated - Please verify your new email",
    "user": { ...updatedProfile }
  }
}
Error Responses:
409 Conflict: New email/phone already exists.
400 Bad Request: Validation errors.


4. Administration Endpoints
4.1 Get All Users (Admin/Mod)
Endpoint: GET /users/all
Access: Admin/Mod
Description: Retrieve list of all users.

Success Response (200):
{
  "message": "Users retrieved successfully",
  "users": [ ...arrayOfUserObjects ]
}
Error Responses:
403 Forbidden: Insufficient permissions.


4.2 Update User Roles (Admin)
Endpoint: PATCH /users/roles
Access: Admin
Description: Update roles of another user.

Request Body (Example):
{
  "userId": "507f1f77bcf86cd799439012",
  "roles": ["mod"]
}
Success Response (200):
{
  "success": true,
  "data": {
    "message": "Roles updated successfully",
    "user": { ...userWithNewRoles }
  }
}
Error Responses:
400 Bad Request: Invalid roles or self-update attempt.
403 Forbidden: Not an admin.


4.3 Admin Dashboard (Admin/Mod)
Endpoint: GET /users/admin-dashboard
Access: Admin/Mod

Response:
{ "message": "Admin-only content" }


4.4 Flight Management (Admin/Mod)
Endpoint: GET /users/flight-management
Access: Admin/Mod

Response:
{ "message": "Flight management dashboard" }


Edge Cases & Notes
Email Verification:
Token expires after 1 hour.
Users can't perform privileged actions until verified.

Password Reset:
Reset tokens expire after 1 hour.
Users must be verified to reset passwords.

Role Management:
Admins can't modify their own roles.
At least one role must be assigned.

Security:
Access tokens expire in 15 minutes; refresh tokens in 7 days.
Refresh tokens are single-use and invalidated after refresh.

Profile Updates:
Changing email sends a new verification email.
Phone numbers must be unique across users.




