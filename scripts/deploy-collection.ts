import { NetworkProvider, compile } from "@ton/blueprint";
import { toNano } from "@ton/core";

import { NftCollection } from "../wrappers/NftCollection";
import { TonConnectProvider, FSStorage } from "../utils";
import { join } from "path";

export async function run(provider: NetworkProvider) {
  const client = provider.api();
  const tcProvider = new TonConnectProvider(
    new FSStorage(join(__dirname, "..", "tc-data", "data.json")),
    provider.ui()
  );

  await tcProvider.connect();

  const senderAddress = tcProvider.address();

  if (!senderAddress) throw new Error("Sender without address. Choose another provider");

  const ownerAddress = senderAddress;

  const royaltyParams = {
    numerator: 5,
    denominator: 100,
    destination: ownerAddress,
  };

  const content = {
    collection_content: "https://storage.googleapis.com/ton-tigers/root.json",
    common_content: "https://storage.googleapis.com/ton-tigers/",
  };

  const collection = client.open(
    NftCollection.createFromConfig(
      {
        ownerAddress,
        royalty: royaltyParams,
        nftItemCode: await compile("NftItem"),
        content,
      },
      await compile("NftCollection")
    )
  );

  console.log("Collection address:");
  console.log(collection.address);

  await tcProvider.sendTransaction(collection.address, toNano("0.1"), undefined, collection.init);
  // await collection.sendDeploy(provider.sender(), toNano("0.1"));
  await provider.waitForDeploy(collection.address);
}
