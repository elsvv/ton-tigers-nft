import { NetworkProvider } from "@ton/blueprint";
import { Address } from "@ton/core";

import { loadCsv, shuffleArray, toChunks } from "../utils";
import { join } from "path";
import { writeFileSync } from "fs";

export async function run(provider: NetworkProvider) {
  const filename = "tiger-nft-owners.csv";
  const csvData: string[][] = await loadCsv(join(__dirname, filename), false);

  const targetNftCount = 6667;

  const needFillWithAdminNftCount = targetNftCount - csvData.length;

  console.log({ needFillWithAdminNftCount });

  for (let i = 0; i < needFillWithAdminNftCount; i++) {
    csvData.push(["UQAMp_mw9s2gMTXBavwadYYMiwA09vx5ppHPqvb1t_8cTeut"]);
  }

  let ownersData = shuffleArray(csvData.map(([addr]) => Address.parse(addr.trim())));

  writeFileSync(
    join(__dirname, "shuffled-list.csv"),
    ownersData.map((i) => i.toString()).join("\n"),
    "utf-8"
  );
}
