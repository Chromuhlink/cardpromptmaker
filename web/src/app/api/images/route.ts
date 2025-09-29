import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const url = new URL("/data/images.json", request.url).toString();
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) throw new Error("Failed to load images manifest");
    const data = await res.json();
    const images: string[] = Array.isArray(data) ? data : Array.isArray(data.images) ? data.images : [];
    return NextResponse.json({ images });
  } catch (error) {
    return NextResponse.json({ error: "Failed to list images" }, { status: 500 });
  }
}


