/* =========================================================
Nombre completo: job-queue-request-validation.ts
Ruta o ubicación: /apps/desktop/main/jobs/job-queue-request-validation.ts

Función o funciones:
- Validar identificadores recibidos por IPC para la cola.
- Rechazar tipos de entidad incorrectos o datos incompletos.
- Convertir solicitudes externas a contratos tipados.
========================================================= */

import {
  DomainValidationError,
  parseEntityId,
  type EntityId,
} from "../../shared/domain/index.js";
import type {
  JobIdInput,
  ProjectJobInput,
} from "../../shared/job-queue-contracts.js";
import { IpcRequestError, isRecord } from "../ipc/ipc-validation.js";

function parseTypedId<TKind extends "job" | "project">(
  value: unknown,
  kind: TKind,
): EntityId<TKind> {
  if (typeof value !== "string") {
    throw new IpcRequestError(
      "INVALID_REQUEST",
      `El identificador de ${kind === "job" ? "trabajo" : "proyecto"} no es válido.`,
    );
  }

  try {
    return parseEntityId(value, kind);
  } catch (error) {
    if (error instanceof DomainValidationError) {
      throw new IpcRequestError("INVALID_REQUEST", error.message);
    }

    throw error;
  }
}

function parseJobIdInput(value: unknown): JobIdInput {
  if (!isRecord(value)) {
    throw new IpcRequestError(
      "INVALID_REQUEST",
      "Los datos del trabajo no tienen un formato válido.",
    );
  }

  return Object.freeze({ jobId: parseTypedId(value.jobId, "job") });
}

function parseProjectJobInput(value: unknown): ProjectJobInput {
  if (!isRecord(value)) {
    throw new IpcRequestError(
      "INVALID_REQUEST",
      "Los datos para crear el trabajo no son válidos.",
    );
  }

  return Object.freeze({
    projectId: parseTypedId(value.projectId, "project"),
  });
}

export {
  parseJobIdInput,
  parseProjectJobInput,
};
