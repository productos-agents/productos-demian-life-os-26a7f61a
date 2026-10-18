"use client";

import { useEffect, useState } from "react";
import LineIcon from "./LineIcon";
import DotDemianModule from "./DotDemianModule";

type PendingAttachment = { id: string; name: string; attempt: number };
type DemianOpenDetail = { attachmentId?: string; filename?: string };

export default function DemianBubble() {
  const [open, setOpen] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<DemianOpenDetail>).detail || {};
      setPendingAttachment(detail.attachmentId ? { id: detail.attachmentId, name: detail.filename || "archivo", attempt: Date.now() } : null);
      setOpen(true);
    };
    window.addEventListener("demian:open", handleOpen);
    return () => window.removeEventListener("demian:open", handleOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setPendingAttachment(null);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <div className="demianFloatRoot">
      {open && (
        <section className="demianFloatPanel" role="dialog" aria-label="Hablar con DEMIAN">
          <header className="demianFloatPanelHead">
            <span className="demianFloatAvatar"><LineIcon name="brain" size={23} /></span>
            <div className="demianFloatPanelBrand">
              <b>DEMIAN</b>
              <small>Tu segundo cerebro, siempre contigo</small>
            </div>
            <span className="demianFloatStatus"><i /> Listo</span>
            <button type="button" className="demianFloatClose" onClick={() => { setOpen(false); setPendingAttachment(null); }} aria-label="Cerrar DEMIAN">×</button>
          </header>
          <div className="demianFloatPanelBody">
            <DotDemianModule pendingAttachment={pendingAttachment} />
          </div>
        </section>
      )}
      <button
        type="button"
        className={open ? "demianFloatLauncher open" : "demianFloatLauncher"}
        onClick={() => { setOpen(value => !value); setPendingAttachment(null); }}
        aria-label={open ? "Cerrar DEMIAN" : "Hablar con DEMIAN"}
        aria-expanded={open}
      >
        <span className="demianFloatLauncherIcon">{open ? <span className="demianFloatX">×</span> : <LineIcon name="brain" size={25} />}</span>
        <span className="demianFloatLauncherText"><b>{open ? "Cerrar" : "Habla con DEMIAN"}</b><small>{open ? "Tu conversación" : "Tu asistente personal"}</small></span>
        {!open && <span className="demianFloatLauncherDot" />}
      </button>
    </div>
  );
}