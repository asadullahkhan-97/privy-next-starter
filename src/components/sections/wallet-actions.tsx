"use client";

import { useState, useMemo, useEffect } from "react";
import {
  useWallets,
  useSendTransaction as useSendTransactionEvm,
  useSignMessage as useSignMessageEvm,
  useSignTransaction as useSignTransactionEvm,
  useSignTypedData,
  useAuthorizationSignature,
  usePrivy
} from "@privy-io/react-auth";
import {
  useSignMessage as useSignMessageSolana,
  useSignTransaction as useSignTransactionSolana,
  useSignAndSendTransaction as useSendTransactionSolana,
  useWallets as useWalletsSolana,
} from "@privy-io/react-auth/solana";
import bs58 from "bs58";
import {
  address,
  appendTransactionMessageInstruction,
  compileTransaction,
  createNoopSigner,
  createSolanaRpc,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import { encodeFunctionData, parseAbi } from "viem";
import Section from "../reusables/section";
import { showSuccessToast, showErrorToast } from "@/components/ui/custom-toast";
import axios from "axios";

const BASE_SEPOLIA_USDC_ADDRESS =
  "0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f" as const;
const checkingAbi = [
   {
      "inputs": [
        { "internalType": "address", "name": "user", "type": "address" },
        { "internalType": "uint256", "name": "amount", "type": "uint256" },
        { "internalType": "uint256", "name": "feeAmount", "type": "uint256" }
      ],
      "name": "deposit",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
     {
      "inputs": [
        { "internalType": "address", "name": "fromAddress", "type": "address" },
        { "internalType": "address", "name": "toAddress", "type": "address" },
        { "internalType": "uint256", "name": "amount", "type": "uint256" },
        { "internalType": "uint256", "name": "feeAmount", "type": "uint256" }
      ],
      "name": "withdraw",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
      {
      "inputs": [
        { "internalType": "address", "name": "fromAddress", "type": "address" },
        { "internalType": "address", "name": "toAddress", "type": "address" },
        { "internalType": "uint256", "name": "amount", "type": "uint256" },
        { "internalType": "uint256", "name": "feeAmount", "type": "uint256" }
      ],
      "name": "internalTransfer",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
];
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
type WalletInfo = {
  address: string;
  type: "ethereum" | "solana";
  name: string;
};

const WalletActions = () => {
  const { signMessage: signMessageEvm } = useSignMessageEvm();
  const { signTransaction: signTransactionEvm } = useSignTransactionEvm();
  const { sendTransaction: sendTransactionEvm } = useSendTransactionEvm();
  const { signTypedData } = useSignTypedData();
  const { wallets: walletsEvm } = useWallets();
  const { signMessage: signMessageSolana } = useSignMessageSolana();
  const { signTransaction: signTransactionSolana } = useSignTransactionSolana();
  const { signAndSendTransaction: sendTransactionSolana } =
    useSendTransactionSolana();

  const { generateAuthorizationSignature } = useAuthorizationSignature();
  const { getAccessToken  } = usePrivy();

  const { wallets: walletsSolana } = useWalletsSolana();

  const allWallets = useMemo((): WalletInfo[] => {
    const evmWallets: WalletInfo[] = walletsEvm.map((wallet) => ({
      address: wallet.address,
      type: "ethereum" as const,
      name: wallet.address,
    }));

    const solanaWallets: WalletInfo[] = walletsSolana.map((wallet) => ({
      address: wallet.address,
      type: "solana" as const,
      name: wallet.address,
    }));

    return [...evmWallets, ...solanaWallets];
  }, [walletsEvm, walletsSolana]);

  const [selectedWallet, setSelectedWallet] = useState<WalletInfo | null>(null);
  const [usdcRecipient, setUsdcRecipient] = useState("");

  useEffect(() => {
    if (allWallets.length > 0 && !selectedWallet) {
      setSelectedWallet(allWallets[0]);
    }
  }, [allWallets, selectedWallet]);

  const isEvmWallet = selectedWallet?.type === "ethereum";
  const isSolanaWallet = selectedWallet?.type === "solana";

  const handleSignMessageEvm = async () => {
    if (!isEvmWallet || !selectedWallet) {
      showErrorToast("Please select an Ethereum wallet");
      return;
    }
    try {
      const message = "Hello, world!";
      const { signature } = await signMessageEvm(
        { message },
        { address: selectedWallet.address }
      );
      showSuccessToast(`EVM Message signed: ${signature.slice(0, 10)}...`);
    } catch (error) {
      console.log(error);
      showErrorToast("Failed to sign EVM message");
    }
  };


  const handleSignTransactionEvm = async () => {
    if (!isEvmWallet || !selectedWallet) {
      showErrorToast("Please select an Ethereum wallet");
      return;
    }
    try {
      const transaction = await signTransactionEvm(
        { to: "0xE3070d3e4309afA3bC9a6b057685743CF42da77C", value: 10000 },
        { address: selectedWallet.address }
      );
      const result =
        typeof transaction === "string"
          ? transaction
          : JSON.stringify(transaction);
      showSuccessToast(`EVM Transaction signed: ${result.slice(0, 20)}...`);
    } catch (error) {
      console.log(error);
      showErrorToast("Failed to sign EVM transaction");
    }
  };


  const handleSendTransactionEvm = async () => {
    if (!isEvmWallet || !selectedWallet) {
      showErrorToast("Please select an Ethereum wallet");
      return;
    }
    try {
      const transaction = await sendTransactionEvm(
        { to: "0xE3070d3e4309afA3bC9a6b057685743CF42da77C", value: 10000 },
        { address: selectedWallet.address }
      );
      const result =
        typeof transaction === "string"
          ? transaction
          : JSON.stringify(transaction);
      showSuccessToast(`EVM Transaction sent: ${result.slice(0, 20)}...`);
    } catch (error) {
      console.log(error);
      showErrorToast("Failed to send EVM transaction");
    }
  };

  // Base Sepolia (chainId 84532) – must match the chain sponsorship is enabled for in the Privy dashboard
  const SPONSORED_CHAIN_ID = 84532;

  const handleSendSponsoredTransactionEvm = async () => {
    if (!isEvmWallet || !selectedWallet) {
      showErrorToast("Please select an Ethereum wallet");
      return;
    }
    try {
      const transaction = await sendTransactionEvm(
        {
          to: "0xE3070d3e4309afA3bC9a6b057685743CF42da77C",
          value: 10000,
          chainId: SPONSORED_CHAIN_ID,
        },
        { address: selectedWallet.address, sponsor: true }
      );
      const result =
        typeof transaction === "string"
          ? transaction
          : JSON.stringify(transaction);
      showSuccessToast(
        `Gas-sponsored EVM transaction sent: ${result.slice(0, 20)}...`
      );
    } catch (error) {
      console.log(error);
      showErrorToast("Failed to send gas-sponsored EVM transaction");
    }
  };

  const handleSendSponsoredUsdcEvm = async () => {
 
    if (!isEvmWallet || !selectedWallet) {
      showErrorToast("Please select an Ethereum wallet");
      return;
    }
    const recipient = usdcRecipient.trim();
    if (!recipient || !/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
      showErrorToast("Please enter a valid recipient address (0x...)");
      return;
    }
    try {
      const encodedData = encodeFunctionData({
        abi: checkingAbi,
        functionName: "deposit",
        args:[selectedWallet.address as `0x${string}`,  BigInt(1_000_000),  BigInt(1_000_00)]
      });
      const payload = {
   caip2: 'eip155:84532',
   chain_type: 'ethereum',
   method: 'eth_sendTransaction',
   params: {
     transaction: {
       from: selectedWallet.address,
       to: '0x574407ce49c1E7fC8C6bF00f2c5F761F2Bd2b9A9',
       chain_id: '0x14a34',
       data: encodedData,
        value: '0x0'
     }
   },
   sponsor: true
 }
      const requestPayload = {
        version: 1,
        url: `https://auth.privy.io/api/v1/wallets/ubr9nard86yke2u9k169xdnm/rpc`,
        method: 'POST',
        headers: {
          'privy-app-id': 'cmjgzk05r00q5kz0c1vwhldnk'
        },
        body: payload
      }
      const { signature } = await generateAuthorizationSignature(requestPayload);
      console.log(signature);
      const newAccessToken = await getAccessToken();

    //  const response = await axios.post("/api/pay-with-usdc", {
    //     signature: signature,
    //     accessToken: newAccessToken,
    //   });
    //   showSuccessToast(`Gas-sponsored USDC transfer sent`);
      // const transaction = await sendTransactionEvm(
        // {
          // to: BASE_SEPOLIA_USDC_ADDRESS,
          // data: encodedData,
          // value: BigInt(0),
          // chainId: SPONSORED_CHAIN_ID,
        // },
        // { address: selectedWallet.address, sponsor: true }
      // );
      // const result =
        // typeof transaction === "string"
          // ? transaction
          // : JSON.stringify(transaction);
      // showSuccessToast(`Gas-sponsored USDC transfer sent: ${result.slice(0, 20)}...`);
    } catch (error) {
      console.log(error);
      showErrorToast("Failed to send gas-sponsored USDC transfer");
    }
  };
  const handleSendSponsoredUsdcApproveEvm = async () => {
 
    if (!isEvmWallet || !selectedWallet) {
      showErrorToast("Please select an Ethereum wallet");
      return;
    }
 
    try {
      const encodedData = encodeFunctionData({
        abi: ERC20_APPROVE_ABI,
        functionName: "approve",
        args:["0x574407ce49c1E7fC8C6bF00f2c5F761F2Bd2b9A9" as `0x${string}`,  BigInt(1_000_000)]
      });
      const payload = {
   caip2: 'eip155:84532',
   chain_type: 'ethereum',
   method: 'eth_sendTransaction',
   params: {
     transaction: {
       from: selectedWallet.address,
       to: BASE_SEPOLIA_USDC_ADDRESS,
       chain_id: '0x14a34',
       data: encodedData,
        value: '0x0'
     }
   },
   sponsor: true
 }
      const requestPayload = {
        version: 1,
        url: `https://auth.privy.io/api/v1/wallets/ubr9nard86yke2u9k169xdnm/rpc`,
        method: 'POST',
        headers: {
          'privy-app-id': 'cmjgzk05r00q5kz0c1vwhldnk'
        },
        body: payload
      }
      const { signature } = await generateAuthorizationSignature(requestPayload);
      console.log(signature);
      const newAccessToken = await getAccessToken();

    //  const response = await axios.post("/api/pay-with-usdc", {
    //     signature: signature,
    //     accessToken: newAccessToken,
    //   });
    //   showSuccessToast(`Gas-sponsored USDC transfer sent`);
      // const transaction = await sendTransactionEvm(
        // {
          // to: BASE_SEPOLIA_USDC_ADDRESS,
          // data: encodedData,
          // value: BigInt(0),
          // chainId: SPONSORED_CHAIN_ID,
        // },
        // { address: selectedWallet.address, sponsor: true }
      // );
      // const result =
        // typeof transaction === "string"
          // ? transaction
          // : JSON.stringify(transaction);
      // showSuccessToast(`Gas-sponsored USDC transfer sent: ${result.slice(0, 20)}...`);
    } catch (error) {
      console.log(error);
      showErrorToast("Failed to send gas-sponsored USDC transfer");
    }
  };



  const handleSignTypedData = async () => {
    if (!isEvmWallet || !selectedWallet) {
      showErrorToast("Please select an Ethereum wallet");
      return;
    }
    try {
      const typedData = {
        domain: {
          name: "Example App",
          version: "1",
          chainId: 1,
          verifyingContract: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
        },
        types: {
          Person: [
            { name: "name", type: "string" },
            { name: "wallet", type: "address" },
          ],
          Mail: [
            { name: "from", type: "Person" },
            { name: "to", type: "Person" },
            { name: "contents", type: "string" },
          ],
        },
        primaryType: "Mail",
        message: {
          from: {
            name: "Cow",
            wallet: "0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826",
          },
          to: {
            name: "Bob",
            wallet: "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB",
          },
          contents: "Hello, Bob!",
        },
      };

      const { signature } = await signTypedData(typedData, {
        address: selectedWallet?.address,
      });
      showSuccessToast(`Typed Data signed: ${signature.slice(0, 10)}...`);
    } catch (error) {
      console.log(error);
      showErrorToast("Failed to sign typed data");
    }
  };

  const handleSignRawHash = async () => {
    if (!isEvmWallet || !selectedWallet) {
      showErrorToast("Please select an Ethereum wallet");
      return;
    }
    try {
      // Find an embedded wallet that supports getProvider
      const embeddedWallet = walletsEvm.find(
        (wallet) =>
          wallet.walletClientType === "privy" &&
          wallet.address === selectedWallet.address
      );

      if (!embeddedWallet) {
        showErrorToast(
          "Selected wallet must be an embedded Privy wallet for raw hash signing"
        );
        return;
      }

      // Type assertion for embedded wallet provider access
      const provider = await (embeddedWallet as any).getProvider();
      const rawHash =
        "0x6503b027a625549f7be691646404f275f149d17a119a6804b855bac3030037aa";

      const signature = await provider.request({
        method: "secp256k1_sign",
        params: [rawHash],
      });

      showSuccessToast(`Raw Hash signed: ${signature.slice(0, 10)}...`);
    } catch (error) {
      console.log(error);
      showErrorToast("Failed to sign raw hash");
    }
  };

  const availableActions = [
    {
      name: "Sign message (EVM)",
      function: handleSignMessageEvm,
      disabled: !isEvmWallet,
    },

    {
      name: "Sign typed data (EVM)",
      function: handleSignTypedData,
      disabled: !isEvmWallet,
    },
    {
      name: "Sign raw hash (EVM)",
      function: handleSignRawHash,
      disabled: !isEvmWallet,
    },
    {
      name: "Sign transaction (EVM)",
      function: handleSignTransactionEvm,
      disabled: !isEvmWallet,
    },
  
    {
      name: "Send transaction (EVM)",
      function: handleSendTransactionEvm,
      disabled: !isEvmWallet,
    },
    {
      name: "Send transaction (EVM) — Gas sponsored",
      function: handleSendSponsoredTransactionEvm,
      disabled: !isEvmWallet,
    },
    {
      name: "Send 1 USDC (Base Sepolia, gas sponsored)",
      function: handleSendSponsoredUsdcEvm,
      disabled: !isEvmWallet,
    },
    {
      name: "Approve 1 USDC (Base Sepolia, gas sponsored)",
      function: handleSendSponsoredUsdcApproveEvm,
      disabled: !isEvmWallet,
    },
  ];

  return (
    <Section
      name="Wallet actions"
      description={
        "Sign messages, typed data, raw hashes, and transactions, send transactions for both EVM and Solana wallets. Use \"Send transaction (EVM) — Gas sponsored\" to test gas sponsorship on Base Sepolia (requires gas sponsorship enabled for Base Sepolia in the Privy dashboard and \"Allow transactions from the client\" turned on)."
      }
      filepath="src/components/sections/wallet-actions"
      actions={availableActions}
    >
      <div className="mb-4">
        <label
          htmlFor="wallet-select"
          className="block text-sm font-medium mb-2"
        >
          Select wallet:
        </label>
        <div className="relative">
          <select
            id="wallet-select"
            value={selectedWallet?.address || ""}
            onChange={(e) => {
              const wallet = allWallets.find(
                (w) => w.address === e.target.value
              );
              setSelectedWallet(wallet || null);
            }}
            className="w-full pl-3 pr-8 py-2 border border-[#E2E3F0] rounded-md bg-white text-black focus:outline-none focus:ring-1 focus:ring-black appearance-none"
          >
            {allWallets.length === 0 ? (
              <option value="">No wallets available</option>
            ) : (
              <>
                <option value="">Select a wallet</option>
                {allWallets.map((wallet) => (
                  <option key={wallet.address} value={wallet.address}>
                    {wallet.address} [
                    {wallet.type === "ethereum" ? "ethereum" : "solana"}]
                  </option>
                ))}
              </>
            )}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
            <svg
              className="w-4 h-4 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
      </div>
      <div className="mb-4">
        <label
          htmlFor="usdc-recipient"
          className="block text-sm font-medium mb-2"
        >
          USDC recipient (for &quot;Send 1 USDC&quot;):
        </label>
        <input
          id="usdc-recipient"
          type="text"
          placeholder="0x..."
          value={usdcRecipient}
          onChange={(e) => setUsdcRecipient(e.target.value)}
          className="w-full pl-3 pr-3 py-2 border border-[#E2E3F0] rounded-md bg-white text-black focus:outline-none focus:ring-1 focus:ring-black font-mono text-sm"
        />
      </div>
    </Section>
  );
};

export default WalletActions;
