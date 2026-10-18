"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type PrivacyRequest = {
  id: string;
  email: string;
  request_type: "access" | "correction" | "deletion";
  details: string;
  status: "pending" | "in_review" | "completed" | "rejected";
  requested_at: string;
  processed_at: string | null;
  resolution_note: string;
};

export default function PrivacyRequestsPage() {
  const [rows, setRows] = useState<PrivacyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/privacy/requests?admin=true", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "No se pudieron consultar las solicitudes.");
      setRows(payload.requests || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron consultar las solicitudes.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function changeStatus(row: PrivacyRequest, status: string) {
    const resolutionNote = window.prompt("Nota de resolución (no se borra ningún dato automáticamente):", row.resolution_note || "");
    if (resolutionNote === null) return;
    setBusyId(row.id); setError(""); setMessage("");
    try {
      const response = await fetch("/api/privacy/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, status, resolutionNote })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "No se pudo actualizar la solicitud.");
      setMessage("Estado actualizado. La eliminación de datos requiere procesamiento manual verificado.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo actualizar la solicitud.");
    } finally { setBusyId(""); }
  }

  return <main className="privacyAdmin">
    <header>
      <div><p className="privacyEyebrow">DEMIAN CORE · RESPONSABLE</p><h1>Solicitudes de privacidad</h1><p>Consola restringida al espacio responsable (cuenta legacy).</p></div>
      <Link href="/privacy">Volver al aviso</Link>
    </header>
    <section className="privacyRequestCard">
      <b>Importante para solicitudes de eliminación</b>
      <p>Marcar una solicitud como resuelta no elimina datos por sí solo. Primero debe completarse el borrado de la cuenta y sus datos relacionados, verificar que no existan registros residuales y documentar el resultado.</p>
    </section>
    {error && <p className="privacyMessage" role="alert">{error}</p>}
    {message && <p className="privacyMessage" role="status">{message}</p>}
    {loading ? <p>Cargando solicitudes…</p> : rows.length ? rows.map(row => <article className="privacyRequestCard" key={row.id}>
      <div><b>{row.request_type === "deletion" ? "Eliminación de datos" : row.request_type === "correction" ? "Corrección" : "Acceso / copia"}</b><div className="privacyRequestMeta"><span>{row.email}</span><span>· {new Date(row.requested_at).toLocaleString("es-MX")}</span><span>· {row.status}</span></div></div>
      {row.details && <p>{row.details}</p>}
      {row.resolution_note && <p><b>Nota:</b> {row.resolution_note}</p>}
      <div className="privacyRequestActions">
        <button disabled={busyId === row.id} onClick={() => void changeStatus(row, "in_review")}>En revisión</button>
        <button disabled={busyId === row.id} onClick={() => void changeStatus(row, "completed")}>Marcar resuelta</button>
        <button disabled={busyId === row.id} onClick={() => void changeStatus(row, "rejected")}>Rechazar</button>
      </div>
    </article>) : <p>No hay solicitudes registradas.</p>}
  </main>;
}
