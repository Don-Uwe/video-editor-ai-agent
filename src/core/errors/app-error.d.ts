import type { ValidationIssue } from "../schemas/index";
export declare class AppError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare class ValidationError extends AppError {
    constructor(message: string);
}
export declare class NotFoundError extends AppError {
    constructor(message: string);
}
export declare class ConflictError extends AppError {
    constructor(message: string);
}
export declare class ConfigurationError extends AppError {
    constructor(message: string);
}
export declare class RedisConnectionError extends AppError {
    constructor(message: string);
}
export declare class HttpError extends AppError {
    readonly status: number;
    readonly detail: string | ValidationIssue[] | unknown;
    constructor(status: number, message: string, detail?: string | ValidationIssue[] | unknown, code?: string);
}
export declare function notFound(resource: string, identifier: string): HttpError;
export declare function conflict(message: string): HttpError;
export declare function validationError(detail: string | ValidationIssue[]): HttpError;
