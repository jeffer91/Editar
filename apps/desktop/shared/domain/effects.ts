/* =========================================================
Nombre completo: effects.ts
Ruta o ubicación: /apps/desktop/shared/domain/effects.ts

Función o funciones:
- Definir efectos aplicables a clips, pistas y secuencias.
- Definir transiciones entre clips.
- Mantener parámetros serializables y versionados.
========================================================= */

import { assertDomain } from "./domain-error.js";
import {
  createEntityId,
  normalizeName,
  toMicroseconds,
  type EntityId,
  type JsonValue,
  type Microseconds,
} from "./primitives.js";

type EffectOwnerType = "clip" | "track" | "sequence";
type TransitionAlignment = "start" | "center" | "end";

interface EffectInstance {
  readonly id: EntityId<"effect">;
  readonly ownerType: EffectOwnerType;
  readonly ownerId: string;
  readonly effectType: string;
  readonly version: number;
  readonly enabled: boolean;
  readonly order: number;
  readonly startOffsetUs: Microseconds;
  readonly durationUs?: Microseconds;
  readonly parameters: Readonly<Record<string, JsonValue>>;
}

interface TransitionInstance {
  readonly id: EntityId<"transition">;
  readonly fromClipId: EntityId<"clip">;
  readonly toClipId: EntityId<"clip">;
  readonly transitionType: string;
  readonly version: number;
  readonly durationUs: Microseconds;
  readonly alignment: TransitionAlignment;
  readonly parameters: Readonly<Record<string, JsonValue>>;
}

interface CreateEffectInput {
  readonly id?: EntityId<"effect">;
  readonly ownerType: EffectOwnerType;
  readonly ownerId: string;
  readonly effectType: string;
  readonly version?: number;
  readonly enabled?: boolean;
  readonly order?: number;
  readonly startOffsetUs?: Microseconds;
  readonly durationUs?: Microseconds;
  readonly parameters?: Readonly<Record<string, JsonValue>>;
}

interface CreateTransitionInput {
  readonly id?: EntityId<"transition">;
  readonly fromClipId: EntityId<"clip">;
  readonly toClipId: EntityId<"clip">;
  readonly transitionType: string;
  readonly version?: number;
  readonly durationUs: Microseconds;
  readonly alignment?: TransitionAlignment;
  readonly parameters?: Readonly<Record<string, JsonValue>>;
}

function validateVersion(value: number, field: string): number {
  assertDomain(
    Number.isSafeInteger(value) && value >= 1 && value <= 1_000_000,
    "OUT_OF_RANGE",
    field,
    "La versión debe ser un entero mayor o igual a uno.",
    { value },
  );

  return value;
}

function validateOrder(value: number): number {
  assertDomain(
    Number.isSafeInteger(value) && value >= 0,
    "OUT_OF_RANGE",
    "order",
    "El orden debe ser un entero mayor o igual a cero.",
    { value },
  );

  return value;
}

function freezeParameters(
  parameters: Readonly<Record<string, JsonValue>>,
): Readonly<Record<string, JsonValue>> {
  return Object.freeze({ ...parameters });
}

function createEffect(input: CreateEffectInput): EffectInstance {
  assertDomain(
    input.ownerId.trim().length > 0,
    "REQUIRED",
    "ownerId",
    "El propietario del efecto es obligatorio.",
  );

  const durationUs =
    input.durationUs === undefined
      ? undefined
      : toMicroseconds(input.durationUs, "durationUs");

  if (durationUs !== undefined) {
    assertDomain(
      durationUs > 0,
      "OUT_OF_RANGE",
      "durationUs",
      "La duración del efecto debe ser mayor a cero.",
    );
  }

  return Object.freeze({
    id: input.id ?? createEntityId("effect"),
    ownerType: input.ownerType,
    ownerId: input.ownerId.trim(),
    effectType: normalizeName(input.effectType, "effectType", 120).toLowerCase(),
    version: validateVersion(input.version ?? 1, "version"),
    enabled: input.enabled ?? true,
    order: validateOrder(input.order ?? 0),
    startOffsetUs: toMicroseconds(input.startOffsetUs ?? 0, "startOffsetUs"),
    durationUs,
    parameters: freezeParameters(input.parameters ?? {}),
  });
}

function createTransition(
  input: CreateTransitionInput,
): TransitionInstance {
  assertDomain(
    input.fromClipId !== input.toClipId,
    "INVALID_RELATION",
    "toClipId",
    "Una transición debe conectar dos clips distintos.",
  );

  const durationUs = toMicroseconds(input.durationUs, "durationUs");

  assertDomain(
    durationUs > 0,
    "OUT_OF_RANGE",
    "durationUs",
    "La duración de la transición debe ser mayor a cero.",
  );

  return Object.freeze({
    id: input.id ?? createEntityId("transition"),
    fromClipId: input.fromClipId,
    toClipId: input.toClipId,
    transitionType: normalizeName(
      input.transitionType,
      "transitionType",
      120,
    ).toLowerCase(),
    version: validateVersion(input.version ?? 1, "version"),
    durationUs,
    alignment: input.alignment ?? "center",
    parameters: freezeParameters(input.parameters ?? {}),
  });
}

export {
  createEffect,
  createTransition,
  type CreateEffectInput,
  type CreateTransitionInput,
  type EffectInstance,
  type EffectOwnerType,
  type TransitionAlignment,
  type TransitionInstance,
};
