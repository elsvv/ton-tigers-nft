import { LiteClient } from "ton-lite-client";
import {
  TonClient,
  TonClient4,
  WalletContractV1R1,
  WalletContractV1R2,
  WalletContractV1R3,
  WalletContractV2R1,
  WalletContractV2R2,
  WalletContractV3R1,
  WalletContractV3R2,
  WalletContractV4,
} from "@ton/ton";
import {
  Address,
  Cell,
  Contract,
  ContractProvider,
  internal,
  MessageRelaxed,
  OpenedContract,
  Sender,
  SenderArguments,
  SendMode,
  StateInit,
} from "@ton/core";

import { keyPairFromSecretKey, mnemonicToPrivateKey } from "@ton/crypto";
import { Maybe } from "@ton/core/dist/utils/maybe";

export interface SendProvider {
  connect(): Promise<void>;
  sendTransaction(
    address: Address,
    amount: bigint,
    payload?: Cell,
    stateInit?: StateInit
  ): Promise<any>;
  address(): Address | undefined;
}

interface WalletInstance extends Contract {
  getSeqno(provider: ContractProvider): Promise<number>;

  sendTransfer(
    provider: ContractProvider,
    args: {
      seqno: number;
      secretKey: Buffer;
      messages: MessageRelaxed[];
      sendMode?: SendMode;
      timeout?: number;
    }
  ): Promise<void>;
}

interface WalletClass {
  create(args: { workchain: number; publicKey: Buffer }): WalletInstance;
}

export type WalletVersion = "v1r1" | "v1r2" | "v1r3" | "v2r1" | "v2r2" | "v3r1" | "v3r2" | "v4";

const wallets: Record<WalletVersion, WalletClass> = {
  v1r1: WalletContractV1R1,
  v1r2: WalletContractV1R2,
  v1r3: WalletContractV1R3,
  v2r1: WalletContractV2R1,
  v2r2: WalletContractV2R2,
  v3r1: WalletContractV3R1,
  v3r2: WalletContractV3R2,
  v4: WalletContractV4,
};

export class WalletProvider implements SendProvider {
  #wallet: OpenedContract<WalletInstance>;
  #secretKey: Buffer;
  #client: LiteClient | TonClient | TonClient4;

  constructor(params: {
    version: WalletVersion;
    workchain?: number;
    secretKey: Buffer;
    client: LiteClient | TonClient | TonClient4;
  }) {
    if (!(params.version in wallets)) {
      throw new Error(`Unknown wallet version ${params.version}`);
    }

    const kp = keyPairFromSecretKey(params.secretKey);
    this.#client = params.client;
    this.#wallet = this.#client.open<WalletInstance>(
      wallets[params.version].create({
        workchain: params.workchain ?? 0,
        publicKey: kp.publicKey,
      })
    );
    this.#secretKey = kp.secretKey;
  }

  static asSender(params: {
    version: WalletVersion;
    workchain?: number;
    secretKey: Buffer;
    client: LiteClient | TonClient | TonClient4;
  }) {
    const sendProvider: SendProvider = new WalletProvider(params);
    return new SendProviderSender(sendProvider);
  }

  async connect() {
    console.log(`Connected to wallet at address: ${this.address()} via lite client\n`);
  }

  async sendTransaction(
    address: Address,
    amount: bigint,
    payload?: Cell | undefined,
    stateInit?: StateInit | undefined
  ) {
    await this.#wallet.sendTransfer({
      seqno: await this.#wallet.getSeqno(),
      secretKey: this.#secretKey,
      messages: [internal({ to: address, value: amount, init: stateInit, body: payload })],
    });

    console.log("Transaction was sent");
  }

  async sendTransactions(
    msgs: {
      to: Address | string;
      value: bigint | string;
      bounce?: Maybe<boolean>;
      init?: Maybe<{
        code?: Maybe<Cell>;
        data?: Maybe<Cell>;
      }>;
      body?: Maybe<Cell | string>;
    }[]
  ) {
    await this.#wallet.sendTransfer({
      seqno: await this.#wallet.getSeqno(),
      secretKey: this.#secretKey,
      messages: msgs.map((m) => internal(m)),
    });

    console.log("Transaction was sent");
  }

  address() {
    return this.#wallet.address;
  }
}

class SendProviderSender implements Sender {
  #provider: SendProvider;
  readonly address?: Address;

  constructor(provider: SendProvider) {
    this.#provider = provider;
    this.address = provider.address();
  }

  async send(args: SenderArguments): Promise<void> {
    if (args.bounce !== undefined) {
      console.warn(
        "Warning: blueprint's Sender does not support `bounce` flag, because it is ignored by all used Sender APIs"
      );
      console.warn(
        "To silence this warning, change your `bounce` flags passed to Senders to unset or undefined"
      );
    }

    if (!(args.sendMode === undefined || args.sendMode === SendMode.PAY_GAS_SEPARATELY)) {
      throw new Error(
        "Deployer sender does not support `sendMode` other than `PAY_GAS_SEPARATELY`"
      );
    }

    await this.#provider.sendTransaction(
      args.to,
      args.value,
      args.body ?? undefined,
      args.init ?? undefined
    );
  }
}

export async function initMnemonicEnvWallet(client: LiteClient | TonClient | TonClient4) {
  const walletVersion = process.env.WALLET_VERSION!;
  const { secretKey } = await mnemonicToPrivateKey(process.env.WALLET_MNEMONIC!.split(" "));

  return new WalletProvider({
    version: walletVersion.toLowerCase() as WalletVersion,
    secretKey,
    client,
  });
}

export async function initMnemonicEnvSender(client: LiteClient | TonClient | TonClient4) {
  const walletVersion = process.env.WALLET_VERSION!;
  const { secretKey } = await mnemonicToPrivateKey(process.env.WALLET_MNEMONIC!.split(" "));

  return WalletProvider.asSender({
    version: walletVersion.toLowerCase() as WalletVersion,
    secretKey,
    client,
  });
}
