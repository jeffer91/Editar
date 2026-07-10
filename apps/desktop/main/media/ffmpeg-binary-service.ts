/* =========================================================
Nombre completo: ffmpeg-binary-service.ts
Ruta o ubicación: /apps/desktop/main/media/ffmpeg-binary-service.ts

Función o funciones:
- Localizar FFmpeg y FFprobe sin usar shell.
- Comprobar disponibilidad y versión con tiempo límite.
- Priorizar variables de entorno, recursos empaquetados y PATH.
========================================================= */

import { spawn } from "node:child_process";
import { join } from "node:path";
import type {
  MediaEngineStatus,
  MediaToolName,
  MediaToolSource,
  MediaToolStatus,
} from "../../shared/media-engine-contracts.js";

interface MediaToolCommand {
  readonly command: string;
  readonly argumentsPrefix: readonly string[];
  readonly source: Exclude<MediaToolSource, "unavailable">;
  readonly version: string;
}

interface ToolCandidate {
  readonly command: string;
  readonly argumentsPrefix: readonly string[];
  readonly source: Exclude<MediaToolSource, "unavailable">;
}

interface VersionCheckResult {
  readonly ok: boolean;
  readonly version?: string;
  readonly error?: string;
}

type VersionRunner = (
  candidate: ToolCandidate,
  timeoutMs: number,
) => Promise<VersionCheckResult>;

interface FfmpegBinaryServiceOptions {
  readonly applicationPath: string;
  readonly resourcesPath: string;
  readonly workspacePath?: string;
  readonly environment?: NodeJS.ProcessEnv;
  readonly platform?: NodeJS.Platform;
  readonly timeoutMs?: number;
  readonly versionRunner?: VersionRunner;
}

class MediaToolUnavailableError extends Error {
  constructor(readonly tool: MediaToolName, message: string) {
    super(message);
    this.name = "MediaToolUnavailableError";
  }
}

function firstOutputLine(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)
    ?.slice(0, 240) ?? "";
}

function runVersion(
  candidate: ToolCandidate,
  timeoutMs: number,
): Promise<VersionCheckResult> {
  return new Promise((resolve) => {
    const child = spawn(
      candidate.command,
      [...candidate.argumentsPrefix, "-version"],
      {
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          AV_LOG_FORCE_NOCOLOR: "1",
        },
      },
    );
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (result: VersionCheckResult): void => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      child.kill();
      finish({
        ok: false,
        error: `La comprobación superó ${timeoutMs} ms.`,
      });
    }, timeoutMs);

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      if (stdout.length < 32_768) {
        stdout += chunk;
      }
    });
    child.stderr?.on("data", (chunk: string) => {
      if (stderr.length < 32_768) {
        stderr += chunk;
      }
    });
    child.once("error", (error) => {
      finish({ ok: false, error: error.message });
    });
    child.once("close", (code) => {
      if (code !== 0) {
        finish({
          ok: false,
          error: firstOutputLine(stderr) || `El proceso terminó con código ${code}.`,
        });
        return;
      }

      const version = firstOutputLine(stdout) || firstOutputLine(stderr);
      finish(
        version
          ? { ok: true, version }
          : { ok: false, error: "El ejecutable no informó su versión." },
      );
    });
  });
}

class FfmpegBinaryService {
  private readonly environment: NodeJS.ProcessEnv;
  private readonly platform: NodeJS.Platform;
  private readonly timeoutMs: number;
  private readonly versionRunner: VersionRunner;
  private cachedStatus: MediaEngineStatus | null = null;
  private readonly resolvedCommands = new Map<MediaToolName, MediaToolCommand>();

  constructor(private readonly options: FfmpegBinaryServiceOptions) {
    this.environment = options.environment ?? process.env;
    this.platform = options.platform ?? process.platform;
    this.timeoutMs = Math.min(Math.max(options.timeoutMs ?? 5_000, 500), 30_000);
    this.versionRunner = options.versionRunner ?? runVersion;
  }

