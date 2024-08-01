import { Address, Cell, Contract, ContractProvider } from "@ton/core";

export class NftItem implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromAddress(address: Address) {
    return new NftItem(address);
  }

  async getNftData(provider: ContractProvider) {
    const { stack } = await provider.get("get_nft_data", []);
    return {
      inited: stack.readBoolean(),
      index: stack.readNumber(),
      collection_address: stack.readAddress(),
      owner_address: stack.readAddress(),
    };
  }
}
