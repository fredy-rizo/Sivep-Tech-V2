export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) =>
  new AppError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = 'Debes iniciar sesión') =>
  new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'No tienes permisos para esta acción') =>
  new AppError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Recurso no encontrado') =>
  new AppError(404, 'NOT_FOUND', message);
export const conflict = (message, details) =>
  new AppError(409, 'CONFLICT', message, details);
export const unprocessable = (message, details) =>
  new AppError(422, 'VALIDATION_ERROR', message, details);
