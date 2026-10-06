import assert from "node:assert/strict";
import test from "node:test";
import { decideShipmentImage } from "../src/image_decision.js";

test("an exception produces an exception brief without inventing parcel damage", () => {
  const decision = decideShipmentImage({
    shipmentId: "SHP-17",
    eventId: "EVT-9",
    status: "exception",
    location: "sorting hub 3",
    occurredAt: "2026-09-28T08:30:00.000Z",
    exceptionReason: "address label is unreadable",
  });

  assert.equal(decision.kind, "exception_brief");
  assert.match(decision.prompt, /address label is unreadable/);
  assert.match(decision.prompt, /Do not depict damage unless stated/);
});
