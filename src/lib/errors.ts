export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number = 500, code: string = "INTERNAL_ERROR") {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Authentication required") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Access forbidden") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ValidationError extends AppError {
  public readonly errors?: Record<string, string[]>;

  constructor(message: string = "Validation failed", errors?: Record<string, string[]>) {
    super(message, 400, "VALIDATION_ERROR");
    this.errors = errors;
  }
}

export class InactiveAccountError extends AppError {
  constructor(message: string = "Account or organization is inactive. Access denied.") {
    super(message, 403, "INACTIVE_ACCOUNT");
  }
}

export class TenantMismatchError extends AppError {
  constructor(message: string = "Access denied: Tenant isolation policy violation.") {
    super(message, 403, "TENANT_MISMATCH");
  }
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function createSuccessResponse<T>(data: T, meta?: Record<string, unknown>, status: number = 200) {
  return Response.json(
    {
      success: true,
      data,
      ...(meta ? { meta } : {}),
    } satisfies ApiSuccessResponse<T>,
    { status }
  );
}

export function createErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return Response.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error instanceof ValidationError && error.errors ? { details: error.errors } : {}),
        },
      } satisfies ApiErrorResponse,
      { status: error.statusCode }
    );
  }

  // Safe fallback for unexpected internal errors (prevent leaking SQL / internal details)
  const isDev = process.env.NODE_ENV === "development";
  const errorMessage = isDev && error instanceof Error ? error.message : "An unexpected internal server error occurred.";

  return Response.json(
    {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: errorMessage,
      },
    } satisfies ApiErrorResponse,
    { status: 500 }
  );
}
