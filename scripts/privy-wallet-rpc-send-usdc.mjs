/**
 * Script: get authorization key via JWT (authenticate) and send a signed
 * wallet RPC request (e.g. gas-sponsored USDC transfer on Base Sepolia).
 *
 * Requires: PRIVY_APP_ID, PRIVY_APP_SECRET, USER_JWT (Privy access token).
 * See: https://docs.privy.io/api-reference/wallets/authenticate
 *
 * Run from repo root: node scripts/privy-wallet-rpc-send-usdc.mjs
 */

import crypto from "crypto";
import canonicalize from "canonicalize";
import { encodeFunctionData, parseAbi } from "viem";

const PRIVY_APP_ID = process.env.PRIVY_APP_ID ?? "cmjgzk05r00q5kz0c1vwhldnk";
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;
const USER_JWT = process.env.USER_JWT;

const WALLET_ID = "y4i3sya7z3mrv42sr23bptwi";
const RPC_BASE = "https://auth.privy.io";
const AUTHENTICATE_URL = "https://api.privy.io/v1/wallets/authenticate";

const erc20Abi = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
]);

async function getAuthorizationKey(userJwt, appId, appSecret) {
  const basicAuth = Buffer.from(`${appId}:${appSecret}`).toString("base64");
  const res = await fetch(AUTHENTICATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "privy-app-id": appId,
      Authorization: `Basic ${basicAuth}`,
    },
    body: JSON.stringify({ user_jwt: userJwt }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Authenticate failed ${res.status}: ${text}`);
  }
  const data = await res.json();
  if (!data.authorization_key) {
    throw new Error(
      "Response missing authorization_key. If you requested encryption, decrypt encrypted_authorization_key first."
    );
  }
  return {
    authorizationKey: data.authorization_key,
    expiresAt: data.expires_at,
    wallets: data.wallets,
  };
}

function privateKeyToPem(authorizationKey) {
  const raw = authorizationKey.replace(/^wallet-auth:/, "").trim();
  return `-----BEGIN PRIVATE KEY-----\n${raw}\n-----END PRIVATE KEY-----`;
}

function getAuthorizationSignature({ url, body, privyAppId, privateKeyPem }) {
  const payload = {
    version: 1,
    method: "POST",
    url,
    body,
    headers: { "privy-app-id": privyAppId },
  };
  const serialized = canonicalize(payload);
  if (!serialized) throw new Error("Canonicalize failed");
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const signature = crypto.sign(
    "sha256",
    Buffer.from(serialized, "utf8"),
    privateKey
  );
  return signature.toString("base64");
}

async function main() {
  if (!PRIVY_APP_SECRET || !USER_JWT) {
    console.error(
      "Set PRIVY_APP_SECRET and USER_JWT (Privy access token). Optionally PRIVY_APP_ID.\n" +
        "  USER_JWT=... PRIVY_APP_SECRET=... node scripts/privy-wallet-rpc-send-usdc.mjs\n" +
        "See https://docs.privy.io/api-reference/wallets/authenticate"
    );
    process.exit(1);
  }

  console.log("1. Getting authorization key via POST .../v1/wallets/authenticate");
  const { authorizationKey, wallets } = await getAuthorizationKey(
    USER_JWT,
    PRIVY_APP_ID,
    PRIVY_APP_SECRET
  );
  console.log("   Wallets:", wallets?.length ?? 0);

  const privateKeyPem = privateKeyToPem(authorizationKey);

  const recipient = "0xFE7EB87dddD8300F0bc52f23bEf41684123E313F";
  const encodedData = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [recipient, 50_000n],
  });

  const payload = {
    chain_type: "ethereum",
    method: "eth_sendTransaction",
    caip2: "eip155:84532",
    sponsor: true,
    params: {
      transaction: {
        from: "0xdf7C63ea1b2224594da1289840bbf2Fc5Be3f135",
        to: "0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f",
        chain_id: "0x14a34",
        data: encodedData,
        value: "0x0",
      },
    },
  };

  const url = `${RPC_BASE}/api/v1/wallets/${WALLET_ID}/rpc`;
  const signature = getAuthorizationSignature({
    url,
    body: payload,
    privyAppId: PRIVY_APP_ID,
    privateKeyPem,
  });

  console.log("2. Sending RPC with privy-authorization-signature");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "privy-app-id": PRIVY_APP_ID,
      "privy-authorization-signature": signature,
      Authorization: `Bearer ${USER_JWT}`,
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("RPC failed", response.status, result);
    process.exit(1);
  }
  console.log("3. RPC response:", JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
