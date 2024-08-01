export { TonConnectProvider } from "./tonconnect-wrapper";
export { FSStorage } from "./FSStorage";
export { loadCsv } from "./csv";
export * from "./wallet-provider";

export function toChunks<T>(arr: T[], chunkSize: number) {
  const result = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    result.push(arr.slice(i, i + chunkSize));
  }
  return result;
}

export function shuffleArray<T>(_array: T[]) {
  const array = [..._array];

  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }

  return array;
}
