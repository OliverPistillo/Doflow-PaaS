// apps/frontend/src/app/api/sitebuilder/suggest-topics/route.ts
//
// Proxy server-side per le chiamate Anthropic.
// Usa fetch nativo invece dell'SDK per non dover installare
// @anthropic-ai/sdk nel package frontend — solo il backend ne ha bisogno.
// La chiave ANTHROPIC_API_KEY non viene mai esposta al browser.

import { NextRequest, NextResponse } from "next/server";

// ─── Tipo minimale della risposta Anthropic che ci interessa ─────────────────
interface AnthropicTextBlock {
  type: "text";
  text: string;
}
interface AnthropicMessage {
  content: Array<{ type: string; text?: string }>;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { siteTitle?: string; locale?: string };
    const { siteTitle, locale = "it" } = body;

    if (!siteTitle || typeof siteTitle !== "string" || siteTitle.trim().length < 2) {
      return NextResponse.json(
        { error: "siteTitle è obbligatorio (min 2 caratteri)" },
        { status: 400 },
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("[suggest-topics] ANTHROPIC_API_KEY non impostata");
      return NextResponse.json(getFallback());
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-3-7-sonnet-20250219",
        max_tokens: 256,
        system: `Sei un esperto di architettura informativa per siti web aziendali.
Rispondi ESCLUSIVAMENTE con un array JSON puro.
Niente markdown, niente backtick, niente testo aggiuntivo prima o dopo.
Output valido esempio: ["Homepage","Chi siamo","Servizi","Portfolio","Blog","Contatti"]`,
        messages: [
          {
            role:    "user",
            content: `Suggerisci esattamente 6 sezioni/pagine per il sito web di: "${siteTitle.trim()}".
Le sezioni devono essere in lingua: ${locale}.
Ogni sezione deve essere concisa (1-4 parole), adatta come titolo di pagina WordPress.
Restituisci SOLO l'array JSON.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("[suggest-topics] Anthropic API error:", response.status);
      return NextResponse.json(getFallback());
    }

    const data = await response.json() as AnthropicMessage;

    const rawText = data.content
      .find((b): b is AnthropicTextBlock => b.type === "text")
      ?.text ?? "[]";

    const clean = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const suggestions = JSON.parse(clean) as string[];

    if (!Array.isArray(suggestions)) throw new Error("Risposta LLM non è un array");

    return NextResponse.json(suggestions.slice(0, 8));
  } catch (err) {
    console.error("[suggest-topics]", err);
    return NextResponse.json(getFallback());
  }
}

// Fallback locale — non blocca l'UX se l'API è irraggiungibile
function getFallback(): string[] {
  return ["Homepage", "Chi siamo", "Servizi", "Portfolio", "Contatti", "Blog"];
}