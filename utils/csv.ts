import { createReadStream } from "fs";
import path from "path";
import * as csv from "fast-csv";

export async function loadCsv<T>(filePath: string, headers = true): Promise<T[]> {
  const data: T[] = [];
  return new Promise((resolve, reject) => {
    createReadStream(path.resolve(filePath))
      .pipe(csv.parse({ headers }))
      .on("error", (error) => {
        reject(error);
      })
      .on("data", (row: T) => {
        data.push(row);
      })
      .on("end", () => resolve(data));
  });
}
