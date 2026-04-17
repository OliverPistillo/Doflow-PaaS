import { NextRequest, NextResponse } from 'next/server';

function getBackendBaseUrl() {
  return process.env.SITEGEN_API_URL || process.env.BACKEND_URL || 'http://localhost:3001';
}

export async function GET(_: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    const backendUrl = new URL(`/sitegen/status/${params.jobId}`, getBackendBaseUrl());
    const response = await fetch(backendUrl, { cache: 'no-store' });
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json({ status: 'failed', error: String(error) }, { status: 500 });
  }
}