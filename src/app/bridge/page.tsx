import type { Metadata } from "next";
import { BridgeApp } from "@/components/BridgeApp";

export const metadata: Metadata = { title: "Taste Bridge — TasteBridge" };

export default function BridgePage() {
  return <BridgeApp />;
}
