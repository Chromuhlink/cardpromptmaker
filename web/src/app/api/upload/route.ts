import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { put } from "@vercel/blob";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const stamp = Date.now();
    const filename = `card-${stamp}.png`;

    // Prefer Vercel Blob in production
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (token) {
      const arrayBuffer = await file.arrayBuffer();
      const { url } = await put(filename, Buffer.from(arrayBuffer), {
        access: "public",
        contentType: "image/png",
        token,
      });
      return NextResponse.json({ url });
    }

    // Fallback for local dev: write to public/uploads (non-persistent in serverless)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });
    const filepath = path.join(uploadsDir, filename);
    await fs.writeFile(filepath, buffer);
    const url = `/uploads/${filename}`;
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}


