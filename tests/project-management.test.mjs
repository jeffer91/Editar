/* =========================================================
Nombre completo: project-management.test.mjs
Ruta o ubicación: /tests/project-management.test.mjs

Función o funciones:
- Probar el ciclo completo de gestión de proyectos.
- Verificar formatos, snapshots, duplicación y estados.
- Confirmar errores controlados para proyectos inexistentes.
========================================================= */

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DatabaseService } from "../dist-electron/main/database/database-service.js";
import {
  ProjectManagementService,
  ProjectNotFoundError,
} from "../dist-electron/main/projects/project-management-service.js";
import {
  parseCreateProjectInput,
  parseProjectIdInput,
  parseSetProjectStatusInput,
} from "../dist-electron/main/projects/project-request-validation.js";
import { createEntityId } from "../dist-electron/shared/domain/index.js";

async function createContext() {
  const root = await mkdtemp(join(tmpdir(), "editar-projects-"));
  const database = new DatabaseService({
    paths: {
      dataDirectory: join(root, "data"),
      databasePath: join(root, "data", "projects.sqlite3"),
      backupsDirectory: join(root, "backups"),
    },
    automaticBackups: false,
  });

  await database.initialize();

  return {
    root,
    database,
    projects: new ProjectManagementService(database.projects),
    async cleanup() {
      database.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}

test("crea proyectos con el formato solicitado", async () => {
  const context = await createContext();

  try {
    const summary = await context.projects.create({
      name: "Video vertical",
      preset: "vertical",
    });
    const document = await context.projects.open(summary.id);

    assert.equal(summary.name, "Video vertical");
    assert.equal(document.project.canvas.width, 1080);
    assert.equal(document.project.canvas.height, 1920);
    assert.equal(document.project.canvas.aspectRatio, "9:16");
    assert.equal(document.tracks.length, 4);
    assert.equal(await context.database.projects.countSnapshots(summary.id), 1);
  } finally {
    await context.cleanup();
  }
});

test("renombra, archiva y restaura generando snapshots", async () => {
  const context = await createContext();

  try {
    const created = await context.projects.create({
      name: "Nombre inicial",
      preset: "horizontal",
    });
    const renamed = await context.projects.rename({
      projectId: created.id,
      name: "Nombre definitivo",
    });
    const archived = await context.projects.setStatus({
      projectId: created.id,
      status: "archived",
    });
    const restored = await context.projects.setStatus({
      projectId: created.id,
      status: "draft",
    });

    assert.equal(renamed.name, "Nombre definitivo");
    assert.equal(archived.status, "archived");
    assert.equal(restored.status, "draft");
    assert.equal(await context.database.projects.countSnapshots(created.id), 4);
  } finally {
    await context.cleanup();
  }
});

test("duplica el contenido con identificadores nuevos y sin trabajos", async () => {
  const context = await createContext();

  try {
    const created = await context.projects.create({
      name: "Proyecto original",
      preset: "square",
    });
    const source = await context.projects.open(created.id);
    const duplicateSummary = await context.projects.duplicate({
      projectId: created.id,
      name: "Proyecto duplicado",
    });
    const duplicate = await context.projects.open(duplicateSummary.id);

    assert.notEqual(duplicate.project.id, source.project.id);
    assert.notEqual(
      duplicate.project.mainSequenceId,
      source.project.mainSequenceId,
    );
    assert.deepEqual(
      duplicate.tracks.map((track) => track.kind),
      source.tracks.map((track) => track.kind),
    );
    assert.equal(
      duplicate.tracks.some((track) =>
        source.tracks.some((sourceTrack) => sourceTrack.id === track.id),
      ),
      false,
    );
    assert.equal(duplicate.jobs.length, 0);
    assert.equal(duplicate.project.status, "draft");
    assert.equal(duplicate.project.canvas.aspectRatio, "1:1");
  } finally {
    await context.cleanup();
  }
});

test("lista por actualización y elimina el proyecto solicitado", async () => {
  const context = await createContext();

  try {
    const first = await context.projects.create({
      name: "Primero",
      preset: "horizontal",
    });
    const second = await context.projects.create({
      name: "Segundo",
      preset: "portrait",
    });
    const listed = await context.projects.list();

    assert.equal(listed.length, 2);
    assert.ok(listed.some((project) => project.id === first.id));
    assert.ok(listed.some((project) => project.id === second.id));

    await context.projects.delete(first.id);

    const remaining = await context.projects.list();
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].id, second.id);
  } finally {
    await context.cleanup();
  }
});

test("informa cuando un proyecto no existe", async () => {
  const context = await createContext();

  try {
    const missingId = createEntityId("project", "missing-project-001");

    await assert.rejects(
      context.projects.open(missingId),
      (error) =>
        error instanceof ProjectNotFoundError && error.projectId === missingId,
    );
    await assert.rejects(
      context.projects.delete(missingId),
      (error) => error instanceof ProjectNotFoundError,
    );
  } finally {
    await context.cleanup();
  }
});

test("valida entradas recibidas por IPC", () => {
  assert.deepEqual(
    parseCreateProjectInput({ name: "Proyecto", preset: "horizontal" }),
    { name: "Proyecto", preset: "horizontal" },
  );
  assert.equal(
    parseProjectIdInput({
      projectId: "project_valid-project-001",
    }).projectId,
    "project_valid-project-001",
  );
  assert.equal(
    parseSetProjectStatusInput({
      projectId: "project_valid-project-002",
      status: "archived",
    }).status,
    "archived",
  );
  assert.throws(() =>
    parseCreateProjectInput({ name: "Proyecto", preset: "panoramic" }),
  );
  assert.throws(() =>
    parseSetProjectStatusInput({
      projectId: "project_valid-project-003",
      status: "deleted",
    }),
  );
});
