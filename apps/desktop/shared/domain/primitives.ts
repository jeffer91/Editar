/* =========================================================
Nombre completo: primitives.ts
Ruta o ubicación: /apps/desktop/shared/domain/primitives.ts

Función o funciones:
- Definir identificadores, fechas y tiempos seguros del dominio.
- Guardar posiciones y duraciones como microsegundos enteros.
- Crear valores normalizados reutilizables por todos los modelos.
========================================================= */

import { assertDomain } from "./domain-error.js";

declare const entityIdBrand: unique symbol;
declare const microsecondsBrand: unique symbol;
declare const isoDateBrand: unique symbol;

type EntityId<TEntity extends string = string> = string & {
  readonly [entityIdBrand]: TEntity;
};

type Microseconds = number & {
  readonly [microsecondsBrand]: true;
};

type IsoDateTime = string & {
  readonly [isoDateBrand]: true;
};

type JsonPrimitive = string | number | boolean | null;
type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

const ENTITY_ID_PATTERN = /^[a-z][a-z0-9-]{1,31}_[a-z0-9-]{8,80}$/i;
const MAX_SAFE_MICROSECONDS = Number.MAX_SAFE_INTEGER;

function createEntityId<TEntity extends string>(
  entityType: TEntity,
  uniquePart?: string,
): EntityId<TEntity> {
  const normalizedType = entityType.trim().toLowerCase();

  assertDomain(
    /^[a-z][a-z0-9-]{1,31}$/.test(normalizedType),
    "INVALID_FORMAT",
    "entityType",
    "El tipo del identificador no tiene un formato válido.",
  );

  const generatedPart =
    uniquePart?.trim().toLowerCase() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
  const normalizedPart = generatedPart.replace(/[^a-z0-9-]/g, "-");
  const value = `${normalizedType}_${normalizedPart}`;

  assertDomain(
    ENTITY_ID_PATTERN.test(value),
    "INVALID_FORMAT",
    "id",
    "No fue posible crear un identificador válido.",
  );

  return value as EntityId<TEntity>;
}

function parseEntityId<TEntity extends string>(
  value: string,
  expectedType?: TEntity,
): EntityId<TEntity> {
  const normalized = value.trim();

  assertDomain(
    ENTITY_ID_PATTERN.test(normalized),
    "INVALID_FORMAT",
    "id",
    "El identificador no tiene un formato válido.",
    { value },
  );

  if (expectedType) {
    assertDomain(
      normalized.startsWith(`${expectedType}_`),
      "INVALID_RELATION",
      "id",
      `El identificador no pertenece al tipo ${expectedType}.`,
      { value, expectedType },
    );
  }

  return normalized as EntityId<TEntity>;
}

function toMicroseconds(value: number, field = "timeUs"): Microseconds {
  assertDomain(
    Number.isSafeInteger(value),
    "INVALID_FORMAT",
    field,
    "El tiempo debe ser un número entero seguro.",
    { value },
  );
  assertDomain(
    value >= 0 && value <= MAX_SAFE_MICROSECONDS,
    "OUT_OF_RANGE",
    field,
    "El tiempo debe ser mayor o igual a cero.",
    { value },
  );

  return value as Microseconds;
}

function secondsToMicroseconds(value: number, field = "seconds"): Microseconds {
  assertDomain(
    Number.isFinite(value) && value >= 0,
    "OUT_OF_RANGE",
    field,
    "Los segundos deben ser un número finito mayor o igual a cero.",
    { value },
  );

  return toMicroseconds(Math.round(value * 1_000_000), field);
}

function millisecondsToMicroseconds(
  value: number,
  field = "milliseconds",
): Microseconds {
  assertDomain(
    Number.isFinite(value) && value >= 0,
    "OUT_OF_RANGE",
    field,
    "Los milisegundos deben ser un número finito mayor o igual a cero.",
    { value },
  );

  return toMicroseconds(Math.round(value * 1_000), field);
}

function microsecondsToSeconds(value: Microseconds): number {
  return value / 1_000_000;
}

function addMicroseconds(
  left: Microseconds,
  right: Microseconds,
  field = "timeUs",
): Microseconds {
  return toMicroseconds(left + right, field);
}

function toIsoDateTime(value: Date | string, field = "date"): IsoDateTime {
  const date = value instanceof Date ? value : new Date(value);

  assertDomain(
    Number.isFinite(date.getTime()),
    "INVALID_FORMAT",
    field,
    "La fecha no tiene un formato válido.",
    { value: String(value) },
  );

  return date.toISOString() as IsoDateTime;
}

function normalizeName(
  value: string,
  field = "name",
  maxLength = 120,
): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  assertDomain(
    normalized.length > 0,
    "REQUIRED",
    field,
    "El nombre es obligatorio.",
  );
  assertDomain(
    normalized.length <= maxLength,
    "OUT_OF_RANGE",
    field,
    `El nombre no puede superar ${maxLength} caracteres.`,
    { maxLength },
  );

  return normalized;
}

function clampNumber(
  value: number,
  min: number,
  max: number,
  field: string,
): number {
  assertDomain(
    Number.isFinite(value),
    "INVALID_FORMAT",
    field,
    "El valor debe ser un número finito.",
    { value },
  );
  assertDomain(
    value >= min && value <= max,
    "OUT_OF_RANGE",
    field,
    `El valor debe estar entre ${min} y ${max}.`,
    { value, min, max },
  );

  return value;
}

export {
  MAX_SAFE_MICROSECONDS,
  addMicroseconds,
  clampNumber,
  createEntityId,
  microsecondsToSeconds,
  millisecondsToMicroseconds,
  normalizeName,
  parseEntityId,
  secondsToMicroseconds,
  toIsoDateTime,
  toMicroseconds,
  type EntityId,
  type IsoDateTime,
  type JsonPrimitive,
  type JsonValue,
  type Microseconds,
};
