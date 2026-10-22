// fetch data from youtube using innertube

import { ClientType, Innertube, Platform, type Types } from "youtubei.js";

Platform.shim.eval = async (data: Types.BuildScriptResult) => {
  return new Function(data.output)();
};

let clientPromise: Promise<Innertube> | undefined;

export function getClient(): Promise<Innertube>{
    clientPromise ??= Innertube.create({
        client_type: ClientType.MUSIC,
        retrieve_player: true,
    });

    return clientPromise;
}

export async function searchMusic(query: string): Promise<SearchTrack[]> {
    const client = await getClient();
    const result = await client.music.search(query);
  
    const items = result.contents?.flatMap((section) => {
      if ("contents" in section && section.contents) {
        return section.contents;
      }

      return [];
    }) ?? [];

    return items
      .map(toSearchTrack)
      .filter((track): track is SearchTrack => track !== null);
}

export interface SearchTrack {
    id: string;
    title: string;
    artists: string[];
    durationSeconds?: number;
    thumbnailUrl?: string;
}

function toSearchTrack(item: unknown): SearchTrack | null {
    if (!item || typeof item !== "object") {
      return null;
    }

    const candidate = item as {
      id?: unknown;
      title?: unknown;
      item_type?: unknown;
      artists?: unknown;
      duration?: unknown;
      thumbnails?: unknown;
    };

    if (
      typeof candidate.id !== "string" ||
      typeof candidate.title !== "string" ||
      (candidate.item_type !== "song" && candidate.item_type !== "video")
    ) {
      return null;
    }

    const artists = Array.isArray(candidate.artists)
      ? candidate.artists
          .filter(
            (artist): artist is { name: string } =>
              Boolean(artist) &&
              typeof artist === "object" &&
              "name" in artist &&
              typeof artist.name === "string",
          )
          .map((artist) => artist.name)
      : [];

    const duration =
      candidate.duration &&
      typeof candidate.duration === "object" &&
      "seconds" in candidate.duration &&
      typeof candidate.duration.seconds === "number"
        ? candidate.duration.seconds
        : undefined;

    const thumbnailUrl =
      Array.isArray(candidate.thumbnails) &&
      candidate.thumbnails.length > 0 &&
      candidate.thumbnails[0] &&
      typeof candidate.thumbnails[0] === "object" &&
      "url" in candidate.thumbnails[0] &&
      typeof candidate.thumbnails[0].url === "string"
        ? candidate.thumbnails[0].url
        : undefined;

    return {
      id: candidate.id,
      title: candidate.title,
      artists,
      durationSeconds: duration,
      thumbnailUrl,
    };
}

export interface TrackInfo extends SearchTrack {
  channelId?: string;
  channelName?: string;
  description?: string;
  isLive: boolean;
}

export async function getTrackInfo(id: string): Promise<TrackInfo> {
  const client = await getClient();
  const info = await client.music.getInfo(id);
  const basic = info.basic_info;

  if (!basic.id || !basic.title) {
    throw new Error("Track metadata is incomplete");
  }

  return {
    id: basic.id,
    title: basic.title,
    artists: basic.author ? [basic.author] : [],
    durationSeconds: basic.duration,
    thumbnailUrl: basic.thumbnail?.[0]?.url,
    channelId: basic.channel_id,
    channelName: basic.author,
    description: basic.short_description,
    isLive: basic.is_live === true,
  };
}

export interface StreamInfo {
  url: string;
  mimeType: string;
  bitrate: number;
  contentLength?: number;
  durationSeconds: number;
}

export async function getStreamInfo(id: string): Promise<StreamInfo> {
  const client = await getClient();

  const format = await client.getStreamingData(id, {
    type: "audio",
    quality: "best",
  });

  if (!format.url) {
    throw new Error("Innertube returned an audio format without a URL");
  }

  return {
    url: format.url,
    mimeType: format.mime_type,
    bitrate: format.bitrate,
    contentLength: format.content_length,
    durationSeconds: format.approx_duration_ms / 1000,
  };
}
