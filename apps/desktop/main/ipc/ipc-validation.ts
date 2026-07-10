/* =========================================================
Nombre completo: ipc-validation.ts
Ruta o ubicación: /apps/desktop/main/ipc/ipc-validation.ts

Función o funciones:
- Validar la estructura de las solicitudes IPC.
- Rechazar identificadores inválidos o solicitudes antiguas.
- Crear respuestas uniformes sin exponer detalles internos.
========================================================= */

import type {
  IpcErrorCode,
  IpcFailure,
  IpcSuccess,
  RequestEnvelope,
} from "../../shared/ipc-contracts.js";

const MAX_REQUEST_AGE_MS = 5 * 60 * 1000;
const REQUEST_ID_PATTERN = /^[a-z0-9-]{12,100}$/i;

class IpcRequestError extends Error {
  readonly code: IpcErrorCode;

  constructor(code: IpcErrorCode, message: string) {
    super(message);
    this.name = "IpcRequestError";
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRequestEnvelope(value: unknown): RequestEnvelope {
  if (!isRecord(value)) {
    throw new IpcRequestError(
      "INVALID_REQUEST",
      "La solicitud IPC no tiene un formato válido.",
    );
  }

  const requestId = value.requestId;
  const sentAt = value.sentAt;

  if (typeof requestId !== "string" || !REQUEST_ID_PATTERN.test(requestId)) {
    throw new IpcRequestError(
      "INVALID_REQUEST",
      "El identificador de la solicitud no es válido.",
    );
  }

  if (typeof sentAt !== "number" || !Number.isFinite(sentAt)) {
    throw new IpcRequestError(
      "INVALID_REQUEST",
      "La fecha de la solicitud no es válida.",
    );
  }

  const age = Math.abs(Date.now() - sentAt);

  if (age > MAX_REQUEST_AGE_MS) {
    throw new IpcRequestError(
      "INVALID_REQUEST",
      "La solicitud IPC ha expirado.",
    );
  }

  return { requestId, sentAt };
}

function parseRequestWithPayload(value: unknown): {
  readonly request: RequestEnvelope;
  readonly payload: unknown;
} {
  const request = parseRequestEnvelope(value);

  if (!isRecord(value) || !("payload" in value)) {
    throw new IpcRequestError(
      "INVALID_REQUEST",
      "La solicitud no contiene los datos requeridos.",
    );
  }

  return Object.freeze({ request, payload: value.payload });
}

function createSuccess<T>(requestId: string, data: T): IpcSuccess<T> {
  return {
    ok: true,
    requestId,
    data,
  };
}

function createFailure(
  requestId: string,
  code: IpcErrorCode,
  message: string,
): IpcFailure {
  return {
    ok: false,
    requestId,
    error: {
      code,
      message,
    },
  };
}

function getSafeRequestId(value: unknown): string {
  if (isRecord(value) && typeof value.requestId === "string") {
    return value.requestId.slice(0, 100);
  }

  return "unknown-request";
}

export {
  IpcRequestError,
  createFailure,
  createSuccess,
  getSafeRequestId,
  isRecord,
  parseRequestEnvelope,
  parseRequestWithPayload,
};
