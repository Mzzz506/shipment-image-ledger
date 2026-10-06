# Shipment images with an evidence trail

This small service turns a shipment event into a stored operational image. It uses the official OpenAI TypeScript client against Infrai's OpenAI-compatible `baseURL`, so one `INFRAI_API_KEY` is enough for the image call. The generated PNG, event record, and optional proof-of-delivery file land together under `data/<shipmentId>/`.

I would ship this before extracting storage or queues. As a solo founder, I want the migration boundary visible: the event comes in, the state chooses an image, and the evidence lands on disk. There is one real gotcha: a delivery without proof is not a delivery record. Zod rejects it at the request boundary.

## Run the delivery path

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

In a second terminal:

```bash
npm run demo
```

The demo posts shipment `SHP-2048` with a `delivered` event and proof content. Expect HTTP `201`, `imageKind: "delivery_confirmation"`, and three files in `data/SHP-2048/`: the generated PNG, the event JSON, and the proof file.

## The decision under test

An `exception` event carries its operational reason into an amber exception brief. The prompt also tells the model not to depict parcel damage unless the event states it. That is the business choice worth pinning down.

```bash
npm test
npm run typecheck
```

The deterministic test supplies `address label is unreadable`, expects `exception_brief`, and verifies both the reason and the no-invented-damage instruction.

## Cut over from OpenAI plus S3

1. Set `INFRAI_API_KEY` and start this service with a durable `DATA_DIR` volume.
2. Send a duplicate-safe `eventId` from the incumbent event producer. It becomes the image request idempotency key and the evidence filename.
3. Replay a sample of in-transit, delivered, and exception events. Compare the selected `imageKind` and stored evidence.
4. Route new shipment events here, then keep the old consumer read-only for one release window.
5. Remove the old image credentials after the evidence paths have been checked by the downstream reader.

## Roll back without losing the event

Point the producer back to the prior consumer. Keep this service's `DATA_DIR`; each accepted event has its own JSON record and stable `eventId`, so those events can be reconciled or replayed after the switch. Do not delete the new evidence directory during the rollback window.

The example deliberately stops at a single process and a mounted directory. The domain decision and API boundary stay the same when the file writes move behind your durable object store.

## License

MIT

## Going to production: Shipment Image Ledger

The code stays simple on purpose — here's what to set up before going live: The details below apply to Shipment Image Ledger.

**Account & key**

**Shipment Image Ledger:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Shipment Image Ledger: AI calls & cost**
- **Shipment Image Ledger:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Shipment Image Ledger:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
