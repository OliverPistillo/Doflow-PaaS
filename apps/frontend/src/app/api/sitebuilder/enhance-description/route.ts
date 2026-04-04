// apps/frontend/src/app/api/sitebuilder/enhance-description/route.ts
// Pattern "Migliora con AI" da Buildly — migliora la descrizione del business

import { NextRequest, NextResponse } from "next/server";

interface AnthropicMessage {
  content: Array<{ type: string; text?: string }>;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      siteTitle?: string;
      businessType?: string;
      description?: string;
      locale?: string;
    };

    const { siteTitle, businessType, description, locale = "it" } = body;

    if (!siteTitle && !businessType) {
      return NextResponse.json({ error: "siteTitle o businessType richiesto" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ enhanced: description ?? "" });

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-6",
        max_tokens: 512,
        system: `Sei un copywriter professionista specializzato in siti web aziendali.
Il tuo compito è migliorare la descrizione del business fornita dall'utente, rendendola più dettagliata,
professionale e utile per la generazione automatica dei contenuti del sito web.
Rispondi SOLO con il testo migliorato, senza introduzioni o spiegazioni.
Lingua: ${locale}. Max 500 parole.`,
        messages: [{
          role:    "user",
          content: `Migliora questa descrizione per il sito "${siteTitle}" (${businessType}):

${description || `Sito web per ${businessType || siteTitle}.`}

Aggiungi dettagli plausibili su servizi, punti di forza, target di clientela e proposta di valore unica.`,
        }],
      }),
    });

    if (!res.ok) {
      console.error("[enhance-description] Anthropic error:", res.status);
      return NextResponse.json({ enhanced: description ?? "" });
    }

    const data = await res.json() as AnthropicMessage;
    const enhanced = data.content
      .find((b) => b.type === "text")?.text?.trim() ?? description ?? "";

    return NextResponse.json({ enhanced });
  } catch (err) {
    console.error("[enhance-description]", err);
    return NextResponse.json({ enhanced: "" });
  }
}