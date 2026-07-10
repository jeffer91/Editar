/* =========================================================
Nombre completo: domain-error.ts
Ruta o ubicación: /apps/desktop/shared/domain/domain-error.ts

Función o funciones:
- Representar errores de validación del dominio.
- Identificar el campo y código de cada regla incumplida.
- Evitar errores genéricos difíciles de diagnosticar.
========================================================= */

type DomainErrorCode =
  | "REQUIRED"
  | "INVALID_FORMAT"
  | "OUT_OF_RANGE"
  | "INVALID_RELATION"
  | "DUPLICATE_VALUE"
  | "UNSUPPORTED_VALUE";

class DomainValidationError extends Error {
  readonly code: DomainErrorCode;
  readonly field: string;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    code: DomainErrorCode,
    field: string,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "DomainValidationError";
    this.code = code;
    this.field = field;
    this.details = details;
  }
}

function assertDomain(
  condition: unknown,
  code: DomainErrorCode,
  field: string,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): asserts condition {
  if (!condition) {
    throw new DomainValidationError(code, field, message, details);
  }
}

export {
  DomainValidationError,
  assertDomain,
  type DomainErrorCode,
};
