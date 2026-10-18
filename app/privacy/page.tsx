import Link from "next/link";
import PrivacyActions from "./PrivacyActions";

export const metadata = {
  title: "Aviso de privacidad · DEMIAN CORE",
  description: "Información sobre el uso, exportación y solicitudes de privacidad de DEMIAN CORE."
};

export default function PrivacyPage() {
  return <main className="privacyPage">
    <header>
      <p className="privacyEyebrow">DEMIAN CORE · J D O SERVICES</p>
      <h1>Aviso de privacidad</h1>
      <p>Este aviso explica qué información guarda DEMIAN CORE, para qué se utiliza y cómo puedes solicitar una copia, corrección o eliminación.</p>
    </header>
    <section>
      <h2>Información que puede almacenarse</h2>
      <p>Datos de cuenta (nombre y correo), tareas, notas, hábitos y sus registros de cumplimiento; datos de bienestar y check-ins que captures; movimientos, cuentas, categorías, presupuestos, metas y recurrencias financieras; preferencias de la aplicación; y el estado de las notificaciones que configures.</p>
    </section>
    <section>
      <h2>Finalidades</h2>
      <p>La información se utiliza para proporcionar las funciones que solicitas, guardar tu historial entre sesiones, calcular indicadores, sincronizar tus datos, administrar la seguridad de la cuenta y entregar notificaciones que habilites.</p>
    </section>
    <section>
      <h2>Almacenamiento y protección</h2>
      <p>La aplicación se ejecuta en Railway y utiliza bases de datos PostgreSQL configuradas para DEMIAN CORE y FLUX. Las solicitudes autenticadas se limitan a la cuenta que inició sesión. Las contraseñas se guardan mediante hash; los archivos de exportación omiten hash de contraseñas, claves VAPID, claves de suscripción y endpoints de notificación.</p>
    </section>
    <section>
      <h2>Conservación y control</h2>
      <p>Los datos se conservan mientras la cuenta y sus registros estén activos, salvo que se procese una solicitud de eliminación o sea necesario mantener ciertos registros operativos. Puedes descargar una copia desde esta página. Las solicitudes de eliminación se revisan antes de ejecutarse para evitar pérdidas accidentales o borrar información de otra cuenta.</p>
    </section>
    <section>
      <h2>Copias de seguridad y recuperación</h2>
      <p>La exportación no sustituye a una copia de seguridad administrada de la base de datos. La disponibilidad y retención de respaldos depende de la configuración vigente del proveedor y debe verificarse por separado; no se considera confirmada una restauración hasta probarla en una base aislada.</p>
    </section>
    <section>
      <h2>Contacto</h2>
      <p>DEMIAN CORE es un producto de J D O SERVICES. Para información corporativa, visita el <a href="https://jdo-services-web.vercel.app" target="_blank" rel="noreferrer">sitio oficial de J D O SERVICES</a>. Esta página es un aviso operativo; cualquier formalización jurídica debe ser revisada por el responsable de privacidad.</p>
    </section>
    <PrivacyActions />
    <footer><Link href="/privacy/requests">Consola de solicitudes del responsable</Link><Link href="/login">Volver al acceso</Link><span>DEMIAN CORE · DESARROLLADO POR J D O SERVICES</span></footer>
  </main>;
}
