import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { ensureIdentitySchema, isActiveSessionId, requestSession } from "../../../lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noCache = { "Cache-Control": "private, no-store, max-age=0" };
const globals = globalThis as unknown as { demianAssistantPool?: Pool; demianAssistantReady?: Promise<void> };
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openrouter/free";
const isConfigured = Boolean(GEMINI_API_KEY || OPENROUTER_API_KEY);

type ChatMessage = { role: "user" | "assistant"; content: string };
type ProviderAnswer = { reply: string; provider: string; model: string };
class ProviderFailure extends Error {
  constructor(public status: number, public provider: string) {
    super(provider + " request failed with status " + status);
  }
}
function db() {
  if (!process.env.DEMIAN_DATABASE_URL) throw new Error("La base de datos de DEMIAN CORE no está configurada.");
  if (!globals.demianAssistantPool) {
    globals.demianAssistantPool = new Pool({
      connectionString: process.env.DEMIAN_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 20000
    });
  }
  return globals.demianAssistantPool;
}
async function ready() {
  await ensureIdentitySchema();
  if (!globals.demianAssistantReady) {
    globals.demianAssistantReady = Promise.all([
      db().query("SELECT 1 FROM public.demian_assistant_conversations LIMIT 0"),
      db().query("SELECT 1 FROM public.demian_assistant_messages LIMIT 0")
    ]).then(() => undefined).catch(error => {
      globals.demianAssistantReady = undefined;
      throw error;
    });
  }
  return globals.demianAssistantReady;
}
function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(req.url).origin; } catch { return false; }
}
async function authenticated(req: NextRequest) {
  const session = requestSession(req);
  if (!session) return null;
  await ready();
  return await isActiveSessionId(session.sub, session.sid) ? session : null;
}
function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: noCache });
}
function configuredProvider() {
  return GEMINI_API_KEY ? "Gemini Flash · nivel gratuito" : OPENROUTER_API_KEY ? "OpenRouter Free" : "IA gratuita pendiente de activar";
}
const requests = new Map<string, { startedAt: number; count: number }>();
function allowMessage(userId: string) {
  const now = Date.now();
  if (requests.size > 2000) {
    for (const [id, entry] of requests) if (now - entry.startedAt > 120_000) requests.delete(id);
  }
  const entry = requests.get(userId);
  if (!entry || now - entry.startedAt >= 60_000) {
    requests.set(userId, { startedAt: now, count: 1 });
    return true;
  }
  if (entry.count >= 12) return false;
  entry.count++;
  return true;
}
function providerErrorMessage(error: unknown) {
  if (error instanceof ProviderFailure) {
    if (error.status === 429 || error.status === 402) return "Se alcanzó el límite gratuito de la IA. Espera un poco y vuelve a intentarlo.";
    if (error.status === 400 || error.status === 401 || error.status === 403) return "La clave o el modelo del proveedor gratuito no están habilitados. Revisa la configuración del servidor.";
  }
  return "La IA gratuita no pudo responder en este momento. Inténtalo de nuevo.";
}
async function askGemini(instructions: string, history: ChatMessage[]): Promise<ProviderAnswer> {
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(GEMINI_MODEL) + ":generateContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instructions }] },
        contents: history.map(message => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }]
        })),
        generationConfig: { maxOutputTokens: 1400, temperature: 0.7 }
      }),
      signal: AbortSignal.timeout(60_000)
    }
  );
  const result = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new ProviderFailure(response.status, "Gemini");
  const candidates = Array.isArray(result.candidates) ? result.candidates as Array<Record<string, unknown>> : [];
  const candidate = candidates[0] || {};
  const content = candidate.content && typeof candidate.content === "object" ? candidate.content as Record<string, unknown> : {};
  const parts = Array.isArray(content.parts) ? content.parts as Array<Record<string, unknown>> : [];
  const reply = parts.map(part => typeof part.text === "string" ? part.text : "").filter(Boolean).join("\n").trim();
  if (!reply) throw new ProviderFailure(502, "Gemini");
  return { reply, provider: "Gemini Flash · nivel gratuito", model: GEMINI_MODEL };
}
async function askOpenRouter(instructions: string, history: ChatMessage[]): Promise<ProviderAnswer> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + OPENROUTER_API_KEY,
      "HTTP-Referer": "https://demian-life-os-web-production.up.railway.app",
      "X-Title": "DEMIAN CORE"
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [{ role: "system", content: instructions }, ...history],
      max_tokens: 1400,
      temperature: 0.7,
      stream: false
    }),
    signal: AbortSignal.timeout(60_000)
  });
  const result = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new ProviderFailure(response.status, "OpenRouter");
  const choices = Array.isArray(result.choices) ? result.choices as Array<Record<string, unknown>> : [];
  const first = choices[0] || {};
  const message = first.message && typeof first.message === "object" ? first.message as Record<string, unknown> : {};
  const reply = typeof message.content === "string" ? message.content.trim() : "";
  if (!reply) throw new ProviderFailure(502, "OpenRouter");
  return { reply, provider: "OpenRouter Free", model: typeof result.model === "string" ? result.model : OPENROUTER_MODEL };
}
async function askFreeAI(instructions: string, history: ChatMessage[]): Promise<ProviderAnswer> {
  const failures: unknown[] = [];
  if (GEMINI_API_KEY) {
    try { return await askGemini(instructions, history); } catch (error) { failures.push(error); }
  }
  if (OPENROUTER_API_KEY) {
    try { return await askOpenRouter(instructions, history); } catch (error) { failures.push(error); }
  }
  throw failures[failures.length - 1] || new Error("No hay proveedor gratuito configurado.");
}
function unauthenticated() {
  return json({ ok: false, error: "Inicia sesión en DEMIAN CORE para usar DOT DEMIAN." }, 401);
}
export async function GET(req: NextRequest) {
  try {
    const session = await authenticated(req);
    if (!session) return unauthenticated();
    const url = new URL(req.url);
    const conversationId = url.searchParams.get("conversationId");
    if (conversationId) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(conversationId)) {
        return json({ ok: false, error: "Conversación inválida." }, 400);
      }
      const owner = await db().query(
        "SELECT id FROM public.demian_assistant_conversations WHERE id=$1 AND user_id=$2 LIMIT 1",
        [conversationId, session.sub]
      );
      if (!owner.rows[0]) return json({ ok: false, error: "Conversación no encontrada." }, 404);
      const rows = await db().query(
        "SELECT id,role,content,created_at FROM public.demian_assistant_messages WHERE conversation_id=$1 AND user_id=$2 ORDER BY created_at ASC,id ASC LIMIT 500",
        [conversationId, session.sub]
      );
      return json({ ok: true, messages: rows.rows });
    }
    const result = await db().query(
      "SELECT id,title,updated_at FROM public.demian_assistant_conversations WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 50",
      [session.sub]
    );
    return json({ ok: true, conversations: result.rows, configured: isConfigured, provider: configuredProvider() });
  } catch (error) {
    console.error("DOT DEMIAN GET:", error);
    return json({ ok: false, error: "No se pudo cargar DOT DEMIAN. Inténtalo de nuevo." }, 503);
  }
}
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: "Origen no permitido." }, 403);
  try {
    const session = await authenticated(req);
    if (!session) return unauthenticated();
    if (!isConfigured) return json({
      ok: false,
      error: "La IA gratuita aún no está activada en el servidor. Falta configurar GEMINI_API_KEY (recomendado) u OPENROUTER_API_KEY."
    }, 503);
    if (!allowMessage(session.sub)) return json({ ok: false, error: "Llegaste al límite temporal de 12 mensajes por minuto. Espera un momento y vuelve a intentarlo." }, 429);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const message = String(body.message || "").trim();
    if (!message || message.length > 8000) return json({ ok: false, error: "Escribe un mensaje de hasta 8,000 caracteres." }, 400);
    let conversationId = String(body.conversationId || "");
    if (conversationId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(conversationId)) {
      return json({ ok: false, error: "Conversación inválida." }, 400);
    }
    if (conversationId) {
      const owner = await db().query(
        "SELECT id FROM public.demian_assistant_conversations WHERE id=$1 AND user_id=$2 LIMIT 1",
        [conversationId, session.sub]
      );
      if (!owner.rows[0]) return json({ ok: false, error: "Conversación no encontrada." }, 404);
    } else {
      conversationId = randomUUID();
      await db().query(
        "INSERT INTO public.demian_assistant_conversations(id,user_id,title) VALUES($1,$2,$3)",
        [conversationId, session.sub, message.slice(0, 72)]
      );
    }
    await db().query(
      "INSERT INTO public.demian_assistant_messages(conversation_id,user_id,role,content) VALUES($1,$2,'user',$3)",
      [conversationId, session.sub, message]
    );
    await db().query(
      "UPDATE public.demian_assistant_conversations SET title=CASE WHEN title='Nueva conversación' THEN $1 ELSE title END,updated_at=NOW() WHERE id=$2 AND user_id=$3",
      [message.slice(0, 72), conversationId, session.sub]
    );
    const previous = await db().query(
      "SELECT role,content FROM public.demian_assistant_messages WHERE conversation_id=$1 AND user_id=$2 ORDER BY created_at DESC,id DESC LIMIT 16",
      [conversationId, session.sub]
    );
    const history = (previous.rows as ChatMessage[]).reverse();
    const instructions = [
      "Eres DOT DEMIAN, el asistente integrado de DEMIAN CORE. Responde en español claro, cordial y directo.",
      "Ayuda al usuario a pensar, organizar tareas, aprender, redactar, analizar decisiones y convertir metas en pasos concretos.",
      "Distingue hechos, suposiciones y recomendaciones. Haz una pregunta breve cuando realmente falte un dato.",
      "La conversación y su memoria son privadas de esta cuenta. Nunca mezcles datos de otras personas ni inventes información de la aplicación.",
      "No afirmes que modificaste tareas, finanzas, hábitos, archivos ni otras partes de DEMIAN CORE: por ahora puedes conversar, pero no tienes herramientas para ejecutar esos cambios.",
      "La respuesta de la IA debe ser útil, sencilla y apropiada para un asistente personal."
    ].join(" ");
    const answer = await askFreeAI(instructions, history);
    await db().query(
      "INSERT INTO public.demian_assistant_messages(conversation_id,user_id,role,content) VALUES($1,$2,'assistant',$3)",
      [conversationId, session.sub, answer.reply]
    );
    await db().query(
      "UPDATE public.demian_assistant_conversations SET updated_at=NOW() WHERE id=$1 AND user_id=$2",
      [conversationId, session.sub]
    );
    return json({ ok: true, conversationId, reply: answer.reply, provider: answer.provider, model: answer.model });
  } catch (error) {
    console.error("DOT DEMIAN POST:", error instanceof ProviderFailure ? { provider: error.provider, status: error.status } : error);
    return json({ ok: false, error: providerErrorMessage(error) }, error instanceof ProviderFailure && error.status === 429 ? 429 : 502);
  }
}
