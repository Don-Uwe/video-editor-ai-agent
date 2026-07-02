export class AppError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
    }
}
export class ValidationError extends AppError {
    constructor(message) {
        super(message, "VALIDATION_ERROR");
    }
}
export class NotFoundError extends AppError {
    constructor(message) {
        super(message, "NOT_FOUND");
    }
}
export class ConflictError extends AppError {
    constructor(message) {
        super(message, "CONFLICT");
    }
}
export class ConfigurationError extends AppError {
    constructor(message) {
        super(message, "CONFIGURATION_ERROR");
    }
}
export class RedisConnectionError extends AppError {
    constructor(message) {
        super(message, "REDIS_CONNECTION_ERROR");
    }
}
export class HttpError extends AppError {
    status;
    detail;
    constructor(status, message, detail, code = "HTTP_ERROR") {
        super(message, code);
        this.status = status;
        this.detail = detail ?? message;
    }
}
export function notFound(resource, identifier) {
    return new HttpError(404, `${resource} not found: ${identifier}`, undefined, "NOT_FOUND");
}
export function conflict(message) {
    return new HttpError(409, message, message, "CONFLICT");
}
export function validationError(detail) {
    const message = typeof detail === "string" ? detail : "Validation failed";
    return new HttpError(422, message, detail, "VALIDATION_ERROR");
}
