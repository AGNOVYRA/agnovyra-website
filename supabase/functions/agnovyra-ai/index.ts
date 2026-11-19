// Agnovyra AI: farm advisor chat + AI business plan generator.
// Runs on Supabase Edge Functions. The AI key stays here on the server, never in the website.
import { createClient } from "npm:@supabase/supabase-js@2";

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
const PLAN_PRICE = parseInt(Deno.env.get("PLAN_PRICE_NGN") ?? "50000");
const CHAT_PER_DAY = parseInt(Deno.env.get("CHAT_PER_DAY") ?? "10");
const CHAT_GLOBAL_PER_DAY = parseInt(Deno.env.get("CHAT_GLOBAL_PER_DAY") ?? "400");
const PLAN_GLOBAL_PER_DAY = parseInt(Deno.env.get("PLAN_GLOBAL_PER_DAY") ?? "30");

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const FARM = `Agnovyra Ventures is a CAC-registered agribusiness (a business of Odusade Synergies Limited) with a ~10-acre integrated farm in Abeokuta, Ogun State, Nigeria; head office Odeda.
Enterprises: cocoa (fruiting and being harvested), plantain, poultry (broilers, layers, cockerels, foreign & local turkeys, local/improved breeds FUNAAB Alpha, Fulani, Goloba; other breeds sourced on request), piggery (live pigs, pork), fish (catfish and Eja osan now; tilapia and Heterotis being stocked), black soldier fly (BSF) insectarium (larvae, starter colonies, frass fertiliser). Expansion planned: cocoa + Gmelina agroforestry.
Services: farm produce sales and wholesale supply, festive pre-orders, farm tours, school excursions, photoshoot/event venue, Agnovyra Academy trainings (waitlist), farm setup & revival consulting, export/import sourcing, AI business plans.
Contact: call/WhatsApp 0816 388 3487. Website: https://agnovyra.github.io/agnovyra-website/ — AI business plan generator at /plan.html.`;

const ADVISOR = `You are "Agnovyra AI", the farm advisor of Agnovyra Ventures. You help farmers and aspiring agripreneurs, mainly in Nigeria and Africa, with practical answers.
${FARM}

How to answer:
- Reply in the same language the user writes in (English, Nigerian Pidgin or Yoruba).
- Be practical and specific to tropical / Nigerian conditions. Use short paragraphs or numbered steps. Keep answers under about 220 words unless the user asks for more detail.
- Topics: poultry, pigs, catfish and other fish, black soldier fly, cocoa, plantain, feed, housing, records, costs and profit planning, marketing, agro-export basics (NEPC, documentation), and starting an agribusiness.
- Never invent current market prices. Give the method or a formula and ask for their local price, or say prices vary and should be checked locally.
- Animal or crop health: explain likely causes, warning signs and good practice, but always advise them to see a qualified vet or extension officer for diagnosis and treatment. Do not give prescription drug doses.
- Export and legal: give general steps and point to official bodies (e.g., NEPC, Nigeria Customs, NAFDAC where relevant). Exporting requires a registered company.
- If a question is outside farming and agribusiness, politely say you focus on farming and agribusiness.
- When genuinely useful, mention Agnovyra's offers in one short line (e.g., order produce or book a tour on WhatsApp 0816 388 3487, or get a full custom business plan at the website's /plan.html). Don't advertise in every answer.
- Be honest when unsure.`;

const PLANNER = `You are Agnovyra AI's business-plan writer. Write a complete, professional agribusiness plan in Markdown for the client's inputs.
${FARM}

Rules:
- Base every figure on the client's own budget, scale, location and any prices they gave. Where you must assume a price or rate, put it in a clearly labelled "Key assumptions" table so the client can replace it, and say figures are estimates to verify with current local prices.
- Show calculations simply (quantity × unit cost) so a bank officer can follow them. Use ₦ for Nigeria (or the client's currency if they are elsewhere).
- Be realistic about mortality, feed cost (often the largest cost), seasonality and risks. No hype, no guarantees of profit.
- Structure exactly with these H2 headings, in order:
## 1. Executive summary
## 2. Business description and objectives
## 3. Market analysis
## 4. Production plan
## 5. Key assumptions
## 6. Start-up costs
## 7. Operating costs and revenue per cycle
## 8. Profit, break-even and return on investment
## 9. 12-month cash flow outline
## 10. Marketing and sales plan
## 11. Risks and how to manage them
## 12. Management, licences and compliance
## 13. 90-day action plan
- Use tables for costs, revenue, cash flow and the action plan.
- End with one line: "Prepared with Agnovyra AI — Agnovyra Ventures, Abeokuta, Nigeria. Verify all prices locally before committing funds."`;

async function gemini(system: string, contents: { role: string; parts: { text: string }[] }[], maxTokens: number, temperature: number) {
  if (!GEMINI_KEY) throw new Error("NO_KEY");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 140_000);
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: { maxOutputTokens: maxTokens, temperature } }),
    });
    const data = await r.json();
    if (!r.ok) { console.error("gemini error", r.status, JSON.stringify(data).slice(0, 500)); throw new Error(r.status === 429 ? "BUSY" : "AI_ERROR"); }
    const text = (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("").trim();
    if (!text) throw new Error("AI_ERROR");
    return text;
  } finally { clearTimeout(t); }
}

