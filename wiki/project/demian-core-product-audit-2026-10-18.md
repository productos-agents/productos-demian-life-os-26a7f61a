# Auditoría funcional y técnica — DEMIAN CORE
Fecha: 2026-10-18 UTC
Versión observada en producción: V1.4
Alcance: revisión estática del código del proyecto, comprobaciones HTTP sin sesión, compilación registrada y estado de despliegue Railway. No se modificó el código de la aplicación durante esta auditoría.

## Resumen ejecutivo
La aplicación está desplegada y operativa, cuenta con persistencia en PostgreSQL, separación por usuario en las consultas principales, autenticación mediante cookie firmada y un servicio independiente de notificaciones programadas. Tiene módulos funcionales para tareas, finanzas, bienestar/hábitos y notas/conocimiento.
No debe declararse “100% completa” todavía: faltan pruebas automatizadas y migraciones versionadas; varias funciones de organización son superficiales; los límites de lectura pueden ocultar historial; y hay una inconsistencia en preferencias de notificaciones. Antes de crecer en usuarios, deben priorizarse los riesgos P1 indicados abajo.

## Verificaciones positivas
- Producción Railway: servicio web en línea, un replica activo, sin fallos recientes ni incidencias reportadas.
- Scheduler push separado: servicio vivo, cron `*/5 * * * *`; la última ejecución se reportó como exitosa.
- Pruebas HTTP sin sesión: `/api/data`, `/api/finance`, `/api/preferences`, `/api/wellness`, `/api/push/mood` y `/api/push/subscription` respondieron 401.
- Autenticación: cookie `httpOnly`, `secure` en producción y `sameSite=strict`; hash de contraseña con scrypt; limitador por IP para intentos fallidos.
- El proxy valida la firma HMAC de la sesión y añade los IDs de usuario a las solicitudes; las consultas principales de datos y finanzas incluyen el propietario en el filtro SQL.
- Build y TypeScript pasan en la versión V1.4. El repositorio no contiene pruebas automatizadas del producto ni scripts de migración SQL/versionada.
- Persistencia: API principal sobre DEMIAN_DATABASE_URL y módulo financiero conectado a FLUX_DATABASE_URL.

## Inventario por módulo

### Centro de control
Existe resumen de tareas, saldo, ingresos/gastos del mes, hábitos y notas, además de frase diaria y exportación ICS de tareas con fecha.
Brechas:
- El campo “Buscar en tu sistema” no realiza búsqueda verdaderamente global. El estado de consulta solo alimenta el filtro de registros genérico; no filtra de forma coherente el dashboard, FLUX ni el módulo de bienestar/conocimiento.
- “Lo que sigue” usa tareas abiertas en orden de creación descendente; no calcula un orden por vencimiento/importancia. El modelo no contiene prioridad.
- Una tarea puede completarse o eliminarse, pero el PATCH de `demian_items` no permite editar sus datos. Corregir título, detalles o fecha requiere recrear.
- Hay tareas con vencimiento y un recuento de pendientes vencidos, pero no existe todavía un ciclo de planificación/revisión semanal con medición de progreso.

### Finanzas (FLUX)
Existe resumen financiero, movimientos, cuentas, presupuestos, objetivos de ahorro, transacciones recurrentes, categorías y reportes PDF; crea transferencias usando dos movimientos dentro de una transacción SQL y excluye transferencias de ingresos/gastos ordinarios.
Brechas:
- `GET /api/finance` devuelve como máximo los 1,000 movimientos más recientes. Las tendencias, reportes históricos y análisis de presupuesto usan la lista devuelta; con más de 1,000 movimientos algunos informes podrían quedar incompletos, mientras que los saldos de cuentas se calculan por otra consulta agregada sobre el historial completo.
- No hay paginación de movimientos.
- Debe verificarse el comportamiento con casos límite (meses, traspasos, crédito, recurrentes vencidos y límites presupuestarios) con pruebas, no solo con build.

### Bienestar y hábitos
El módulo registra sueño, vasos de agua, minutos de actividad, estado de ánimo, peso y notas por fecha; calcula promedios simples de siete días. Los hábitos se registran mediante logs diarios.
Brechas:
- La frecuencia del hábito parece guardarse como texto, pero el registro de cumplimiento es diario para cualquier frecuencia; la cadencia semanal/mensual no se hace cumplir en el modelo ni en el resumen.
- El estado de ánimo tiene una vía de check-ins de push y otra de registro diario de bienestar; no se aprecia una vista consolidada de tendencias de ánimo.
- Es información personal sensible: no se encontró una pantalla/página de política de privacidad completa ni flujo de exportación/borrado total de cuenta y datos.

