"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import LineIcon from "./LineIcon";

type Role = "user" | "assistant";
type Message = { id?: number; role: Role; content: string; created_at?: string };
type Conversation = { id: string; title: string; updated_at: string };
type ApiError = { ok?: false; error?: string };
type PendingAttachment = { id: string; name: string; attempt?: number } | null;
type PendingAction = {
  type: "finance.transaction.create" | "finance.transaction.update";
  transactionId?: string;
  transactionType: "income" | "expense";
  amount: number;
  category: string;
  description: string;
  accountName: string;
  date: string;
};

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) }
  });
  const data = await response.json().catch(() => ({})) as T & ApiError;
  if (!response.ok || data.ok === false) throw new Error(data.error || "No se pudo completar la solicitud.");
  return data;
}

const quickPrompts = [
  { title: "Organiza mi día", text: "Ayúdame a organizar mi día con prioridades y pasos concretos." },
  { title: "Aclara una decisión", text: "Ayúdame a comparar opciones, riesgos y beneficios de una decisión." },
  { title: "Desarrolla una idea", text: "Ayúdame a convertir una idea en un plan sencillo, paso a paso." }
];

async function extractDocumentText(file: File) {
  const extension = file.name.toLowerCase().split(".").pop() || "";
  let text = "";
  if (extension === "pdf") {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages: string[] = [];
    const maxPages = Math.min(pdf.numPages, 60);
    for (let number = 1; number <= maxPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      pages.push((content.items as Array<{ str?: string }>).map(item => item.str || "").join(" "));
    }
    text = pages.join("\n\n");
    if (pdf.numPages > maxPages) text += "\n\n[Texto extraído parcialmente: el PDF supera el límite de 60 páginas.]";
  } else if (extension === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    text = result.value;
  } else if (extension === "xlsx" || extension === "xls") {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    text = workbook.SheetNames.slice(0, 20).map(name => "Hoja: " + name + "\n" + XLSX.utils.sheet_to_csv(workbook.Sheets[name])).join("\n\n");
  } else {
    text = await file.text();
  }
  return text.replace(/\u0000/g, "").trim().slice(0, 100000);
}

