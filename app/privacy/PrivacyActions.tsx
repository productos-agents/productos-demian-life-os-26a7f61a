"use client";

import { useState } from "react";

export default function PrivacyActions() {
  const [requestType, setRequestType] = useState("access");
  const [details, setDetails] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function exportData() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/privacy/export", { cache: "no-store" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "No se pudo exportar la información.");
      }
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = "demian-core-export.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
      setMessage("La exportación se descargó en este dispositivo.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo exportar la información.");
    } finally { setBusy(false); }
  }

  async function submitRequest(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/privacy/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestType, details, confirmation })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "No se pudo registrar la solicitud.");
      setMessage(payload.message + " Folio: " + payload.requestId);
      setDetails(""); setConfirmation("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo registrar la solicitud.");
    } finally { setBusy(false); }
  }

  return <div className="privacyActions">
    <section>
      <h2>Descargar tus datos</h2>
      <p>Descarga tus registros personales, hábitos, bienestar, check-ins, preferencias y el historial financiero vinculado a la cuenta. El archivo no incluye contraseñas, claves de notificaciones ni endpoints privados de dispositivos.</p>
      <button type="button" onClick={() => void exportData()} disabled={busy}>{busy ? "Procesando…" : "Descargar una copia de mis datos"}</button>
    </section>
    <section>
      <h2>Solicitar atención de privacidad</h2>
      <p>Registra una solicitud de acceso, corrección o eliminación. Por seguridad, la solicitud queda pendiente de revisión; la eliminación de datos no ocurre automáticamente.</p>
      <form onSubmit={submitRequest}>
        <label>Tipo de solicitud
          <select value={requestType} onChange={e => setRequestType(e.target.value)}>
            <option value="access">Acceso / copia de mis datos</option>
            <option value="correction">Corrección de información</option>
            <option value="deletion">Eliminación de cuenta y datos</option>
          </select>
        </label>
        <label>Detalles (opcional)
          <textarea value={details} onChange={e => setDetails(e.target.value)} maxLength={1500} rows={3} placeholder="Describe qué información o solicitud necesitas revisar." />
        </label>
        {requestType === "deletion" && <label>Para confirmar, escribe exactamente: SOLICITO ELIMINAR MIS DATOS
          <input value={confirmation} onChange={e => setConfirmation(e.target.value)} required />
        </label>}
        <button type="submit" disabled={busy}>{busy ? "Enviando…" : "Registrar solicitud"}</button>
      </form>
    </section>
    {message && <p role="status" className="privacyMessage">{message}</p>}
  </div>;
}