### Segundo cerebro / conocimiento
Notas con título, contenido, categoría, búsqueda local, favoritos, edición y borrado; puede exportar nota individual a Markdown y biblioteca visible a JSON.
Brechas:
- `GET /api/data` devuelve como máximo los 500 registros más recientes; los módulos que filtran esos datos no tienen paginación. En colecciones grandes, notas antiguas quedan fuera de búsqueda/exportación.
- El selector de importación acepta .txt, .md, .csv y .json, pero la lógica actual lee el archivo como texto y lo convierte en una sola nota; no restaura una biblioteca JSON ni parsea CSV.
- No hay exportación completa de todos los datos de la cuenta en un formato de respaldo único.

### Notificaciones push
Hay service worker, tabla de suscripciones, servicio scheduler independiente en cron cada cinco minutos, zona horaria de Ciudad de México y claves de idempotencia para evitar envíos repetidos.
Hallazgo P1:
- El efecto de notificaciones locales de tareas vencidas comprueba conexión y permiso del navegador, pero no comprueba el booleano de preferencia `reminders`. Desactivar las notificaciones push puede no impedir que esa notificación local aparezca mientras el permiso del navegador siga concedido. Separar con claridad push remota y recordatorios locales, y respetar la preferencia.
- El scheduler y las suscripciones se ejecutan, pero la experiencia completa necesita pruebas por dispositivo, permisos, desactivación y recuperación de suscripciones.

## Hallazgos priorizados

### P1 — Corregir antes de añadir nuevas funciones
1. Preferencia de recordatorios: evitar notificaciones locales cuando se desactivan; distinguir y documentar notificación local vs push.
2. Historiales truncados: introducir paginación o agregaciones del lado servidor para datos personales, notas y finanzas; evitar reportes que parezcan completos cuando sólo usan 500/1,000 registros.
3. Planificación diaria real: ordenar tareas por vencimiento, exponer atrasos y permitir editar tareas sin recrearlas; añadir un campo de prioridad únicamente con una interacción simple y útil.
4. Coherencia del producto: `app/page.tsx` aún muestra el rótulo estático “DEMian LIFE OS · V0.1” en la barra lateral mientras el paquete/versionado compartido ya se encuentra en V1.4. Debe usar el nombre DEMIAN CORE y la fuente única APP_VERSION.
5. Reproducibilidad de base de datos: no se encontraron scripts SQL ni migraciones versionadas en el repositorio, aunque el runtime espera tablas precreadas. Crear migraciones versionadas y un procedimiento documentado para una instalación/restauración reproducible.

### P2 — Validar para una experiencia confiable
6. Implementar búsqueda global coherente o cambiar su etiqueta para describir su alcance real.
7. Alinear frecuencia configurada y registro de hábitos, y añadir revisión semanal que permita ver tendencias y ajustar objetivos sin culpabilizar al usuario.
8. Añadir recuperación segura de cuenta, verificación de correo o mecanismo equivalente, política de privacidad y exportación/borrado de datos personales. La sesión actual es firmada y stateless con vigencia de 30 días; el logout elimina la cookie del dispositivo pero no ofrece revocación centralizada de un token sustraído.
9. Ajustar importación de notas para que los formatos aceptados coincidan con lo que hace realmente el importador; añadir restauración validada si se quiere admitir JSON/CSV.
10. Incorporar pruebas automatizadas: API multiusuario, autorización, cálculos financieros, fechas/zonas horarias, presupuestos, recurrentes, logs de hábitos, push enable/disable y regresiones de PWA.

## Plan recomendado de ejecución
Fase 1: corregir preferencia de notificaciones, etiqueta estática de versión, edición/orden de tareas y búsqueda global; agregar pruebas para estos flujos.
Fase 2: paginación/agregaciones financieras y de contenido, pruebas de cálculos, migraciones versionadas y verificación de backups/restauración.
Fase 3: resumen semanal de progreso, insights de bienestar y sistema de medición del valor del producto con usuarios voluntarios.
Fase 4: privacidad, recuperación de cuenta, exportación/borrado total y endurecimiento de sesiones antes de ampliar la audiencia.

## Límites de esta auditoría
Las comprobaciones de HTTP verifican que los endpoints exigen sesión sin una cookie, pero no sustituyen una auditoría de penetración. No se inspeccionaron datos privados de usuarios ni se verificó la configuración efectiva de backups del proveedor de base de datos. La existencia de un despliegue sano no demuestra por sí sola que los flujos de usuario funcionen en todos los dispositivos.
