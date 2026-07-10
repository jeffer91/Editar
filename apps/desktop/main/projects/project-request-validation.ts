/* =========================================================
Nombre completo: project-request-validation.ts
Ruta o ubicación: /apps/desktop/main/projects/project-request-validation.ts

Función o funciones:
- Validar datos recibidos por IPC para gestionar proyectos.
- Convertir identificadores y nombres a valores del dominio.
- Rechazar estados o formatos no autorizados.
========================================================= */

import {
  DomainValidationError,
  normalizeName,
  parseEntityId,
  type EntityId,
  type ProjectStatus,
} from "../../shared/domain/index.js";
import type {
  CreateProjectInput,
  DuplicateProjectInput,
  ProjectCanvasPreset,
  ProjectIdInput,
  RenameProjectInput,
  SetProjectStatusInput,
} from "../../shared/project-management-contracts.js";
import { IpcRequestError, isRecord } from "../ipc/ipc-validation.js";

const PROJECT_PRESETS: readonly ProjectCanvasPreset[] = Object.freeze([
  "horizontal",
  "vertical",
  "square",
  "portrait",
]);

const PROJECT_STATUSES: readonly ProjectStatus[] = Object.freeze([
  "draft",
  "active",
  "archived",
]);

function parseName(value: unknown): string {
  if (typeof value !== "string") {
    throw new IpcRequestError(
      "INVALID_REQUEST",
      "El nombre del proyecto no tiene un formato válido.",
    );
  }

  try {
    return normalizeName(value, "name", 120);
  } catch (error) {
    if (error instanceof DomainValidationError) {
      throw new IpcRequestError("INVALID_REQUEST", error.message);
    }

    throw error;
  }
}

function parseProjectId(value: unknown): EntityId<"project"> {
  if (typeof value !== "string") {
    throw new IpcRequestError(
      "INVALID_REQUEST",
      "El identificador del proyecto no tiene un formato válido.",
    );
  }

  try {
    return parseEntityId(value, "project");
  } catch (error) {
    if (error instanceof DomainValidationError) {
      throw new IpcRequestError("INVALID_REQUEST", error.message);
    }

    throw error;
  }
}

function parseProjectIdInput(value: unknown): ProjectIdInput {
  if (!isRecord(value)) {
    throw new IpcRequestError(
      "INVALID_REQUEST",
      "Los datos del proyecto no tienen un formato válido.",
    );
  }

  return Object.freeze({ projectId: parseProjectId(value.projectId) });
}

function parseCreateProjectInput(value: unknown): CreateProjectInput {
  if (!isRecord(value)) {
    throw new IpcRequestError(
      "INVALID_REQUEST",
      "Los datos para crear el proyecto no son válidos.",
    );
  }

  const preset = value.preset;

  if (
    typeof preset !== "string" ||
    !PROJECT_PRESETS.includes(preset as ProjectCanvasPreset)
  ) {
    throw new IpcRequestError(
      "INVALID_REQUEST",
      "El formato del proyecto no está permitido.",
    );
  }

  return Object.freeze({
    name: parseName(value.name),
    preset: preset as ProjectCanvasPreset,
  });
}

function parseRenameProjectInput(value: unknown): RenameProjectInput {
  if (!isRecord(value)) {
    throw new IpcRequestError(
      "INVALID_REQUEST",
      "Los datos para renombrar el proyecto no son válidos.",
    );
  }

  return Object.freeze({
    projectId: parseProjectId(value.projectId),
    name: parseName(value.name),
  });
}

function parseDuplicateProjectInput(value: unknown): DuplicateProjectInput {
  if (!isRecord(value)) {
    throw new IpcRequestError(
      "INVALID_REQUEST",
      "Los datos para duplicar el proyecto no son válidos.",
    );
  }

  return Object.freeze({
    projectId: parseProjectId(value.projectId),
    name: parseName(value.name),
  });
}

function parseSetProjectStatusInput(value: unknown): SetProjectStatusInput {
  if (!isRecord(value)) {
    throw new IpcRequestError(
      "INVALID_REQUEST",
      "Los datos para cambiar el estado no son válidos.",
    );
  }

  const status = value.status;

  if (
    typeof status !== "string" ||
    !PROJECT_STATUSES.includes(status as ProjectStatus)
  ) {
    throw new IpcRequestError(
      "INVALID_REQUEST",
      "El estado solicitado no está permitido.",
    );
  }

  return Object.freeze({
    projectId: parseProjectId(value.projectId),
    status: status as ProjectStatus,
  });
}

export {
  PROJECT_PRESETS,
  PROJECT_STATUSES,
  parseCreateProjectInput,
  parseDuplicateProjectInput,
  parseProjectIdInput,
  parseRenameProjectInput,
  parseSetProjectStatusInput,
};
