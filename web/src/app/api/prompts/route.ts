import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

async function readLinesFromPublicFile(relativePath: string): Promise<string[]> {
  const absolutePath = path.join(process.cwd(), "public", relativePath);
  const raw = await fs.readFile(absolutePath, "utf8");
  return raw
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
}

export async function GET() {
  try {
    const lines = await readLinesFromPublicFile(path.join("data", "prompts.txt"));
    return NextResponse.json({ prompts: lines });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load prompts" }, { status: 500 });
  }
}


