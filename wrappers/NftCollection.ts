import {
  Address,
  beginCell,
  Builder,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Sender,
  SendMode,
  toNano,
} from "@ton/core";
import { NftItem } from "./NftItem";

export type CollectionCommonContent = {
  collection_content: string;
  common_content: string;
};

export function packCollectionCommonContent(data: CollectionCommonContent): Cell {
  return beginCell()
    .storeStringRefTail(data.collection_content)
    .storeStringRefTail(data.common_content)
    .endCell();
}

type RoyaltyParams = {
  numerator: number;
  denominator: number;
  destination: Address;
};

type NftCollectionConfig = {
  ownerAddress: Address;
  content: CollectionCommonContent;
  nftItemCode: Cell;
  royalty: RoyaltyParams;
};

export function packRoyaltyParams(data: RoyaltyParams): Cell {
  return beginCell()
    .storeUint(data.numerator, 16)
    .storeUint(data.denominator, 16)
    .storeAddress(data.destination)
    .endCell();
}

export function nftCollectionConfigToCell(config: NftCollectionConfig): Cell {
  return beginCell()
    .storeAddress(config.ownerAddress)
    .storeUint(0, 32) // next_item_index
    .storeRef(packCollectionCommonContent(config.content))
    .storeRef(config.nftItemCode)
    .storeRef(packRoyaltyParams(config.royalty))
    .endCell();
}

export class NftCollection implements Contract {
  static maxBatchMint = 210;

  constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

  static createFromAddress(address: Address) {
    return new NftCollection(address);
  }

  static createFromConfig(config: NftCollectionConfig, code: Cell, workchain = 0) {
    const data = nftCollectionConfigToCell(config);
    const init = { code, data };
    return new NftCollection(contractAddress(workchain, init), init);
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
    });
  }

  static batchMintPayload(addrList: Address[]) {
    if (addrList.length > NftCollection.maxBatchMint) {
      throw new Error(
        `Batch mint list shold be not more than ${NftCollection.maxBatchMint}. Provided: ${addrList.length}`
      );
    }

    const refsList: Builder[] = [];
    let curRoot = beginCell();

    refsList.push(curRoot);

    addrList.forEach((addr) => {
      if (curRoot.availableBits >= 267) {
        curRoot = curRoot.storeAddress(addr);
      } else {
        curRoot = beginCell().storeAddress(addr);
        refsList.push(curRoot);
      }
    });

    const root = refsList.reduceRight((child, parent) => parent.storeRef(child));

    return beginCell().storeUint(0xf52b8289, 32).storeUint(0, 64).storeRef(root).endCell();
  }

  static getBatchMintValue(addrList: Address[]) {
    return toNano("0.02") * BigInt(addrList.length) + toNano("1");
  }

  async sendBatchMint(provider: ContractProvider, via: Sender, addrList: Address[]) {
    await provider.internal(via, {
      value: NftCollection.getBatchMintValue(addrList),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: NftCollection.batchMintPayload(addrList),
    });
  }

  static changeOwnerPayload(newOwner: Address) {
    return beginCell().storeUint(0x1c04412a, 32).storeUint(0, 64).storeAddress(newOwner).endCell();
  }

  async sendChangeOwner(provider: ContractProvider, via: Sender, value: bigint, newOwner: Address) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: NftCollection.changeOwnerPayload(newOwner),
    });
  }

  static changeContentPayload(newContent: CollectionCommonContent) {
    return beginCell()
      .storeUint(0x1a0b9d51, 32)
      .storeUint(0, 64)
      .storeRef(packCollectionCommonContent(newContent))
      .endCell();
  }

  async sendChangeContent(
    provider: ContractProvider,
    via: Sender,
    value: bigint,
    newContent: CollectionCommonContent
  ) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: NftCollection.changeContentPayload(newContent),
    });
  }

  async getCollectionData(provider: ContractProvider) {
    const { stack } = await provider.get("get_collection_data", []);
    return {
      next_item_index: stack.readNumber(),
      content: stack.readCell(),
      owner_address: stack.readAddress(),
    };
  }

  async getNftItem(provider: ContractProvider, index: number) {
    const { stack } = await provider.get("get_nft_address_by_index", [
      { type: "int", value: BigInt(index) },
    ]);
    return NftItem.createFromAddress(stack.readAddress());
  }
}
