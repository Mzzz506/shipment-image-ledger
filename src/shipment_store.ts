import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import type { ImageDecision, ShipmentEvent } from "./image_decision.js";

const dataRoot = process.env.DATA_DIR ?? "data";

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export async function storeShipmentEvidence(
  event: ShipmentEvent,
  decision: ImageDecision,
  imageBase64: string,
): Promise<{ imagePath: string; eventPath: string; proofPath?: string }> {
  const directory = join(dataRoot, safeSegment(event.shipmentId));
  await mkdir(directory, { recursive: true });

  const stem = safeSegment(event.eventId);
  const imagePath = join(directory, `${stem}-${decision.kind}.png`);
  const eventPath = join(directory, `${stem}.json`);
  await writeFile(imagePath, Buffer.from(imageBase64, "base64"));

  let proofPath: string | undefined;
  if (event.proofOfDelivery) {
    const suffix = extname(event.proofOfDelivery.filename) || ".bin";
    proofPath = join(directory, `${stem}-proof${suffix}`);
    await writeFile(proofPath, Buffer.from(event.proofOfDelivery.contentBase64, "base64"));
  }

  await writeFile(
    eventPath,
    JSON.stringify({ event: { ...event, proofOfDelivery: event.proofOfDelivery ? { filename: event.proofOfDelivery.filename, mediaType: event.proofOfDelivery.mediaType } : undefined }, image: { kind: decision.kind, path: imagePath }, proofPath }, null, 2),
  );
  return { imagePath, eventPath, proofPath };
}