export default function DotDemianModule({ pendingAttachment = null }: { pendingAttachment?: PendingAttachment }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [provider, setProvider] = useState("IA gratuita");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const feed = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const handledAttachmentRef = useRef<string | null>(null);

  const scrollToLatest = useCallback(() => {
    requestAnimationFrame(() => feed.current?.scrollTo({ top: feed.current.scrollHeight, behavior: "smooth" }));
  }, []);

  const refreshConversations = useCallback(async () => {
    const data = await api<{ conversations: Conversation[]; configured: boolean; provider: string }>("/api/assistant");
    setConversations(data.conversations || []);
    setConfigured(data.configured === true);
    setProvider(data.provider || "IA gratuita");
    return data.conversations || [];
  }, []);

  const openConversation = useCallback(async (id: string) => {
    setActiveId(id);
    setMessages([]);
    setPendingAction(null);
    setError("");
    try {
      const data = await api<{ messages: Message[] }>("/api/assistant?conversationId=" + encodeURIComponent(id));
      setMessages(data.messages || []);
      scrollToLatest();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir la conversación.");
    }
  }, [scrollToLatest]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await api<{ conversations: Conversation[]; configured: boolean; provider: string }>("/api/assistant");
        if (!mounted) return;
        setConversations(data.conversations || []);
        setConfigured(data.configured === true);
        setProvider(data.provider || "IA gratuita");
        if (data.conversations?.[0]) {
          const first = await api<{ messages: Message[] }>("/api/assistant?conversationId=" + encodeURIComponent(data.conversations[0].id));
          if (!mounted) return;
          setActiveId(data.conversations[0].id);
          setMessages(first.messages || []);
        }
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : "No se pudo abrir DEMIAN.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => { scrollToLatest(); }, [messages, scrollToLatest]);

  function newConversation() {
    setActiveId(null);
    setMessages([]);
    setPendingAction(null);
    setDraft("");
    setError("");
    input.current?.focus();
  }

  async function sendMessage(text = draft, attachmentId?: string) {
    const message = text.trim();
    if (!message || sending) return;
    if (!configured) {
      setError("El motor gratuito no está disponible en este momento. Inténtalo de nuevo más tarde.");
      return;
    }
    setSending(true);
    setError("");
    setPendingAction(null);
    setDraft("");
    setMessages(previous => [...previous, { role: "user", content: message }]);
    try {
      const data = await api<{ conversationId: string; reply: string; pendingAction?: PendingAction | null; refreshData?: boolean; fileSaved?: boolean }>("/api/assistant", {
        method: "POST",
        body: JSON.stringify({ message, conversationId: activeId, attachmentId })
      });
      setActiveId(data.conversationId);
      setMessages(previous => [...previous, { role: "assistant", content: data.reply }]);
      setPendingAction(data.pendingAction || null);
      if (data.refreshData) window.dispatchEvent(new Event("demian:data-changed"));
      await refreshConversations();
    } catch (e) {
      setError(attachmentId
        ? "El archivo original quedó subido. No pude organizarlo ahora; vuelve a intentarlo desde Segundo cerebro → Archivos guardados."
        : e instanceof Error ? e.message : "No se pudo obtener una respuesta. Inténtalo de nuevo.");
    } finally {
      setSending(false);
      input.current?.focus();
    }
  }

  useEffect(() => {
    if (!pendingAttachment || loading || !configured || sending) return;
    const attemptKey = pendingAttachment.id + ":" + String(pendingAttachment.attempt || 0);
    if (handledAttachmentRef.current === attemptKey) return;
    handledAttachmentRef.current = attemptKey;
    void sendMessage("Organiza y guarda el archivo «" + pendingAttachment.name + "» en mi Segundo cerebro.", pendingAttachment.id);
  }, [pendingAttachment?.id, pendingAttachment?.attempt, loading, configured, sending]);

  async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || uploading || sending) return;
    if (file.size < 1 || file.size > 8 * 1024 * 1024) {
      setError("Cada archivo debe pesar como máximo 8 MB.");
      return;
    }
    const extension = file.name.toLowerCase().split(".").pop() || "";
    const supported = ["pdf","docx","xlsx","xls","csv","tsv","txt","md","json","html","xml","yaml","yml","log"];
    if (!supported.includes(extension)) {
      setError("Puedo recibir PDF, Word, Excel, CSV, TSV, texto, Markdown, JSON, HTML y XML.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      let extractedText = "";
      try { extractedText = await extractDocumentText(file); }
      catch { extractedText = ""; }
      const form = new FormData();
      form.append("file", file);
      form.append("extractedText", extractedText);
      const response = await fetch("/api/brain/files", { method: "POST", body: form, cache: "no-store" });
      const payload = await response.json().catch(() => ({})) as { ok?: boolean; error?: string; file?: { id: string; name: string } };
      if (!response.ok || !payload.ok || !payload.file?.id) throw new Error(payload.error || "No se pudo guardar el archivo original.");
      window.dispatchEvent(new Event("demian:data-changed"));
      const notice = extractedText
        ? "Revisa, clasifica y guarda en mi Segundo cerebro el archivo «" + file.name + "»."
        : "Guarda y clasifica en mi Segundo cerebro el archivo «" + file.name + "». No se pudo extraer texto; organiza solo con el nombre y el tipo, sin inventar el contenido.";
      await sendMessage(notice, payload.file.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir el archivo.");
    } finally {
      setUploading(false);
    }
  }

  async function confirmPendingAction() {
    if (!pendingAction || !activeId || sending) return;
    setSending(true);
    setError("");
    try {
      const data = await api<{ conversationId: string; reply: string }>("/api/assistant", {
        method: "POST",
        body: JSON.stringify({ conversationId: activeId, confirmAction: pendingAction })
      });
      setMessages(previous => [
        ...previous,
        { role: "user", content: "Confirmo el movimiento financiero propuesto." },
        { role: "assistant", content: data.reply }
      ]);
      setPendingAction(null);
      window.dispatchEvent(new Event("demian:data-changed"));
      await refreshConversations();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo confirmar el movimiento. Revisa Finanzas antes de volver a intentarlo.");
    } finally {
      setSending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage();
  }

  return (
    <section className="dotDemian">
      <header className="dotDemianHeader">
        <div className="dotDemianBrand">
          <span className="dotDemianOrb"><LineIcon name="brain" size={23} /></span>
          <div>
            <p className="eyebrow">DEMIAN CORE / ASISTENTE</p>
            <h1>DEMIAN<span>.</span></h1>
            <p className="dotDemianSubtitle">Estoy aquí para ayudarte con lo que tienes entre manos.</p>
          </div>
        </div>
        <div className={configured ? "dotDemianBadge ready" : "dotDemianBadge"}>
          <span />
          {configured ? provider : "IA por activar"}
        </div>
      </header>

      <div className="dotDemianLayout">
        <aside className="dotDemianHistory">
          <button type="button" className="dotDemianNew" onClick={newConversation}>
            <LineIcon name="plus" size={16} /> Nueva conversación
          </button>
          <p className="dotDemianHistoryLabel">TUS CONVERSACIONES</p>
          {loading ? <p className="dotDemianMuted">Cargando historial…</p> : conversations.length ? (
            <div className="dotDemianConversationList">
              {conversations.map(conversation => (
                <button
                  type="button"
                  key={conversation.id}
                  className={activeId === conversation.id ? "dotDemianConversation active" : "dotDemianConversation"}
                  onClick={() => void openConversation(conversation.id)}
                >
                  <LineIcon name="book-open" size={15} />
                  <span>{conversation.title || "Nueva conversación"}</span>
                </button>
              ))}
            </div>
          ) : <p className="dotDemianMuted">Aquí aparecerán las conversaciones que guardes.</p>}
          <div className="dotDemianHistoryPrivacy">
            <LineIcon name="check-circle" size={15} />
            Historial separado por cuenta
          </div>
        </aside>

        <div className="dotDemianChat">
          <div className="dotDemianChatTop">
            <div><b>Tu asistente</b><small>Espacio privado de DEMIAN CORE</small></div>
            <span className={configured ? "dotDemianLive" : "dotDemianLive pending"}><i />{configured ? "Listo" : "Pendiente"}</span>
          </div>

          <div className="dotDemianFeed" ref={feed} aria-live="polite">
            {!messages.length && (
              <div className="dotDemianWelcome">
                <span className="dotDemianWelcomeIcon"><LineIcon name="sparkles" size={24} /></span>
                <h2>¿Qué hacemos hoy?</h2>
                <p>Escribe con tus propias palabras. Puedes pedir ideas, organizar tareas, analizar opciones o construir un plan.</p>
                <div className="dotDemianPrompts">
                  {quickPrompts.map(prompt => (
                    <button key={prompt.title} type="button" onClick={() => void sendMessage(prompt.text)} disabled={sending || !configured}>
                      <b>{prompt.title}</b><span>{prompt.text}</span>
                    </button>
                  ))}
                </div>
                {!configured && <div className="dotDemianSetupNote">El motor gratuito no está disponible por ahora. Inténtalo de nuevo más tarde.</div>}
              </div>
            )}
            {messages.map((message, index) => (
              <article key={message.id ?? index} className={message.role === "user" ? "dotDemianMessage user" : "dotDemianMessage assistant"}>
                <span className="dotDemianMessageAvatar">{message.role === "assistant" ? <LineIcon name="brain" size={16} /> : "T"}</span>
                <div className="dotDemianMessageBody">
                  <small>{message.role === "assistant" ? "DEMIAN" : "TÚ"}</small>
                  <p>{message.role === "assistant" ? message.content.replace(/\*\*DOT DEMIAN\*\*/gi, "DEMIAN").replace(/\bDOT DEMIAN\b/gi, "DEMIAN") : message.content}</p>
                </div>
              </article>
            ))}
            {sending && <div className="dotDemianTyping"><span /><span /><span /> DEMIAN está pensando…</div>}
            <div className="dotDemianBottomAnchor" />
          </div>

          {pendingAction && (
            <div className="dotDemianActionConfirm" role="group" aria-label="Confirmar movimiento financiero">
              <div className="dotDemianActionConfirmHead">
                <span><LineIcon name="wallet" size={17} /></span>
                <div>
                  <small>CONFIRMA ANTES DE GUARDAR</small>
                  <b>{pendingAction.type === "finance.transaction.update" ? "Actualizar movimiento" : pendingAction.transactionType === "expense" ? "Registrar gasto" : "Registrar ingreso"}</b>
                </div>
              </div>
              <strong className="dotDemianActionAmount">${pendingAction.amount.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN</strong>
              <p>{pendingAction.description}</p>
              <dl>
                <div><dt>Categoría</dt><dd>{pendingAction.category}</dd></div>
                <div><dt>Cuenta</dt><dd>{pendingAction.accountName}</dd></div>
                <div><dt>Fecha</dt><dd>{pendingAction.date}</dd></div>
              </dl>
              <div className="dotDemianActionButtons">
                <button type="button" onClick={() => void confirmPendingAction()} disabled={sending || !activeId}>{sending ? "Guardando…" : pendingAction.type === "finance.transaction.update" ? "Confirmar cambios" : "Confirmar y registrar"}</button>
                <button type="button" onClick={() => setPendingAction(null)} disabled={sending}>Cancelar</button>
              </div>
            </div>
          )}

          <input
            ref={fileInput}
            hidden
            type="file"
            accept=".pdf,.docx,.xlsx,.xls,.csv,.tsv,.txt,.md,.json,.html,.xml,.yaml,.yml,.log"
            onChange={event => void handleFileSelection(event)}
          />
          <form className="dotDemianComposer" onSubmit={submit}>
            <textarea
              ref={input}
              value={draft}
              onChange={event => setDraft(event.target.value)}
              onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }}
              placeholder={configured ? "Escribe tu pregunta o lo que necesitas resolver…" : "El motor gratuito no está disponible por ahora…"}
              rows={2}
              maxLength={8000}
              aria-label="Mensaje para DEMIAN"
              disabled={!configured || sending || uploading}
            />
            <div className="dotDemianComposerFoot">
              <small>Enter para enviar · Shift + Enter para una nueva línea</small>
              <div className="dotDemianComposerActions">
                <button type="button" className="dotDemianAttach" onClick={() => fileInput.current?.click()} disabled={!configured || sending || uploading}>
                  <LineIcon name="cloud-upload" size={15} /> {uploading ? "Leyendo archivo…" : "Adjuntar"}
                </button>
                <button type="submit" className="dotDemianSend" disabled={!draft.trim() || sending || uploading || !configured}>
                  {sending ? "Pensando…" : "Enviar"} <LineIcon name="arrow-up" size={15} />
                </button>
              </div>
            </div>
          </form>
          {error && <p className="dotDemianError" role="alert">{error}</p>}
          <p className="dotDemianNotice">Uso OpenRouter Free para responder. Cuando me pidas consultar tus tareas, hábitos, notas o finanzas, envío solo los datos relevantes de tu cuenta al proveedor para elaborar la respuesta. No incluyas contraseñas ni datos de acceso.</p>
        </div>
      </div>

      <style jsx>{`
        .dotDemian{display:grid;gap:20px;color:var(--text,#e8edf1)}
        .dotDemianHeader{display:flex;justify-content:space-between;align-items:center;gap:18px;flex-wrap:wrap}
        .dotDemianBrand{display:flex;align-items:center;gap:14px;min-width:0}
        .dotDemianOrb{width:58px;height:58px;display:grid;place-items:center;flex-shrink:0;color:var(--green,#b7f35a);border:1px solid color-mix(in srgb,var(--green,#b7f35a) 55%,#303840);border-radius:19px;background:radial-gradient(circle at 30% 20%,color-mix(in srgb,var(--green,#b7f35a) 16%,transparent),transparent 72%),#101518;box-shadow:0 0 28px color-mix(in srgb,var(--green,#b7f35a) 9%,transparent)}
        .dotDemianHeader h1{font-size:clamp(25px,3.5vw,34px);font-weight:850;letter-spacing:-.045em;margin:4px 0}
        .dotDemianHeader h1 span{color:var(--green,#b7f35a)}
        .dotDemianHeader .eyebrow{margin:0;font-size:9px;letter-spacing:.15em;color:var(--muted,#8e9aa3);font-weight:800}
        .dotDemianSubtitle{margin:0;color:var(--muted,#99a4ac);font-size:12px;line-height:1.5}
        .dotDemianBadge{display:flex;align-items:center;gap:8px;padding:8px 11px;border:1px solid #353f46;border-radius:999px;color:#b6c0c7;font-size:10px;background:#12171a}
        .dotDemianBadge span,.dotDemianLive i{width:7px;height:7px;border-radius:50%;background:#e7a447;display:inline-block}
        .dotDemianBadge.ready span,.dotDemianLive:not(.pending) i{background:#7beaac;box-shadow:0 0 10px #7beaac55}
        .dotDemianLayout{display:grid;grid-template-columns:220px minmax(0,1fr);gap:14px;min-width:0;align-items:stretch}
        .dotDemianHistory,.dotDemianChat{border:1px solid var(--border,#30383f);border-radius:15px;background:linear-gradient(155deg,#14191d,#0d1113);min-width:0}
        .dotDemianHistory{padding:12px;display:flex;flex-direction:column;gap:11px;min-height:560px}
        .dotDemianNew{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;border:1px solid color-mix(in srgb,var(--green,#b7f35a) 45%,#30383f);border-radius:9px;padding:11px;background:color-mix(in srgb,var(--green,#b7f35a) 8%,#111619);color:var(--green,#b7f35a);font-size:11px;font-weight:800;cursor:pointer}
        .dotDemianHistoryLabel{margin:10px 0 0;color:#77838c;font-size:8px;letter-spacing:.14em;font-weight:800}
        .dotDemianMuted{font-size:10px;line-height:1.6;color:#77838c;margin:0;padding:7px 2px}
        .dotDemianConversationList{display:grid;gap:4px;overflow:auto;max-height:360px}
        .dotDemianConversation{width:100%;display:flex;align-items:center;text-align:left;gap:8px;border:1px solid transparent;border-radius:8px;padding:9px 8px;background:transparent;color:#aeb9c0;font-size:10px;cursor:pointer;min-width:0}
        .dotDemianConversation span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .dotDemianConversation.active,.dotDemianConversation:hover{border-color:#303b42;background:#1a2126;color:#f1f4f6}
        .dotDemianConversation :global(svg){flex-shrink:0;color:var(--green,#b7f35a)}
        .dotDemianHistoryPrivacy{display:flex;gap:7px;align-items:flex-start;margin-top:auto;padding-top:12px;border-top:1px solid #293238;color:#809099;font-size:9px;line-height:1.5}
        .dotDemianHistoryPrivacy :global(svg){color:var(--green,#b7f35a);flex-shrink:0}
        .dotDemianChat{display:flex;flex-direction:column;min-height:560px;overflow:hidden}
        .dotDemianActionConfirm{margin:12px 14px 0;padding:13px;border:1px solid color-mix(in srgb,var(--green,#b7f35a) 40%,#30383f);border-radius:12px;background:linear-gradient(145deg,#171e1c,#101515);color:#e4ece8}
        .dotDemianActionConfirmHead{display:flex;align-items:center;gap:9px}
        .dotDemianActionConfirmHead>span{display:grid;place-items:center;width:32px;height:32px;border:1px solid #3b4a44;border-radius:9px;color:var(--green,#b7f35a)}
        .dotDemianActionConfirmHead small{display:block;color:#8eaa9e;font-size:8px;letter-spacing:.12em;font-weight:800}
        .dotDemianActionConfirmHead b{display:block;margin-top:3px;font-size:12px}
        .dotDemianActionAmount{display:block;margin-top:12px;font-size:25px;letter-spacing:-.03em}
        .dotDemianActionConfirm p{margin:5px 0 10px;color:#c3ceca;font-size:11px;overflow-wrap:anywhere}
        .dotDemianActionConfirm dl{display:grid;gap:6px;margin:0}
        .dotDemianActionConfirm dl div{display:flex;justify-content:space-between;gap:12px;font-size:10px}
        .dotDemianActionConfirm dt{color:#82918a}
        .dotDemianActionConfirm dd{margin:0;text-align:right;color:#e4ece8}
        .dotDemianActionButtons{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
        .dotDemianActionButtons button{border:1px solid #4b6559;border-radius:8px;padding:9px 12px;background:var(--green,#b7f35a);color:#0b0e0f;font-size:10px;font-weight:850;cursor:pointer}
        .dotDemianActionButtons button+button{background:transparent;color:#aab5b1;border-color:#30383f}
        .dotDemianActionButtons button:disabled{opacity:.55;cursor:not-allowed}
        .dotDemianChatTop{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 17px;border-bottom:1px solid #283138}
        .dotDemianChatTop b{display:block;font-size:11px;color:#e3e9ed}
        .dotDemianChatTop small{display:block;margin-top:4px;font-size:9px;color:#7c8991}
        .dotDemianLive{display:flex;align-items:center;gap:7px;color:#7beaac;font-size:9px;font-weight:800}
        .dotDemianLive.pending{color:#dfad62}
        .dotDemianLive.pending i{background:#dfad62}
        .dotDemianFeed{flex:1;min-height:310px;max-height:calc(100dvh - 330px);overflow:auto;padding:22px 18px;scroll-behavior:smooth}
        .dotDemianWelcome{max-width:620px;margin:5px auto 20px;text-align:center}
        .dotDemianWelcomeIcon{width:46px;height:46px;margin:0 auto 12px;display:grid;place-items:center;border:1px solid #364239;border-radius:15px;background:#151e19;color:var(--green,#b7f35a)}
        .dotDemianWelcome h2{margin:0;font-size:clamp(21px,2.6vw,28px);letter-spacing:-.035em}
        .dotDemianWelcome>p{max-width:500px;margin:10px auto 19px;color:#8d99a2;font-size:11px;line-height:1.7}
        .dotDemianPrompts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;text-align:left}
        .dotDemianPrompts button{display:grid;align-content:start;gap:7px;padding:12px;border:1px solid #303a41;border-radius:10px;background:#11171a;color:#e2e7ea;text-align:left;cursor:pointer;min-width:0}
        .dotDemianPrompts button:hover:not(:disabled){border-color:color-mix(in srgb,var(--green,#b7f35a) 45%,#303a41)}
        .dotDemianPrompts button b{font-size:10px}
        .dotDemianPrompts button span{font-size:9px;line-height:1.5;color:#89959d}
        .dotDemianPrompts button:disabled{opacity:.48;cursor:not-allowed}
        .dotDemianSetupNote{margin-top:14px;padding:11px;border:1px solid #59472d;border-radius:9px;background:#241e14;color:#e6c38c;font-size:10px;line-height:1.6;text-align:left}
        .dotDemianMessage{display:flex;align-items:flex-start;gap:10px;margin:0 0 20px;max-width:92%}
        .dotDemianMessage.user{margin-left:auto;flex-direction:row-reverse}
        .dotDemianMessageAvatar{display:grid;place-items:center;width:29px;height:29px;flex-shrink:0;border:1px solid #333e45;border-radius:9px;background:#141a1e;color:var(--green,#b7f35a);font-size:10px;font-weight:900}
        .dotDemianMessage.user .dotDemianMessageAvatar{background:var(--green,#b7f35a);color:#0b0e0f;border-color:transparent}
        .dotDemianMessageBody{min-width:0}
        .dotDemianMessageBody small{display:block;margin:2px 0 6px;color:#85919a;font-size:8px;letter-spacing:.1em;font-weight:800}
        .dotDemianMessage.user .dotDemianMessageBody{text-align:right}
        .dotDemianMessageBody p{margin:0;color:#e0e6ea;font-size:12px;line-height:1.8;white-space:pre-wrap;overflow-wrap:anywhere}
        .dotDemianTyping{display:flex;align-items:center;gap:6px;margin:10px 0 18px;color:#8b989f;font-size:10px}
        .dotDemianTyping span{width:5px;height:5px;border-radius:50%;background:var(--green,#b7f35a);animation:dotAiPulse 1s infinite ease-in-out}
        .dotDemianTyping span:nth-child(2){animation-delay:.15s}.dotDemianTyping span:nth-child(3){animation-delay:.3s}
        @keyframes dotAiPulse{0%,80%,100%{opacity:.35;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}
        .dotDemianBottomAnchor{height:1px}
        .dotDemianComposer{padding:13px 15px;border-top:1px solid #283138;background:#0c1012}
        .dotDemianComposer textarea{width:100%;resize:vertical;box-sizing:border-box;border:1px solid #354148;border-radius:10px;background:#12181b;color:#e9edf0;padding:11px 12px;font:inherit;font-size:11px;line-height:1.7;outline:none}
        .dotDemianComposer textarea:focus{border-color:color-mix(in srgb,var(--green,#b7f35a) 55%,#354148);box-shadow:0 0 0 3px color-mix(in srgb,var(--green,#b7f35a) 10%,transparent)}
        .dotDemianComposer textarea:disabled{opacity:.65}
        .dotDemianComposerFoot{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:9px}
        .dotDemianComposerFoot small{color:#6f7c84;font-size:8px}
        .dotDemianComposerActions{display:flex;align-items:center;gap:7px;flex-shrink:0}
        .dotDemianAttach{display:flex;align-items:center;gap:6px;border:1px solid #354148;border-radius:8px;padding:9px 11px;background:#12181b;color:#b8c2c9;font-size:10px;font-weight:750;cursor:pointer}
        .dotDemianAttach:disabled{opacity:.5;cursor:not-allowed}
        .dotDemianSend{display:flex;align-items:center;gap:7px;border:0;border-radius:8px;padding:9px 13px;background:var(--green,#b7f35a);color:#0b0e0f;font-size:10px;font-weight:900;cursor:pointer}
        .dotDemianSend:disabled{opacity:.45;cursor:not-allowed}
        .dotDemianError{margin:10px 0 0;padding:10px 12px;border:1px solid #71434a;border-radius:9px;background:#27181a;color:#ffb3b9;font-size:10px;line-height:1.6}
        .dotDemianNotice{margin:0;padding:0 14px 13px;color:#6f7c84;font-size:8px;line-height:1.55}
        @media(max-width:900px){.dotDemianLayout{grid-template-columns:1fr}.dotDemianHistory{min-height:0;order:2}.dotDemianConversationList{max-height:150px}.dotDemianHistoryPrivacy{margin-top:8px}.dotDemianChat{min-height:520px}.dotDemianFeed{max-height:56vh}}
        @media(max-width:580px){.dotDemianHeader{align-items:flex-start}.dotDemianOrb{width:48px;height:48px;border-radius:15px}.dotDemianHeader h1{font-size:25px}.dotDemianSubtitle{font-size:10px}.dotDemianFeed{padding:18px 12px;max-height:58vh}.dotDemianPrompts{grid-template-columns:1fr}.dotDemianPrompts button{padding:10px}.dotDemianMessage{max-width:100%}.dotDemianComposer{padding:11px}.dotDemianComposerFoot small{max-width:55%;line-height:1.5}}
      `}</style>
    </section>
  );
}
