"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function RecoveryPage() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") || "");
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      let url = "/api/auth/recovery";
      let body: Record<string, string> = { email };
      if (token) {
        if (password !== confirm) throw new Error("Las contraseñas no coinciden.");
        if (password.length < 10) throw new Error("Usa al menos 10 caracteres.");
        url = "/api/auth/recovery/confirm";
        body = { token, password };
      }
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "No se pudo procesar la solicitud.");
      setMessage(result.message || "Listo. Ya puedes iniciar sesión.");
      setPassword(""); setConfirm("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo procesar la solicitud.");
    } finally { setBusy(false); }
  }
  return <main className="loginShell">
    <section className="loginCard recoveryCard">
      <p className="eyebrow">DEMIAN CORE · CUENTA</p>
      <h1>{token ? <>Nueva<br/><span>contraseña.</span></> : <>Recupera tu<br/><span>acceso.</span></>}</h1>
      <p className="subhead">{token ? "Elige una contraseña nueva. El enlace de recuperación se utiliza una sola vez." : "Solicita un enlace seguro para cambiar la contraseña de tu cuenta."}</p>
      <form onSubmit={submit}>
        {!token && <label htmlFor="email">Correo electrónico<input id="email" name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com" /></label>}
        {token && <>
          <label htmlFor="password">Contraseña nueva<input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={256} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 10 caracteres" /></label>
          <label htmlFor="confirm">Confirmar contraseña<input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={10} maxLength={256} value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
        </>}
        {error && <p className="loginError" role="alert">{error}</p>}
        {message && <p className="loginNotice" role="status">{message}</p>}
        <button className="primaryBtn" disabled={busy}>{busy ? "Procesando…" : token ? "Actualizar contraseña" : "Enviar enlace de recuperación"}</button>
      </form>
      {!token && <p className="recoveryHint">El envío requiere que el responsable configure el proveedor de correo. Si está deshabilitado, aparecerá un aviso claro.</p>}
      <p><Link href="/login">Volver a iniciar sesión</Link> · <Link href="/privacy">Aviso de privacidad</Link></p>
    </section>
  </main>;
}
