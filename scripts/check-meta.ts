import { NetworkProvider, sleep } from "@ton/blueprint";

export async function run(provider: NetworkProvider) {
  const startI = 0;
  const endI = 6667;

  const baseUrl = "https://storage.googleapis.com/ton-tigers/";

  const metaErrorsIdx: number[] = [];
  const imgErrorsIdx: number[] = [];

  for (let i = startI; i < endI; i++) {
    console.log("Check", i);

    fetch(`${baseUrl}${i}.json`).then((res) => {
      if (!res.ok) {
        metaErrorsIdx.push(i);
        console.log(i, "meta error");
      }
    });

    fetch(`${baseUrl}${i}.png`).then((res) => {
      if (!res.ok) {
        imgErrorsIdx.push(i);
        console.log(i, "img error");
      }
    });
  }

  await sleep(40_000);
  console.log("metaErrors", metaErrorsIdx.length, metaErrorsIdx);
  console.log("imgErrors", imgErrorsIdx.length, imgErrorsIdx);
}
