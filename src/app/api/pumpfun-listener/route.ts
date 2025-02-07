import { Connection, PublicKey } from "@solana/web3.js";

/** ENV vars */
const PUMP_FUN_PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_PUMP_FUN_PROGRAM_ID!);
const HELIUS_API_KEY = process.env.HELIUS_API_KEY!;
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const HELIUS_WS_URL = `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

/**
 * Fetch DAS asset from Helius using "getAsset"
 */
async function fetchDasAsset(mintAddress: string) {
  try {
    console.log("💫 [DEBUG] Fetching DAS asset for:", mintAddress);
    const url = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

    const body = {
      jsonrpc: "2.0",
      id: "my-id",
      method: "getAsset",
      params: { id: mintAddress, displayOptions: { showFungible: true, showInscription: true } },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error(`❌ [DEBUG] Helius API Error: ${response.status}`);
      return { name: "Unknown Token", image: "", symbol: "N/A", price: "N/A", currency: "N/A", supply: 0, marketCap: "N/A" };
    }

    const data = await response.json();
    if (!data.result || !data.result.token_info) {
      console.warn("⚠️ [DEBUG] No asset data found for:", mintAddress);
      return { name: "Unknown Token", image: "", symbol: "N/A", price: "N/A", currency: "N/A", supply: 0, marketCap: "N/A" };
    }

    const tokenInfo = data.result.token_info;
    const metadata = data.result.content.metadata;
    const priceInfo = tokenInfo.price_info || {};

    const pricePerToken = priceInfo.price_per_token ?? "N/A";
    const currency = priceInfo.currency || "N/A";
    const supply = tokenInfo.supply || 0;
    const symbol = tokenInfo.symbol || "N/A";
    const marketCap = pricePerToken !== "N/A" ? (pricePerToken * supply).toFixed(2) : "N/A";

    return {
      name: metadata?.name || "Unknown Token",
      image: data.result.content.links?.image || "/placeholder.jpg",
      symbol,
      price: pricePerToken,
      currency,
      supply,
      marketCap,
    };
  } catch (error) {
    console.error("❌ [DEBUG] Error fetching DAS asset:", error);
    return { name: "Unknown Token", image: "", symbol: "N/A", price: "N/A", currency: "N/A", supply: 0, marketCap: "N/A" };
  }
}

/**
 * SSE GET handler
 */
export async function GET() {
  console.log("✅ [DEBUG] /api/pumpfun-listener started - Listening for mints...");

  const connection = new Connection(HELIUS_RPC_URL, { wsEndpoint: HELIUS_WS_URL });

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(`data: ${JSON.stringify({ message: "Hello from DAS + SSE" })}\n\n`);

      console.log("🔄 [DEBUG] Subscribing to onLogs...");
      connection.onLogs(
        PUMP_FUN_PROGRAM_ID,
        async (logs) => {
          try {
            //console.log("🚀 [DEBUG] New logs for signature:", logs.signature ?? "no-signature");

            if (logs.logs.some((log) => log.includes("Program log: Instruction: InitializeMint2"))) {
              console.log("🪙 [DEBUG] Detected 'InitializeMint2' in logs.");
              if (!logs.signature) {
                console.warn("⚠️ [DEBUG] No signature found, skipping...");
                return;
              }

              const transaction = await connection.getParsedTransaction(logs.signature, { maxSupportedTransactionVersion: 0 });

              if (!transaction) {
                console.log("❌ [DEBUG] transaction is null for:", logs.signature);
                return;
              }

              const mintInstruction = transaction.meta?.postTokenBalances?.find((balance) => balance.mint);
              if (!mintInstruction) {
                console.warn("⚠️ [DEBUG] No mint address found:", logs.signature);
                return;
              }

              const mintAddress = mintInstruction.mint;
              const creator = transaction.transaction.message.accountKeys[0]?.pubkey?.toString() || "Unknown";
              const decimals = mintInstruction.uiTokenAmount.decimals || "Unknown";

              const { name, image, symbol, price, currency, supply, marketCap } = await fetchDasAsset(mintAddress);

              const mintData = {
                signature: logs.signature,
                mintAddress,
                creator,
                supply,
                decimals,
                name,
                symbol,
                image,
                price,
                currency,
                marketCap,
              };

              console.log("✅ [DEBUG] Sending mint data via SSE:", mintData);
              controller.enqueue(`data: ${JSON.stringify(mintData)}\n\n`);
            }
          } catch (error) {
            console.error("🚨 [DEBUG] Error processing transaction:", error);
          }
        },
        "finalized"
      );
    },
    cancel() {
      console.log("❌ [DEBUG] SSE stream closed by client.");
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
