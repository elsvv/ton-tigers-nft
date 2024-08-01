import { NetworkProvider, sleep } from "@ton/blueprint";
import { Address } from "@ton/core";

import { NftCollection } from "../wrappers/NftCollection";
import { FSStorage, TonConnectProvider, loadCsv, toChunks } from "../utils";
import { join } from "path";

export async function run(provider: NetworkProvider) {
  const tcProvider = new TonConnectProvider(
    new FSStorage(join(__dirname, "..", "tc-data", "data.json")),
    provider.ui()
  );

  await tcProvider.connect();

  const client = provider.api();

  const collectionAddress = Address.parse("EQAZZ_k1XxkmjbDzwK6k_6-eg0qwOBQoGBwU5f875jImSqUH");
  const collection = client.open(NftCollection.createFromAddress(collectionAddress));

  const filename = "shuffled-list.csv";
  const csvData: string[][] = await loadCsv(join(__dirname, filename), false);

  const ownersData = csvData.map(([addr]) => Address.parse(addr.trim()));

  const mintChunks = toChunks(ownersData, NftCollection.maxBatchMint);
  const mintMsgsPerTx = 4;

  const txChunks = toChunks(mintChunks, mintMsgsPerTx);

  for (let i = 5; i < txChunks.length; i++) {
    const txChunk = txChunks[i];
    console.log("Sending chunk", i);

    await tcProvider.sendTransactions(
      txChunk.map((chunk) => {
        const amount = NftCollection.getBatchMintValue(chunk);
        const payload = NftCollection.batchMintPayload(chunk);

        return { address: collection.address, amount, payload };
      })
    );

    await sleep(30_000);
  }
}