async function allow(key: string, kind: string, limit: number) {
  const { data, error } = await db.rpc("ai_bump_usage", { p_client: key.slice(0, 100), p_kind: kind, p_limit: limit });
  if (error) { console.error(error); return false; }
  return data === true;
}

const clean = (s: unknown, n: number) => String(s ?? "").replace(/[\u0000-\u001f]/g, " ").slice(0, n).trim();
const errMsg = (e: Error) => e.message === "NO_KEY" ? "Agnovyra AI is being switched on. Please try again soon, or chat with us on WhatsApp: 0816 388 3487."
  : e.message === "BUSY" ? "Agnovyra AI is very busy right now. Please try again in a minute." : "Sorry, something went wrong. Please try again.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const client = clean(body.client_id, 64) || ip;
  const action = body.action;

  try {
    if (action === "chat") {
      const msgs = Array.isArray(body.messages) ? body.messages.slice(-10) : [];
      const contents = msgs.map((m: { role?: string; text?: string }) => ({ role: m.role === "model" ? "model" : "user", parts: [{ text: clean(m.text, 1500) }] })).filter((m) => m.parts[0].text);
      if (!contents.length || contents[contents.length - 1].role !== "user") return json({ error: "Ask a question first." }, 400);
      if (!(await allow("GLOBAL", "chat", CHAT_GLOBAL_PER_DAY))) return json({ reply: "Agnovyra AI has reached today's limit. Please come back tomorrow, or chat with us on WhatsApp: 0816 388 3487.", limited: true });
      if (!(await allow(client, "chat", CHAT_PER_DAY)) || !(await allow("ip:" + ip, "chat", CHAT_PER_DAY * 3)))
        return json({ reply: `You've used your ${CHAT_PER_DAY} free questions for today. Come back tomorrow, or get personal help on WhatsApp: 0816 388 3487.`, limited: true });
      const reply = await gemini(ADVISOR, contents, 2048, 0.5);
      await db.from("ai_chats").insert({ client_id: client, question: contents[contents.length - 1].parts[0].text, answer: reply });
      return json({ reply });
    }

    if (action === "plan_create") {
      const i = (body.inputs ?? {}) as Record<string, unknown>;
      const inputs = {
        enterprise: clean(i.enterprise, 120), location: clean(i.location, 120), scale: clean(i.scale, 200),
        budget: clean(i.budget, 120), purpose: clean(i.purpose, 120), experience: clean(i.experience, 120),
        land: clean(i.land, 200), prices: clean(i.prices, 800), notes: clean(i.notes, 1200),
      };
      if (!inputs.enterprise || !inputs.location || !inputs.budget) return json({ error: "Please fill in the enterprise, location and budget." }, 400);
      if (!(await allow("GLOBAL", "plan", PLAN_GLOBAL_PER_DAY))) return json({ error: "Today's plan capacity is full. Please try again tomorrow." }, 429);
      if (!(await allow(client, "plan", 3)) || !(await allow("ip:" + ip, "plan", 6))) return json({ error: "You've created the maximum plans for today. Please try again tomorrow." }, 429);
      const { data: row, error } = await db.from("plan_requests").insert({ name: clean(body.name, 120) || null, phone: clean(body.phone, 40) || null, inputs, price_ngn: PLAN_PRICE }).select("id, ref").single();
      if (error) throw error;
      const prompt = `Client inputs:\n${Object.entries(inputs).filter(([, v]) => v).map(([k, v]) => `- ${k}: ${v}`).join("\n")}\n\nWrite the full business plan now.`;
      try {
        const plan = await gemini(PLANNER, [{ role: "user", parts: [{ text: prompt }] }], 12000, 0.4);
        const cut = plan.search(/\n## 2\./);
        const preview = cut > 0 ? plan.slice(0, cut).trim() : plan.slice(0, 1500);
        const outline = (plan.match(/^## .+$/gm) ?? []).join("\n");
        await db.from("plan_requests").update({ full_plan: plan, preview: preview + "\n\n---\n\n**Full plan contains:**\n\n" + outline, status: "ready" }).eq("id", row.id);
        return json({ ref: row.ref, preview: preview + "\n\n---\n\n**Your full plan contains:**\n\n" + outline, price: PLAN_PRICE });
      } catch (e) {
        await db.from("plan_requests").update({ status: "failed" }).eq("id", row.id);
        return json({ error: errMsg(e as Error) }, 503);
      }
    }

    if (action === "plan_get") {
      const ref = clean(body.ref, 40);
      if (!/^[0-9a-f-]{36}$/i.test(ref)) return json({ error: "Invalid reference." }, 400);
      const { data } = await db.from("plan_requests").select("ref, created_at, inputs, preview, full_plan, paid, price_ngn, status").eq("ref", ref).maybeSingle();
      if (!data) return json({ error: "Plan not found." }, 404);
      return json({ ref: data.ref, created_at: data.created_at, inputs: data.inputs, status: data.status, paid: data.paid, price: data.price_ngn, plan: data.paid ? data.full_plan : null, preview: data.preview });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: errMsg(e as Error), reply: errMsg(e as Error) }, 200);
  }
});
