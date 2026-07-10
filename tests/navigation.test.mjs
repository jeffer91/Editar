/* =========================================================
Nombre completo: navigation.test.mjs
Ruta o ubicación: /tests/navigation.test.mjs

Función o funciones:
- Probar conversión entre rutas y hashes.
- Confirmar que rutas inválidas vuelven al inicio.
- Verificar que la navegación no tenga rutas duplicadas.
========================================================= */

import assert from "node:assert/strict";
import test from "node:test";
import {
  APP_ROUTES,
  DEFAULT_ROUTE,
  NAVIGATION_ITEMS,
  getNavigationItem,
  hashForRoute,
  routeFromHash,
} from "../dist-electron/shared/navigation-contracts.js";

test("convierte rutas válidas desde el hash", () => {
  assert.equal(routeFromHash("#/projects"), "projects");
  assert.equal(routeFromHash("#editor"), "editor");
  assert.equal(routeFromHash("#/settings?tab=system"), "settings");
});

test("usa inicio cuando el hash es vacío o inválido", () => {
  assert.equal(routeFromHash(""), DEFAULT_ROUTE);
  assert.equal(routeFromHash("#/unknown"), DEFAULT_ROUTE);
});

test("genera hashes consistentes", () => {
  for (const route of APP_ROUTES) {
    assert.equal(routeFromHash(hashForRoute(route)), route);
  }
});

test("cada ruta aparece una sola vez en la navegación", () => {
  const routes = NAVIGATION_ITEMS.map((item) => item.route);

  assert.equal(routes.length, APP_ROUTES.length);
  assert.equal(new Set(routes).size, APP_ROUTES.length);
  assert.deepEqual(routes, [...APP_ROUTES]);
});

test("recupera metadatos de cada pantalla", () => {
  for (const route of APP_ROUTES) {
    const item = getNavigationItem(route);

    assert.equal(item.route, route);
    assert.ok(item.label.length > 0);
    assert.ok(item.description.length > 0);
  }
});
