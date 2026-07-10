/* =========================================================
Nombre completo: trusted-sources.ts
Ruta o ubicación: /apps/desktop/main/security/trusted-sources.ts

Función o funciones:
- Determinar qué direcciones puede cargar la ventana principal.
- Validar el origen de cada solicitud IPC recibida.
- Bloquear mensajes procedentes de páginas o marcos no confiables.
========================================================= */

import { app, type IpcMainInvokeEvent } from "electron";

class UntrustedSenderError extends Error {
  constructor() {
    super("La solicitud proviene de un origen no autorizado.");
    this.name = "UntrustedSenderError";
  }
}

function getUrlOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function isTrustedRendererUrl(
  candidateUrl: string,
  developmentUrl?: string,
): boolean {
  if (!candidateUrl) {
    return false;
  }

  if (app.isPackaged) {
    try {
      return new URL(candidateUrl).protocol === "file:";
    } catch {
      return false;
    }
  }

  if (developmentUrl) {
    const candidateOrigin = getUrlOrigin(candidateUrl);
    const developmentOrigin = getUrlOrigin(developmentUrl);

    return (
      candidateOrigin !== null &&
      developmentOrigin !== null &&
      candidateOrigin === developmentOrigin
    );
  }

  try {
    return new URL(candidateUrl).protocol === "file:";
  } catch {
    return false;
  }
}

function assertTrustedIpcSender(
  event: IpcMainInvokeEvent,
  developmentUrl?: string,
): void {
  const senderUrl = event.senderFrame?.url ?? "";

  if (!isTrustedRendererUrl(senderUrl, developmentUrl)) {
    throw new UntrustedSenderError();
  }
}

export {
  UntrustedSenderError,
  assertTrustedIpcSender,
  isTrustedRendererUrl,
};
