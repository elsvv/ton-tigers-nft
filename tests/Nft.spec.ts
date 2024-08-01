import { Cell, beginCell, fromNano, toNano } from "@ton/core";
import "@ton/test-utils";
import { Blockchain, SandboxContract, TreasuryContract } from "@ton/sandbox";
import { NftCollection, packCollectionCommonContent } from "../wrappers/NftCollection";
import { compile } from "@ton/blueprint";
import { toChunks } from "../utils";

describe("One TX mint Nft", () => {
  let collectionCode: Cell;
  let nftItemCode: Cell;

  let blockchain: Blockchain;
  let deployer: SandboxContract<TreasuryContract>;
  let owner: SandboxContract<TreasuryContract>;
  let collection: SandboxContract<NftCollection>;

  const maxNftItems = 5555;

  async function getNft(index: number) {
    return blockchain.openContract(await collection.getNftItem(index));
  }

  beforeAll(async () => {
    collectionCode = await compile("NftCollection");
    nftItemCode = await compile("NftItem");
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    blockchain.now = Math.floor(Date.now() / 1000);

    deployer = await blockchain.treasury("deployer");
    owner = await blockchain.treasury("owner");

    collection = blockchain.openContract(
      NftCollection.createFromConfig(
        {
          ownerAddress: owner.address,
          royalty: {
            denominator: 1,
            numerator: 1,
            destination: owner.address,
          },
          content: {
            collection_content: "",
            common_content: "",
          },
          nftItemCode,
        },
        collectionCode
      )
    );

    const deployCollectionResult = await collection.sendDeploy(deployer.getSender(), toNano("0.1"));

    expect(deployCollectionResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: collection.address,
      deploy: true,
      success: true,
    });
  });

  it("should set collection init data", async () => {
    const data = await collection.getCollectionData();
    expect(data.owner_address).toEqualAddress(owner.address);
  });

  it("should change collection owner set max nft items", async () => {
    const result1 = await collection.sendChangeOwner(
      deployer.getSender(),
      toNano("0.1"),
      deployer.address
    );
    expect(result1.transactions).toHaveTransaction({
      from: deployer.address,
      to: collection.address,
      success: false,
    });
    expect((await collection.getCollectionData()).owner_address).toEqualAddress(owner.address);

    const result2 = await collection.sendChangeOwner(
      owner.getSender(),
      toNano("0.1"),
      deployer.address
    );
    expect(result2.transactions).toHaveTransaction({
      from: owner.address,
      to: collection.address,
      success: true,
    });
    expect((await collection.getCollectionData()).owner_address).toEqualAddress(deployer.address);
  });

  it("should change collection content", async () => {
    const newContent = { collection_content: "new", common_content: "yep" };
    const collectionContent = beginCell()
      .storeUint(1, 8)
      .storeStringTail(newContent.collection_content)
      .endCell();
    const result1 = await collection.sendChangeContent(
      deployer.getSender(),
      toNano("0.1"),
      newContent
    );
    expect(result1.transactions).toHaveTransaction({
      from: deployer.address,
      to: collection.address,
      success: false,
    });
    expect((await collection.getCollectionData()).content).not.toEqualCell(collectionContent);

    const result2 = await collection.sendChangeContent(
      owner.getSender(),
      toNano("0.1"),
      newContent
    );
    expect(result2.transactions).toHaveTransaction({
      from: owner.address,
      to: collection.address,
      success: true,
    });
    expect((await collection.getCollectionData()).content).toEqualCell(collectionContent);
  });

  it("should not deploy uppon not owner request", async () => {
    const targetContractsList = await blockchain.createWallets(NftCollection.maxBatchMint);
    const addrList = targetContractsList.map((d) => d.address);

    const result = await collection.sendBatchMint(deployer.getSender(), addrList);
    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: collection.address,
      success: false,
    });
  });

  it("should batch deploy max items", async () => {
    const balanceBefore = await owner.getBalance();
    const targetContractsList = await blockchain.createWallets(NftCollection.maxBatchMint);
    const addrList = targetContractsList.map((d) => d.address);

    const result = await collection.sendBatchMint(owner.getSender(), addrList);

    expect(result.transactions).toHaveTransaction({
      from: owner.address,
      to: collection.address,
      success: true,
    });

    for (let i = 0; i < targetContractsList.length; i++) {
      const nftItem = await getNft(i);
      expect(result.transactions).toHaveTransaction({
        from: collection.address,
        to: nftItem.address,
        deploy: true,
        success: true,
      });
      const nftData = await nftItem.getNftData();
      expect(nftData.index).toEqual(i);
      expect(nftData.owner_address).toEqualAddress(targetContractsList[i].address);
    }

    const balanceAfter = await owner.getBalance();

    console.log("TONs paid:");
    console.log(fromNano(balanceBefore - balanceAfter));
  });

  it("should batch deploy max items multiple times", async () => {
    const balanceBefore = await owner.getBalance();

    const perChunk = NftCollection.maxBatchMint;
    const targetCount = 6667;
    const targetContractsList = await blockchain.createWallets(targetCount);
    const addrList = targetContractsList.map((d) => d.address);

    const contractsChunks = toChunks(targetContractsList, perChunk);
    const addrChunks = toChunks(addrList, perChunk);

    let nextIndex = 0;
    expect((await collection.getCollectionData()).next_item_index).toBe(nextIndex);

    for (let i = 0; i < contractsChunks.length; i++) {
      const contractsChunk = contractsChunks[i];
      const addrChunk = addrChunks[i];

      const result = await collection.sendBatchMint(owner.getSender(), addrChunk);
      expect(result.transactions).toHaveTransaction({
        from: owner.address,
        to: collection.address,
        success: true,
      });

      for (let k = 0; k < contractsChunk.length; k++) {
        const realIndex = nextIndex + k;
        const nftItem = await getNft(realIndex);
        expect(result.transactions).toHaveTransaction({
          from: collection.address,
          to: nftItem.address,
          deploy: true,
          success: true,
        });
        const nftData = await nftItem.getNftData();
        expect(nftData.index).toEqual(realIndex);
        expect(nftData.owner_address).toEqualAddress(contractsChunk[k].address);
      }

      nextIndex = (await collection.getCollectionData()).next_item_index;
    }

    const balanceAfter = await owner.getBalance();

    console.log("(batch) TONs paid:");
    console.log(fromNano(balanceBefore - balanceAfter));
  });
});
