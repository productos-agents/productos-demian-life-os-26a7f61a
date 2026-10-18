# Project Memory

One durable fact per bullet — decisions, preferences, constraints, gotchas.
Newest at the bottom. Curate in place: update what changed, delete what is
wrong, merge duplicates, flag contradictions with ⚠️. Use ⛔ for hard
"never do this" rules. When this file passes ~200 lines, consolidate detail
into topic files in this folder and keep a one-line pointer here.
Detail pages: `<topic>.md` next to this file. Journal: `log.md` (append-only).
Never store secrets, API keys, or tokens here.

## Facts
- En DEMIAN CORE, la firma del desarrollador debe mostrar la versión vigente del lanzamiento de forma dinámica e idéntica tanto en la pantalla de inicio de sesión como en el pie de la plataforma principal; nunca dejar V1.0 ni otra versión escrita por separado en cada pantalla. #regla-obligatoria #versionado #firma-desarrollador #branding (mcp, 2026-10-18)
- Cada vez que se publique una nueva versión de DEMIAN CORE, la versión visible en las firmas de inicio de sesión y plataforma principal debe actualizarse automáticamente desde una única fuente de versión y permanecer sincronizada. #release #versionado-automatico #firma (mcp, 2026-10-18)
- El versionado visible de DEMIAN CORE tiene una única fuente: la versión semántica de package.json, transformada por lib/app-version.ts en APP_VERSION; las firmas de app/login/page.tsx y app/page.tsx deben usar APP_VERSION y nunca escribir manualmente el número. #regla-obligatoria #release #versionado-automatico #fuente-unica (mcp, 2026-10-18)
- En DEMIAN CORE todos los acentos de interfaz no semánticos, incluidos enlaces del módulo financiero como Ver informe, Gestionar y llamadas vacías como Crear el primero, deben usar el color dinámico del tema elegido; no codificar tonos verdes fijos para esos textos. #tema-dinamico #bug-preventivo #finanzas #colores-ui (mcp, 2026-10-18)
- Regla obligatoria de DEMIAN CORE: no mostrar ni volver a cargar el badge o marca de agua 'Built with ProductOS' en ninguna ruta, producción, preview, despliegue ni actualización. Mantener eliminado el cargador `/productos-badge.js` del layout global; no reintroducirlo en futuros cambios. #branding #regla-obligatoria #no-watermark #deployment #ProductOS (mcp, 2026-10-18)
