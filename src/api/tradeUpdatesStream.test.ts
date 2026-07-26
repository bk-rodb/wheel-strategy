import { describe, expect, it } from "vitest";
import { TradeUpdatesStream } from "./tradeUpdatesStream";

describe("tradeUpdatesStream (inert)", () => {
  it("reports connected=false", () => {
    const stream = new TradeUpdatesStream();
    expect(stream.connected).toBe(false);
  });

  it("subscribe/unsubscribe and track/untrack/close without throwing", () => {
    const stream = new TradeUpdatesStream();
    const handler = () => undefined;
    const unsub = stream.subscribe(handler);
    stream.track("ord-1", "cid-1");
    stream.untrack("ord-1", "cid-1");
    stream.close();
    unsub();
    expect(stream.connected).toBe(false);
  });
});
