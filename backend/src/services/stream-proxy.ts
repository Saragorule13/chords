// proxy for streaming audio from youtube
import type { Request, Response } from "express";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { getStreamInfo } from "./innertube.js";

export async function proxyAudio(
  req: Request,
  res: Response,
  id: string,
): Promise<void> {
  const range = req.headers.range;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const stream = await getStreamInfo(id);

    const headers = new Headers();

    if (range) {
      headers.set("Range", range);
    }

    const upstream = await fetch(stream.url, { headers });

    // The URL may have expired. Fetch a fresh one once.
    if ((upstream.status === 403 || upstream.status === 410) && attempt === 0) {
      continue;
    }

    if (!upstream.ok || !upstream.body) {
      res.status(502).json({
        error: "Upstream audio stream unavailable",
      });
      return;
    }

    res.status(upstream.status);

    res.setHeader(
      "Content-Type",
      upstream.headers.get("content-type") ?? stream.mimeType,
    );
    res.setHeader("Accept-Ranges", "bytes");

    for (const header of [
      "content-length",
      "content-range",
      "cache-control",
      "etag",
    ]) {
      const value = upstream.headers.get(header);

      if (value) {
        res.setHeader(header, value);
      }
    }

    await pipeline(
      Readable.fromWeb(
        upstream.body as unknown as NodeReadableStream<Uint8Array>,
      ),
      res,
    );

    return;
  }

  res.status(502).json({
    error: "Unable to refresh audio stream",
  });
}
