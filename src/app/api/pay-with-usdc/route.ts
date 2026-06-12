import { NextResponse } from "next/server";
import { encodeFunctionData, parseAbi } from "viem";
import { PrivyClient } from '@privy-io/node';

// import {
//   type WalletApiRequestSignatureInput,
//   type AuthorizationContext,
//   generateAuthorizationSignatures,
//   PrivyClient,
// } from '@privy-io/node';
const BASE_SEPOLIA_USDC_ADDRESS =
  "0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f" as const;
const BACKEND_URL =
  process.env.PAY_WITH_USDC_BACKEND_URL ??
  "http://localhost:3300";
const ERC20_APPROVE_ABI = [
  {
    type: 'function' as const,
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;


const privy = new PrivyClient({
  appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  appSecret: process.env.PRIVY_APP_SECRET!
});

async function sendSponsoredTransaction(walletId: string,to:string,data:string) {
  try {
          let chainId = 8453

    // Send a sponsored transaction on Ethereum
    const response = await privy
      .wallets()
      .ethereum()
      .sendTransaction(walletId, {
        caip2: 'eip155:'+chainId, // Ethereum mainnet
        params: {
          transaction: {
            chain_id: `0x${chainId.toString(16)}`,
            to,
            value: '0x0',
            data, // optional contract call data
          },
        },
        sponsor: true, // Enable gas sponsorship
      });

    // Response contains transaction hash and ID
    console.log('Transaction hash:', response.hash);
    console.log('Transaction ID:', response.transaction_id);
    return response;
  } catch (error) {
    console.error('Transaction failed:', error);
    throw error;
  }
}


export async function POST(request: Request) {
  try {
    const body = await request.json();
      const data = await sendSponsoredTransaction(body.walletId,body.to,body.data);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: String(e) },
      { status: 500 }
    );
  }
}