  async getStatus(force = false): Promise<MediaEngineStatus> {
    if (this.cachedStatus && !force) {
      return this.cachedStatus;
    }

    this.resolvedCommands.clear();
    const checkedAt = new Date().toISOString();
    const [ffmpeg, ffprobe] = await Promise.all([
      this.resolveTool("ffmpeg", checkedAt),
      this.resolveTool("ffprobe", checkedAt),
    ]);
    const status: MediaEngineStatus = Object.freeze({
      ready: ffmpeg.available && ffprobe.available,
      ffmpeg,
      ffprobe,
      checkedAt,
    });

    this.cachedStatus = status;
    return status;
  }

  async getCommand(
    tool: MediaToolName,
    force = false,
  ): Promise<MediaToolCommand> {
    await this.getStatus(force);
    const command = this.resolvedCommands.get(tool);

    if (!command) {
      throw new MediaToolUnavailableError(
        tool,
        `${tool} no está disponible. Configura el ejecutable o agrégalo a PATH.`,
      );
    }

    return command;
  }

  private candidates(tool: MediaToolName): readonly ToolCandidate[] {
    const executable = this.platform === "win32" ? `${tool}.exe` : tool;
    const environmentKey =
      tool === "ffmpeg" ? "EDITAR_FFMPEG_PATH" : "EDITAR_FFPROBE_PATH";
    const environmentCommand = this.environment[environmentKey]?.trim();
    const workspacePath = this.options.workspacePath ?? process.cwd();
    const candidates: ToolCandidate[] = [];

    if (environmentCommand) {
      candidates.push({
        command: environmentCommand,
        argumentsPrefix: Object.freeze([]),
        source: "environment",
      });
    }

    candidates.push(
      {
        command: join(this.options.resourcesPath, "bin", executable),
        argumentsPrefix: Object.freeze([]),
        source: "packaged",
      },
      {
        command: join(this.options.applicationPath, "resources", "bin", executable),
        argumentsPrefix: Object.freeze([]),
        source: "application",
      },
      {
        command: join(workspacePath, "resources", "bin", executable),
        argumentsPrefix: Object.freeze([]),
        source: "workspace",
      },
      {
        command: executable,
        argumentsPrefix: Object.freeze([]),
        source: "path",
      },
    );

    const seen = new Set<string>();

    return Object.freeze(
      candidates.filter((candidate) => {
        const key =
          this.platform === "win32"
            ? candidate.command.toLocaleLowerCase()
            : candidate.command;

        if (seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      }),
    );
  }

  private async resolveTool(
    tool: MediaToolName,
    checkedAt: string,
  ): Promise<MediaToolStatus> {
    const errors: string[] = [];

    for (const candidate of this.candidates(tool)) {
      const result = await this.versionRunner(candidate, this.timeoutMs);

      if (result.ok && result.version) {
        this.resolvedCommands.set(
          tool,
          Object.freeze({
            command: candidate.command,
            argumentsPrefix: Object.freeze([...candidate.argumentsPrefix]),
            source: candidate.source,
            version: result.version,
          }),
        );

        return Object.freeze({
          name: tool,
          available: true,
          command: candidate.command,
          source: candidate.source,
          version: result.version,
          error: null,
          checkedAt,
        });
      }

      if (result.error) {
        errors.push(`${candidate.source}: ${result.error}`);
      }
    }

    return Object.freeze({
      name: tool,
      available: false,
      command: null,
      source: "unavailable",
      version: null,
      error: errors.at(-1) ?? `${tool} no fue encontrado.`,
      checkedAt,
    });
  }
}

export {
  FfmpegBinaryService,
  MediaToolUnavailableError,
  runVersion,
  type FfmpegBinaryServiceOptions,
  type MediaToolCommand,
  type ToolCandidate,
  type VersionCheckResult,
  type VersionRunner,
};
