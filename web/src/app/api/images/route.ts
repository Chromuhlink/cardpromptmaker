import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

export async function GET() {
  try {
    const dir = path.join(process.cwd(), "public", "images");
    const files = await fs.readdir(dir);
    const images = files
      .filter((f) => /\.(png|jpg|jpeg|gif|webp|avif|svg)$/i.test(f))
      .map((f) => `/images/${f}`);
    return NextResponse.json({ images });
  } catch (error) {
    return NextResponse.json({ error: "Failed to list images" }, { status: 500 });
  }
}


