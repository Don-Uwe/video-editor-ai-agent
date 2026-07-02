import type { ValidationIssue } from "../schemas/index";

export class AppError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR");
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, "CONFLICT");
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string) {
    super(message, "CONFIGURATION_ERROR");
  }
}

export class RedisConnectionError extends AppError {
  constructor(message: string) {
    super(message, "REDIS_CONNECTION_ERROR");
  }
}

export class HttpError extends AppError {
  readonly status: number;
  readonly detail: string | ValidationIssue[] | unknown;

  constructor(
    status: number,
    message: string,
    detail?: string | ValidationIssue[] | unknown,
    code = "HTTP_ERROR",
  ) {
    super(message, code);
    this.status = status;
    this.detail = detail ?? message;
  }
}

export function notFound(resource: string, identifier: string): HttpError {
  return new HttpError(404, `${resource} not found: ${identifier}`, undefined, "NOT_FOUND");
}

export function conflict(message: string): HttpError {
  return new HttpError(409, message, message, "CONFLICT");
}

export function validationError(detail: string | ValidationIssue[]): HttpError {
  const message = typeof detail === "string" ? detail : "Validation failed";
  return new HttpError(422, message, detail, "VALIDATION_ERROR");
}
