/* =========================================================
Nombre completo: App.tsx
Ruta o ubicación: /apps/desktop/renderer/src/App.tsx

Función o funciones:
- Coordinar navegación, estado del sistema y proyecto activo.
- Renderizar el shell visual compartido.
- Abrir proyectos seleccionados dentro del editor.
========================================================= */

import { useState } from "react";
import type { ProjectDocument } from "../../shared/domain";
import type { AppRoute } from "../../shared/navigation-contracts";
import { useHashNavigation } from "./app/use-hash-navigation";
import { useSystemStatus } from "./app/use-system-status";
import { AppShell } from "./components/layout/AppShell";
import { EditorScreen } from "./screens/EditorScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { LibraryScreen } from "./screens/LibraryScreen";
import { ProjectsScreen } from "./screens/ProjectsScreen";
import { SettingsScreen } from "./screens/SettingsScreen";

function App(): React.JSX.Element {
  const { currentRoute, navigate } = useHashNavigation();
  const systemStatus = useSystemStatus();
  const [activeProject, setActiveProject] =
    useState<ProjectDocument | null>(null);

  const openProject = (document: ProjectDocument): void => {
    setActiveProject(document);
    navigate("editor");
  };

  const renderScreen = (route: AppRoute): React.JSX.Element => {
    switch (route) {
      case "projects":
        return <ProjectsScreen onOpenProject={openProject} />;
      case "editor":
        return (
          <EditorScreen
            project={activeProject}
            onChooseProject={() => navigate("projects")}
          />
        );
      case "library":
        return <LibraryScreen />;
      case "settings":
        return (
          <SettingsScreen
            runtime={systemStatus.runtime}
            connectionState={systemStatus.connectionState}
            latencyMs={systemStatus.latencyMs}
            errorMessage={systemStatus.errorMessage}
            onCheckConnection={systemStatus.checkConnection}
          />
        );
      case "home":
      default:
        return (
          <HomeScreen
            runtime={systemStatus.runtime}
            latencyMs={systemStatus.latencyMs}
            onNavigate={navigate}
          />
        );
    }
  };

  return (
    <AppShell
      currentRoute={currentRoute}
      connectionState={systemStatus.connectionState}
      onNavigate={navigate}
    >
      {renderScreen(currentRoute)}
    </AppShell>
  );
}

export { App };
