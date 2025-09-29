import { NextResponse } from "next/server";

export const runtime = "edge";

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return await res.text();
}

export async function GET(request: Request) {
  try {
    const base = new URL("/data/daisyfeatures.txt", request.url).toString();
    const raw = await fetchText(base);
    const lines = raw
      .split(/\r?\n/g)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"));
    return NextResponse.json({ features: lines });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load features" }, { status: 500 });
  }
}


