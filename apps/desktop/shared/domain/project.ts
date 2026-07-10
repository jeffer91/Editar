/* =========================================================
Nombre completo: project.ts
Ruta o ubicación: /apps/desktop/shared/domain/project.ts

Función o funciones:
- Definir el modelo estable de un proyecto audiovisual.
- Validar formato, resolución, FPS y relación de aspecto.
- Crear proyectos nuevos con versión de esquema controlada.
========================================================= */

import { assertDomain } from "./domain-error.js";
import {
  clampNumber,
  createEntityId,
  normalizeName,
  toIsoDateTime,
  type EntityId,
  type IsoDateTime,
} from "./primitives.js";

const DOMAIN_SCHEMA_VERSION = 1 as const;

type ProjectStatus = "draft" | "active" | "archived";
type ProjectAspectRatio = "16:9" | "9:16" | "1:1" | "4:5" | "custom";

interface ProjectCanvas {
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly aspectRatio: ProjectAspectRatio;
  readonly backgroundColor: string;
}

interface ProjectPreferences {
  readonly defaultTransitionDurationMs: number;
  readonly autoSaveIntervalMs: number;
  readonly proxyEnabled: boolean;
  readonly snappingEnabled: boolean;
}

interface Project {
  readonly id: EntityId<"project">;
  readonly schemaVersion: typeof DOMAIN_SCHEMA_VERSION;
  readonly name: string;
  readonly status: ProjectStatus;
  readonly canvas: ProjectCanvas;
  readonly preferences: ProjectPreferences;
  readonly mainSequenceId: EntityId<"sequence">;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

interface CreateProjectInput {
  readonly id?: EntityId<"project">;
  readonly mainSequenceId?: EntityId<"sequence">;
  readonly name: string;
  readonly status?: ProjectStatus;
  readonly canvas?: Partial<ProjectCanvas>;
  readonly preferences?: Partial<ProjectPreferences>;
  readonly now?: Date | string;
}

const DEFAULT_PROJECT_CANVAS: ProjectCanvas = Object.freeze({
  width: 1920,
  height: 1080,
  fps: 30,
  aspectRatio: "16:9",
  backgroundColor: "#000000",
});

const DEFAULT_PROJECT_PREFERENCES: ProjectPreferences = Object.freeze({
  defaultTransitionDurationMs: 500,
  autoSaveIntervalMs: 5_000,
  proxyEnabled: true,
  snappingEnabled: true,
});

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function validateCanvas(input: ProjectCanvas): ProjectCanvas {
  assertDomain(
    Number.isInteger(input.width) && input.width >= 16 && input.width <= 16_384,
    "OUT_OF_RANGE",
    "canvas.width",
    "El ancho debe ser un entero entre 16 y 16384 píxeles.",
    { value: input.width },
  );
  assertDomain(
    Number.isInteger(input.height) && input.height >= 16 && input.height <= 16_384,
    "OUT_OF_RANGE",
    "canvas.height",
    "El alto debe ser un entero entre 16 y 16384 píxeles.",
    { value: input.height },
  );
  clampNumber(input.fps, 1, 240, "canvas.fps");
  assertDomain(
    HEX_COLOR_PATTERN.test(input.backgroundColor),
    "INVALID_FORMAT",
    "canvas.backgroundColor",
    "El color de fondo debe utilizar formato hexadecimal #RRGGBB.",
    { value: input.backgroundColor },
  );

  return Object.freeze({ ...input });
}

function validatePreferences(
  input: ProjectPreferences,
): ProjectPreferences {
  assertDomain(
    Number.isInteger(input.defaultTransitionDurationMs) &&
      input.defaultTransitionDurationMs >= 0 &&
      input.defaultTransitionDurationMs <= 60_000,
    "OUT_OF_RANGE",
    "preferences.defaultTransitionDurationMs",
    "La transición predeterminada debe estar entre 0 y 60000 ms.",
  );
  assertDomain(
    Number.isInteger(input.autoSaveIntervalMs) &&
      input.autoSaveIntervalMs >= 1_000 &&
      input.autoSaveIntervalMs <= 300_000,
    "OUT_OF_RANGE",
    "preferences.autoSaveIntervalMs",
    "El guardado automático debe estar entre 1 y 300 segundos.",
  );

  return Object.freeze({ ...input });
}

function createProject(input: CreateProjectInput): Project {
  const timestamp = toIsoDateTime(input.now ?? new Date(), "now");
  const canvas = validateCanvas({
    ...DEFAULT_PROJECT_CANVAS,
    ...input.canvas,
  });
  const preferences = validatePreferences({
    ...DEFAULT_PROJECT_PREFERENCES,
    ...input.preferences,
  });

  return Object.freeze({
    id: input.id ?? createEntityId("project"),
    schemaVersion: DOMAIN_SCHEMA_VERSION,
    name: normalizeName(input.name, "name", 120),
    status: input.status ?? "draft",
    canvas,
    preferences,
    mainSequenceId: input.mainSequenceId ?? createEntityId("sequence"),
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

function updateProjectTimestamp(
  project: Project,
  now: Date | string = new Date(),
): Project {
  return Object.freeze({
    ...project,
    updatedAt: toIsoDateTime(now, "updatedAt"),
  });
}

export {
  DEFAULT_PROJECT_CANVAS,
  DEFAULT_PROJECT_PREFERENCES,
  DOMAIN_SCHEMA_VERSION,
  createProject,
  updateProjectTimestamp,
  validateCanvas,
  validatePreferences,
  type CreateProjectInput,
  type Project,
  type ProjectAspectRatio,
  type ProjectCanvas,
  type ProjectPreferences,
  type ProjectStatus,
};
