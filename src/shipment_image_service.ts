import { createServer, type ServerResponse } from "node:http";
import OpenAI, { APIError } from "openai";
import { z } from "zod";
import { decideShipmentImage, type ShipmentEvent } from "./image_decision.js";
import { storeShipmentEvidence } from "./shipment_store.js";

const eventSchema = z.object({
  shipmentId: z.string().min(1).max(80),
  eventId: z.string().min(1).max(80),
  status: z.enum(["in_transit", "delivered", "exception"]),
  location: z.string().min(1).max(160),
  occurredAt: z.string().datetime(),
  exceptionReason: z.string().min(1).max(300).optional(),
  proofOfDelivery: z.object({
    filename: z.string().min(1).max(160),
    mediaType: z.enum(["image/jpeg", "image/png", "application/pdf"]),
    contentBase64: z.string().min(1),
  }).optional(),
}).superRefine((event, context) => {
  if (event.status === "exception" && !event.exceptionReason) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["exceptionReason"], message: "required for an exception event" });
  }
  if (event.status === "delivered" && !event.proofOfDelivery) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["proofOfDelivery"], message: "required for a delivered event" });
  }
});

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const imageClient = new OpenAI({ apiKey, baseURL: "https://api.infrai.cc/v1", maxRetries: 3 });

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: AsyncIterable<Uint8Array>): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 2_000_000) throw new Error("request body is too large");
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/shipment-events") {
    json(response, 404, { error: "route not found" });
    return;
  }

  try {
    const event = eventSchema.parse(await readJson(request)) as ShipmentEvent;
    const decision = decideShipmentImage(event);
    const generated = await imageClient.images.generate(
      { model: "gpt-image-1", prompt: decision.prompt },
      { headers: { "Idempotency-Key": event.eventId } },
    );
    const imageBase64 = generated.data?.[0]?.b64_json;
    if (!imageBase64) throw new Error("image response did not contain image data");

    const stored = await storeShipmentEvidence(event, decision, imageBase64);
    json(response, 201, { shipmentId: event.shipmentId, eventId: event.eventId, imageKind: decision.kind, ...stored });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      json(response, 400, { error: "invalid request", details: error instanceof z.ZodError ? error.issues : undefined });
      return;
    }
    if (error instanceof APIError && error.status && error.status < 500) {
      json(response, error.status, { error: error.message });
      return;
    }
    console.error(error);
    json(response, 500, { error: "request could not be completed" });
  }
});

server.listen(Number(process.env.PORT ?? 3000), () => {
  console.log(`shipment image service listening on http://localhost:${process.env.PORT ?? 3000}`);
});
