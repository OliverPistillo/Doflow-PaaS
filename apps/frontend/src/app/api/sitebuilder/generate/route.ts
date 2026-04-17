import { NextRequest, NextResponse } from 'next/server';

function getBackendBaseUrl() {
  return process.env.SITEGEN_API_URL || process.env.BACKEND_URL || 'http://localhost:3001';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const backendUrl = new URL('/sitegen/generate', getBackendBaseUrl());
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Errore generazione' },
      { status: 500 },
    );
  }
}