"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardFooter, Image, Button } from "@nextui-org/react";

interface MintEvent {
  signature: string;
  mintAddress: string;
  creator: string;
  supply: number;
  decimals: number | string;
  name: string;
  image: string;
  price: number | string;
  marketCap: number | string;
}

export default function Home() {
  const [events, setEvents] = useState<MintEvent[]>([]);

  useEffect(() => {
    // Subscribe to SSE
    const eventSource = new EventSource("/api/pumpfun-listener");

    eventSource.onmessage = (ev) => {
      try {
        const data: MintEvent = JSON.parse(ev.data);
        // Prepend so newest mint is top-left
        setEvents((prev) => [data, ...prev]);
      } catch (error) {
        console.error("Error parsing SSE event:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("SSE error:", error);
      eventSource.close();
    };

    return () => eventSource.close();
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* NAVIGATION */}
      <nav className="flex items-center justify-between px-8 py-4 bg-white shadow">
        <span className="font-bold text-lg text-blue-600">pumped!</span>
        <div className="space-x-4">
          <a href="#" className="text-gray-600 hover:text-gray-800">Home</a>
          <a href="#" className="text-gray-600 hover:text-gray-800">Features</a>
          <a href="#" className="text-gray-600 hover:text-gray-800">About</a>
        </div>
      </nav>

      {/* HERO SECTION */}
      <header className="bg-gray-50 text-center py-12 px-4">
        <h1 className="text-4xl font-extrabold text-gray-800 mb-4">Live Mints</h1>
        <p className="text-lg text-gray-600 max-w-md mx-auto">
          Watch real-time Pump.fun tokens appear, complete with metadata from Helius.
        </p>
      </header>

      {/* GRID OF MINT CARDS */}
      <main className="flex-grow px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {events.map((mint, index) => {
            // Safely format supply
            const supplyStr =
              typeof mint.supply === "number"
                ? mint.supply.toLocaleString()
                : String(mint.supply);

            const address = mint.mintAddress || "";

            // Combine signature + index to ensure uniqueness
            // even if the same signature is repeated
            const uniqueKey = `${mint.signature || "fallback"}-${index}`;

            return (
              <Card
                // unique key so React doesn't warn about duplicates
                key={uniqueKey}
                // Add radius to the card
                className="relative h-[300px] w-full overflow-hidden rounded-md"
              >
                <CardHeader className="absolute top-1 z-10 bg-black/50 text-white p-2 rounded flex-col items-start">
                  <p className="text-xs uppercase font-bold">
                    {mint.name || "New Token"}
                  </p>
                  <p className="text-xs">
                    {address
                      ? `${address.slice(0, 6)}...${address.slice(-6)}`
                      : "No Address"}
                  </p>
                </CardHeader>

                <Image
                  alt={mint.name}
                  src={mint.image || "/placeholder.jpg"}
                  className="z-0 w-full h-full object-cover"
                />

                <CardFooter className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-black/40 text-white p-2 text-xs">
                  <p>Supply: {supplyStr}</p>
                  <Button size="sm" className="text-xs">
                    Details
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </main>

      {/* FOOTER */}
      <footer className="bg-gradient-to-r from-blue-600 to-blue-400 text-white py-4">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between">
          <p>&copy; {new Date().getFullYear()} Pump.fun. All rights reserved.</p>
          <div className="space-x-4 mt-2 sm:mt-0">
            <a href="#" className="hover:text-gray-200">Contact</a>
            <a href="#" className="hover:text-gray-200">Privacy</a>
            <a href="#" className="hover:text-gray-200">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
