/* =========================================================
Nombre completo: trusted-sources.ts
Ruta o ubicación: /apps/desktop/main/security/trusted-sources.ts

Función o funciones:
- Determinar qué dirección puede cargar la ventana principal.
- Validar el origen de cada solicitud IPC recibida.
- Limitar producción al archivo renderer compilado de la app.
========================================================= */

import type { IpcMainInvokeEvent } from "electron";

interface TrustedSourceOptions {
  readonly developmentUrl?: string;
  readonly productionUrl: string;
}

class UntrustedSenderError extends Error {
  constructor() {
    super("La solicitud proviene de un origen no autorizado.");
    this.name = "UntrustedSenderError";
  }
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isTrustedRendererUrl(
  candidateUrl: string,
  options: TrustedSourceOptions,
): boolean {
  const candidate = parseUrl(candidateUrl);
  const expected = parseUrl(
    options.developmentUrl ?? options.productionUrl,
  );

  if (!candidate || !expected) {
    return false;
  }

  if (expected.protocol === "file:") {
    return (
      candidate.protocol === "file:" &&
      decodeURIComponent(candidate.pathname) ===
        decodeURIComponent(expected.pathname)
    );
  }

  return candidate.origin === expected.origin;
}

function assertTrustedIpcSender(
  event: IpcMainInvokeEvent,
  options: TrustedSourceOptions,
): void {
  const senderUrl = event.senderFrame?.url ?? "";

  if (!isTrustedRendererUrl(senderUrl, options)) {
    throw new UntrustedSenderError();
  }
}

export {
  UntrustedSenderError,
  assertTrustedIpcSender,
  isTrustedRendererUrl,
  type TrustedSourceOptions,
};
