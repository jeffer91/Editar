/* =========================================================
Nombre completo: ipc-validation.test.mjs
Ruta o ubicación: /tests/ipc-validation.test.mjs

Función o funciones:
- Probar solicitudes IPC válidas.
- Confirmar el rechazo de identificadores incorrectos.
- Confirmar el rechazo de solicitudes expiradas.
========================================================= */

import assert from "node:assert/strict";
import test from "node:test";
import {
  IpcRequestError,
  parseRequestEnvelope,
} from "../dist-electron/main/ipc/ipc-validation.js";

test("acepta una solicitud IPC válida", () => {
  const request = {
    requestId: "request-valid-12345",
    sentAt: Date.now(),
  };

  assert.deepEqual(parseRequestEnvelope(request), request);
});

test("rechaza un identificador IPC inválido", () => {
  assert.throws(
    () =>
      parseRequestEnvelope({
        requestId: "bad",
        sentAt: Date.now(),
      }),
    (error) =>
      error instanceof IpcRequestError && error.code === "INVALID_REQUEST",
  );
});

test("rechaza una solicitud IPC expirada", () => {
  assert.throws(
    () =>
      parseRequestEnvelope({
        requestId: "request-expired-12345",
        sentAt: Date.now() - 10 * 60 * 1000,
      }),
    (error) =>
      error instanceof IpcRequestError && error.code === "INVALID_REQUEST",
  );
});
