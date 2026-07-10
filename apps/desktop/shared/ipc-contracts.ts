/* =========================================================
Nombre completo: ipc-contracts.ts
Ruta o ubicación: /apps/desktop/shared/ipc-contracts.ts

Función o funciones:
- Definir los canales IPC permitidos por la aplicación.
- Compartir contratos tipados entre main, preload y renderer.
- Estandarizar respuestas exitosas y errores controlados.
========================================================= */

const IPC_CHANNELS = Object.freeze({
  systemGetRuntimeInfo: "system:get-runtime-info",
  systemPing: "system:ping",
} as const);

type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

interface RequestEnvelope {
  readonly requestId: string;
  readonly sentAt: number;
}

interface RuntimeInfo {
  readonly appName: string;
  readonly appVersion: string;
  readonly platform: string;
  readonly isPackaged: boolean;
  readonly versions: {
    readonly electron: string;
    readonly chrome: string;
    readonly node: string;
  };
}

interface PingInfo {
  readonly message: "pong";
  readonly receivedAt: number;
  readonly respondedAt: number;
}

type IpcErrorCode =
  | "INVALID_REQUEST"
  | "UNTRUSTED_SENDER"
  | "INTERNAL_ERROR";

interface IpcSuccess<T> {
  readonly ok: true;
  readonly requestId: string;
  readonly data: T;
}

interface IpcFailure {
  readonly ok: false;
  readonly requestId: string;
  readonly error: {
    readonly code: IpcErrorCode;
    readonly message: string;
  };
}

type IpcResult<T> = IpcSuccess<T> | IpcFailure;

interface SystemBridge {
  getRuntimeInfo(): Promise<IpcResult<RuntimeInfo>>;
  ping(): Promise<IpcResult<PingInfo>>;
}

interface EditarBridge {
  readonly system: SystemBridge;
}

export {
  IPC_CHANNELS,
  type EditarBridge,
  type IpcChannel,
  type IpcErrorCode,
  type IpcFailure,
  type IpcResult,
  type IpcSuccess,
  type PingInfo,
  type RequestEnvelope,
  type RuntimeInfo,
  type SystemBridge,
};
