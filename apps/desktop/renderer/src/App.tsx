/* =========================================================
Nombre completo: App.tsx
Ruta o ubicación: /apps/desktop/renderer/src/App.tsx

Función o funciones:
- Coordinar navegación, estado del sistema y pantallas.
- Renderizar el shell visual compartido.
- Mantener cada pantalla desacoplada de la infraestructura Electron.
========================================================= */

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

  const renderScreen = (route: AppRoute): React.JSX.Element => {
    switch (route) {
      case "projects":
        return <ProjectsScreen onNavigate={navigate} />;
      case "editor":
        return <EditorScreen />;
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
