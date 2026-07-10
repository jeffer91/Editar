/* =========================================================
Nombre completo: ipc-validation.test.mjs
Ruta o ubicación: /tests/ipc-validation.test.mjs

Función o funciones:
- Probar solicitudes IPC válidas, inválidas y expiradas.
- Comprobar orígenes autorizados en desarrollo.
- Comprobar la restricción exacta del renderer en producción.
========================================================= */

import assert from "node:assert/strict";
import test from "node:test";
import {
  IpcRequestError,
  parseRequestEnvelope,
} from "../dist-electron/main/ipc/ipc-validation.js";
import { isTrustedRendererUrl } from "../dist-electron/main/security/trusted-sources.js";

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

test("acepta únicamente el origen de desarrollo configurado", () => {
  const options = {
    developmentUrl: "http://127.0.0.1:5173",
    productionUrl: "file:///C:/Editar/dist-renderer/index.html",
  };

  assert.equal(
    isTrustedRendererUrl("http://127.0.0.1:5173/editor", options),
    true,
  );
  assert.equal(
    isTrustedRendererUrl("http://localhost:5173/editor", options),
    false,
  );
  assert.equal(
    isTrustedRendererUrl("https://example.com", options),
    false,
  );
});

test("producción solo acepta el index compilado autorizado", () => {
  const options = {
    productionUrl: "file:///C:/Editar/dist-renderer/index.html",
  };

  assert.equal(
    isTrustedRendererUrl(
      "file:///C:/Editar/dist-renderer/index.html",
      options,
    ),
    true,
  );
  assert.equal(
    isTrustedRendererUrl("file:///C:/Windows/System32/index.html", options),
    false,
  );
  assert.equal(isTrustedRendererUrl("file:///C:/Editar/otro.html", options), false);
});
