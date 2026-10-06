const proof = Buffer.from("signed by depot 14").toString("base64");
const response = await fetch("http://localhost:3000/shipment-events", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    shipmentId: "SHP-2048",
    eventId: "EVT-DELIVERED-2048",
    status: "delivered",
    location: "Suzhou depot 14",
    occurredAt: "2026-09-28T08:30:00.000Z",
    proofOfDelivery: { filename: "signature.pdf", mediaType: "application/pdf", contentBase64: proof },
  }),
});

console.log(response.status, await response.json());
