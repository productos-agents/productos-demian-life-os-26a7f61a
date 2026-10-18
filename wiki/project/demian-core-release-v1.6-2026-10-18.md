# DEMIAN CORE — Liberación V1.6
Fecha: 2026-10-18 UTC
Estado: publicada y comprobada en Railway.
Commit: `f15cdaa25287c5745a34b3ffe7fe3cf142cdfc57`
Deployment: `c0fdf655-2e2d-4b61-9921-49978329e1e3`
URL: https://demian-life-os-web-production.up.railway.app

## Validación de release
- Railway: `SUCCESS`
- TypeScript: correcto
- Next.js production build: correcto
- `npm run test:smoke`: 9 aprobadas, 0 fallidas
- `/login` y `/`: HTTP 200; title DEMIAN CORE
- Versión visible: V1.6; la etiqueta antigua V0.1 no aparece en la respuesta
- Referencia a `/productos-badge.js`: ausente en el HTML público
- API de datos, finanzas, preferencias y bienestar sin sesión: HTTP 401

## Alcance
- Las notificaciones locales de tareas respetan la preferencia de activación.
- Las tareas pueden editarse, incluir prioridad Alta/Normal/Baja y ordenar por vencimiento/priority.
- Búsqueda global inicial en tareas, hábitos, notas y movimientos financieros que se encuentran cargados; botones de resultado abren el módulo relevante.
- Sidebar usa DEMIAN CORE y APP_VERSION; sin versión fija V0.1.
- `/api/data` admite limit/offset/kind, con `hasMore` y `nextOffset`; notas/hábitos admiten carga incremental y la exportación de notas recorre todos los pages.
- Finanzas ahora pagina movimientos (100 por defecto, hasta 250 por consulta), ofrece carga de más, y consulta agregados server-side para totales actuales, tendencias de seis meses, categorías del mes, totales del mes seleccionado e importe usado por presupuesto.
- El desglose de informes tiene consulta por mes y carga incremental. El PDF consulta totales server-side y presenta la tabla como muestra de máximo 22 movimientos para no sugerir que todo el historial se adjunta.

## Pruebas automatizadas
El script `prebuild` ejecuta `npm run typecheck && npm run test:smoke`. Pruebas cubren orden de tareas, preferencia de notificaciones, edición de tareas con propietario en SQL, búsqueda de módulos, firmas dinámicas, ausencia de ProductOS badge, paginación financiera con filtro de propietario, agregados financieros del servidor e informes mensuales.

## Pendientes después de V1.6
- Migraciones SQL versionadas y procedimiento probado de backup/restauración.
- Política de privacidad, recuperación de cuenta, exportación completa de todos los datos personales y borrado completo de cuenta.
- Integración end-to-end de base de datos con cuentas de prueba separadas; las pruebas actuales son pruebas de regresión sobre el código, no una prueba de penetración ni una suite completa de integración.
- Búsqueda global totalmente server-side/paginada sobre todo el histórico, no solamente los registros que se han cargado.
- Probar cálculos financieros con datos sintéticos de límite/moneda/tipos de cuenta/transferencias y validarlos desde navegador en iOS/Android.
