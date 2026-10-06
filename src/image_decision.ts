export type ShipmentEvent = {
  shipmentId: string;
  eventId: string;
  status: "in_transit" | "delivered" | "exception";
  location: string;
  occurredAt: string;
  exceptionReason?: string;
  proofOfDelivery?: {
    filename: string;
    mediaType: "image/jpeg" | "image/png" | "application/pdf";
    contentBase64: string;
  };
};

export type ImageDecision = {
  kind: "tracking" | "delivery_confirmation" | "exception_brief";
  prompt: string;
};

export function decideShipmentImage(event: ShipmentEvent): ImageDecision {
  if (event.status === "delivered") {
    return {
      kind: "delivery_confirmation",
      prompt: `Create a clean logistics delivery confirmation image for shipment ${event.shipmentId}. Show a sealed parcel delivered at ${event.location}. Use a white background, green confirmation mark, and readable shipment ID. Do not invent recipient details.`,
    };
  }

  if (event.status === "exception") {
    return {
      kind: "exception_brief",
      prompt: `Create a clear logistics exception image for shipment ${event.shipmentId} at ${event.location}. Depict the operational issue: ${event.exceptionReason}. Use an amber warning symbol and readable shipment ID. Do not depict damage unless stated.`,
    };
  }

  return {
    kind: "tracking",
    prompt: `Create a clean logistics tracking image for shipment ${event.shipmentId}, currently in transit near ${event.location}. Show a parcel moving through a distribution route with a readable shipment ID.`,
  };
}
