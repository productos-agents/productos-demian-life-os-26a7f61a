"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { APP_VERSION } from "../../lib/app-version";

type Mode = "login" | "register" | "legacy";
export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const router = useRouter();

  function switchMode(next: Mode) {
    setMode(next); setError(""); setNotice(""); setPassword(""); setConfirm("");
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    if (mode === "register" && password !== confirm) {
      setError("Las contraseñas no coinciden."); setBusy(false); return;
    }
    try {
      const payload = mode === "register"
        ? { action: "register", name, email, password }
        : mode === "legacy"
          ? { action: "legacy", password }
          : { action: "login", email, password };
      const r = await fetch("/api/auth", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "No se pudo entrar a DEMian.");
      const next = new URLSearchParams(window.location.search).get("next") || "/";
      router.replace(next.startsWith("/") && !next.startsWith("//") ? next : "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de conexión.");
    } finally { setBusy(false); }
  }
  return <main className="loginShell">
    <div className="loginGlow" />
    <section className="loginCard">
      <div className="brand loginBrand"><img className="loginAppLogo" src="/icon.svg" alt="DEMIAN CORE" /><div><b>DEMIAN CORE</b><small>SISTEMA <i>PERSONAL</i></small></div></div>
      <p className="eyebrow">{mode === "register" ? "TU ESPACIO EMPIEZA AQUÍ" : mode === "legacy" ? "RECUPERA TU ESPACIO ANTERIOR" : "TU ESPACIO PERSONAL"}</p>
      <h1>{mode === "register" ? <>Crea tu cuenta,<br /><span>a tu manera.</span></> : mode === "legacy" ? <>Volvamos a<br /><span>tu espacio.</span></> : <>Tu vida,<br /><span>en orden.</span></>}</h1>
      <p className="subhead">{mode === "register" ? "Tu cuenta, tus datos, tus decisiones. Un espacio privado para organizar tu vida." : mode === "legacy" ? "Entra con la clave anterior para recuperar tus registros guardados." : "Un espacio privado para tus tareas, finanzas, hábitos e ideas."}</p>
      <form onSubmit={submit}>
        {mode === "register" && <label htmlFor="name">¿Cómo te llamas?<input id="name" name="name" autoComplete="name" maxLength={80} required value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre" /></label>}
        {mode !== "legacy" && <label htmlFor="email">Correo electrónico<input id="email" name="email" type="email" autoComplete={mode === "register" ? "email" : "username"} maxLength={254} required value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com" /></label>}
        <label htmlFor="password">{mode === "legacy" ? "Clave de acceso anterior" : "Contraseña"}<input id="password" name="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={mode === "register" ? 10 : undefined} maxLength={256} required value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === "legacy" ? "Tu clave anterior" : mode === "register" ? "Mínimo 10 caracteres" : "Tu contraseña"} /></label>
        {mode === "register" && <label htmlFor="confirm">Confirmar contraseña<input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} maxLength={256} required value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Escríbela otra vez" /></label>}
        {error && <p className="loginError" role="alert">{error}</p>}
        {notice && <p className="loginNotice" role="status">{notice}</p>}
        <button className="primaryBtn" disabled={busy}>{busy ? "Un momento…" : mode === "register" ? "Crear mi cuenta →" : mode === "legacy" ? "Recuperar espacio anterior →" : "INICIAR SESIÓN"}</button>
      </form>
      <div className="loginLinks">
        {mode === "login" && <><button type="button" onClick={() => switchMode("register")}>Crear una cuenta nueva</button><button type="button" onClick={() => switchMode("legacy")}>Entrar con la clave anterior</button></>}
        {mode === "register" && <button type="button" onClick={() => switchMode("login")}>Ya tengo una cuenta · Iniciar sesión</button>}
        {mode === "legacy" && <button type="button" onClick={() => switchMode("login")}>Volver a iniciar sesión</button>}
      </div>
      <div className="loginFoot"><span className="statusDot connected" /> ACCESO PROTEGIDO · DATOS POR CUENTA</div>
      <footer className="footer developerSignature loginDeveloperSignature"><span className="signatureCaption">DEMIAN CORE {APP_VERSION} · DESARROLLADO POR J D O SERVICES</span><div className="signatureLogo"><img src="/jdo-services-logo.webp" alt="Logotipo oficial JDO Services" className="signatureLogoImage" /></div></footer>
    </section>
  </main>;
}
