/* =========================================================
Nombre completo: AppIcon.tsx
Ruta o ubicación: /apps/desktop/renderer/src/components/ui/AppIcon.tsx

Función o funciones:
- Renderizar iconos vectoriales internos sin dependencias externas.
- Mantener un lenguaje visual consistente en navegación y pantallas.
- Permitir que los iconos hereden tamaño y color del componente padre.
========================================================= */

import type { AppIconName } from "../../../../shared/navigation-contracts";

interface AppIconProps {
  readonly name: AppIconName;
  readonly size?: number;
  readonly className?: string;
}

function AppIcon({
  name,
  size = 20,
  className,
}: AppIconProps): React.JSX.Element {
  const commonProps = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  const paths: Record<AppIconName, React.JSX.Element> = {
    home: (
      <>
        <path d="M3.5 10.5 12 3l8.5 7.5" />
        <path d="M5.5 9.5V21h13V9.5" />
        <path d="M9.5 21v-6h5v6" />
      </>
    ),
    projects: (
      <>
        <path d="M3.5 6.5h6l1.8 2H20.5v10.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" />
        <path d="M3.5 9h17" />
      </>
    ),
    editor: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M8 4v16M16 4v16M3 9h5M16 9h5M3 15h5M16 15h5" />
        <path d="m11 9 4 3-4 3Z" />
      </>
    ),
    jobs: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M8 8h8M8 12h5M8 16h3" />
        <path d="m15 15 1.5 1.5L20 13" />
      </>
    ),
    library: (
      <>
        <rect x="3" y="4" width="5" height="16" rx="1" />
        <rect x="10" y="4" width="5" height="16" rx="1" />
        <path d="m17.5 5.2 3.2-.7 3 14.3-3.2.7Z" transform="translate(-2)" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.06.06-2.78 2.78-.06-.06A1.8 1.8 0 0 0 15 19.4a1.8 1.8 0 0 0-1.08 1.65V21h-3.84v-.05A1.8 1.8 0 0 0 9 19.4a1.8 1.8 0 0 0-1.98.36l-.06.06-2.78-2.78.06-.06A1.8 1.8 0 0 0 4.6 15 1.8 1.8 0 0 0 2.95 13.92H3v-3.84h-.05A1.8 1.8 0 0 0 4.6 9a1.8 1.8 0 0 0-.36-1.98l-.06-.06 2.78-2.78.06.06A1.8 1.8 0 0 0 9 4.6a1.8 1.8 0 0 0 1.08-1.65V3h3.84v-.05A1.8 1.8 0 0 0 15 4.6a1.8 1.8 0 0 0 1.98-.36l.06-.06 2.78 2.78-.06.06A1.8 1.8 0 0 0 19.4 9a1.8 1.8 0 0 0 1.65 1.08H21v3.84h.05A1.8 1.8 0 0 0 19.4 15Z" />
      </>
    ),
    menu: (
      <>
        <path d="M4 7h16M4 12h16M4 17h16" />
      </>
    ),
    close: (
      <>
        <path d="m6 6 12 12M18 6 6 18" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14M14 7l5 5-5 5" />
      </>
    ),
    video: (
      <>
        <rect x="3" y="5" width="14" height="14" rx="2" />
        <path d="m17 9 4-2v10l-4-2Z" />
      </>
    ),
    audio: (
      <>
        <path d="M9 18V6l10-2v12" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="16" cy="16" r="3" />
      </>
    ),
    transition: (
      <>
        <path d="M4 5h7v14H4zM13 5h7v14h-7z" />
        <path d="m9 9 3 3-3 3M15 9l-3 3 3 3" />
      </>
    ),
    text: (
      <>
        <path d="M4 5h16M12 5v14M8 19h8" />
      </>
    ),
    check: (
      <>
        <path d="m5 12 4 4L19 6" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 5 6v5c0 4.6 2.8 8.5 7 10 4.2-1.5 7-5.4 7-10V6Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
  };

  return <svg {...commonProps}>{paths[name]}</svg>;
}

export { AppIcon, type AppIconProps };
