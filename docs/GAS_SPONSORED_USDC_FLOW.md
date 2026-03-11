# Step-by-step: Gas-sponsored USDC transfer (Base Sepolia)

This document traces the flow from the UI button click through the Privy sign modal to the API call to `https://auth.privy.io/api/v1/wallets/<wallet_id>/rpc`.

---

## 1. User clicks “Send 1 USDC (Base Sepolia, gas sponsored)”

**Your code**

- **File:** `src/components/sections/wallet-actions.tsx`
- **Lines:** ~385–388 (action list), which calls `handleSendSponsoredUsdcEvm`.

The button is defined in the `availableActions` array and is wired to `handleSendSponsoredUsdcEvm`.

---

## 2. Validation and transaction payload (your app)

**File:** `src/components/sections/wallet-actions.tsx`  
**Lines:** 178–215 (`handleSendSponsoredUsdcEvm`)

- **178–187:** Check that an EVM wallet is selected and that `usdcRecipient` is a valid `0x` address.
- **190–195:** Encode the ERC20 `transfer(recipient, 1_000_000)` call using viem:
  - `encodeFunctionData({ abi: erc20TransferAbi, functionName: "transfer", args: [recipient, BigInt(1_000_000)] })`
- **196–204:** Call Privy’s `sendTransactionEvm` with:
  - **to:** `BASE_SEPOLIA_USDC_ADDRESS` (`0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f`)
  - **data:** `encodedData` (the USDC `transfer` calldata)
  - **value:** `BigInt(0)`
  - **chainId:** `SPONSORED_CHAIN_ID` (84532, Base Sepolia)
  - **options:** `{ address: selectedWallet.address, sponsor: true }`

So the **first step** in code is: build the USDC transfer tx and call the Privy hook with `sponsor: true` and the right `chainId` and `address`.

---

## 3. Privy SDK: `useSendTransaction` and the sign/send flow

**Your code**

- **File:** `src/components/sections/wallet-actions.tsx`
- **Line:** 49 — `const { sendTransaction: sendTransactionEvm } = useSendTransactionEvm();`

`sendTransactionEvm` comes from Privy’s `useSendTransaction` (imported as `useSendTransactionEvm` at line 6). When you call:

```ts
sendTransactionEvm(
  { to, data, value, chainId },
  { address: selectedWallet.address, sponsor: true }
);
```

the SDK:

1. Resolves the wallet for the given `address`.
2. Opens the **Privy modal** (Send Transaction screen) with the transaction details and your `sponsor` option.
3. When the user approves, it signs and sends the transaction (for embedded wallets this goes through Privy’s backend with `sponsor: true`).

**Privy SDK (conceptual)**

- **Hook:** `@privy-io/react-auth` → `useSendTransaction`
- **Modal:** `SendTransactionScreen` (e.g. in `node_modules/@privy-io/react-auth/dist/esm/index-BH9-XZRZ.mjs`) shows:
  - Network, from/to, value/data summary, “Gas sponsored” if applicable.
  - “Approve” / “Continue” (and optional “Add funds” if funding is enabled).
- **On Approve:** the SDK calls its internal “confirm send” path with the same transaction request and options (including `sponsor: true`).

So the **second step** is: your single call to `sendTransactionEvm(..., { sponsor: true })` triggers the modal and, on confirm, the backend send with sponsorship.

---

## 4. UI: User sees the modal and approves

**Privy SDK**

- **File:** `node_modules/@privy-io/react-auth/dist/esm/index-BH9-XZRZ.mjs`  
  (SendTransactionScreen / Send Transaction modal)

Flow:

1. Modal opens with the decoded transaction (e.g. “Send 1 USDC” to recipient).
2. If sponsorship is enabled, the UI can show that gas is sponsored.
3. User clicks “Approve” (or equivalent).
4. The screen calls `l.sendTransaction.onConfirm({ transactionRequest: ... })`, which runs the SDK’s internal send path (with the same tx and options, including `sponsor: true`).

So the **third step** is: the UI you see is Privy’s; approving there triggers the same transaction and options you passed in step 2.

---

## 5. Embedded wallet provider and RPC handling

**Privy SDK**

- **File:** `node_modules/@privy-io/react-auth/dist/esm/index-BBRkihRn.mjs`  
  - Proxy provider class with `handleSendTransaction`: when the app (or modal) triggers a send, it ends up here with `eth_sendTransaction` and the tx params.
- **File:** `node_modules/@privy-io/js-sdk-core/dist/esm/embedded/EmbeddedWalletProvider.mjs`  
  - For `eth_sendTransaction` it uses `handleSendTransaction` → for **unified (TEE) embedded wallets** it goes through `handleIFrameRpc`, which eventually hits the Privy API. The request body includes the RPC method and params; when the client sent `sponsor: true`, that is included so the backend can sponsor gas.

So the **fourth step** is: the embedded wallet provider turns the approved transaction into an RPC request that the SDK sends to Privy’s backend, with sponsorship info when `sponsor: true` was passed.

---

## 6. API request: `POST /api/v1/wallets/<wallet_id>/rpc`

**Privy API**

- **Endpoint:** `https://auth.privy.io/api/v1/wallets/<wallet_id>/rpc`
- **Method:** `POST`
- **Route definition:** `node_modules/@privy-io/routes/dist/esm/wallet-api.mjs`  
  - `WalletRpc` → `{ path: "/api/v1/wallets/:wallet_id/rpc", method: "POST" }`
- **Call site:** `node_modules/@privy-io/js-sdk-core/dist/esm/wallet-api/rpc.mjs`  
  - Builds the request with `wallet_id`, body (RPC method + params), and auth (e.g. `privy-app-id`, `privy-authorization-signature`).

**Typical body shape (conceptually):**

- **method:** `"eth_sendTransaction"` (or the internal equivalent used for send).
- **params:** the transaction (to, data, value, chainId, etc.).
- **sponsor:** `true` when you passed `sponsor: true` in step 2.

So the **fifth step** is: the SDK calls `POST .../wallets/<wallet_id>/rpc` with that body; the wallet ID is the Privy embedded wallet id (e.g. `y4i3sya7z3mrv42sr23bptwi` in your example).

---

## 7. Privy backend and Alchemy

**Privy (server-side, not in your repo)**

1. Receives the RPC request with `sponsor: true`.
2. Validates the wallet and your app’s gas sponsorship config (e.g. Base Sepolia, “allow from client”).
3. Uses the linked Alchemy (or other) paymaster/gas policy to sponsor gas.
4. Signs the transaction in a secure environment (e.g. TEE) and submits it to the chain (Base Sepolia).
5. Returns the transaction hash to the client.

So the **sixth step** is: Privy’s backend applies your sponsorship settings and broadcasts the tx; your app only sees the hash.

---

## 8. Your app: success handling

**Your code**

- **File:** `src/components/sections/wallet-actions.tsx`
- **Lines:** 205–209

After the SDK resolves (modal closes and the promise from `sendTransactionEvm` resolves):

- You read the result (transaction hash).
- You show: `showSuccessToast(\`Gas-sponsored USDC transfer sent: ${result.slice(0, 20)}...\`)`.

So the **last step** is: you display success using the hash returned from the same `sendTransactionEvm` call you started in step 2.

---

## Summary table

| Step | Where it happens | What happens |
|------|------------------|--------------|
| 1 | Your UI | User clicks “Send 1 USDC (Base Sepolia, gas sponsored)”. |
| 2 | `wallet-actions.tsx` L178–204 | You build the USDC `transfer` tx and call `sendTransactionEvm(..., { address, sponsor: true })`. |
| 3 | Privy `useSendTransaction` | SDK opens the Send Transaction modal with the same tx and options. |
| 4 | Privy SendTransactionScreen | User reviews and clicks Approve; SDK runs internal send with `sponsor: true`. |
| 5 | Embedded wallet provider | Request is turned into an RPC call to Privy backend (including sponsor). |
| 6 | Privy API | `POST https://auth.privy.io/api/v1/wallets/<wallet_id>/rpc` with `method`, `params`, `sponsor: true`. |
| 7 | Privy backend | Gas is sponsored (Alchemy), tx is signed and broadcast on Base Sepolia. |
| 8 | Your code L205–209 | You show a success toast with the returned tx hash. |

---

## Relevant constants in your app

- **File:** `src/components/sections/wallet-actions.tsx`
  - **L34–35:** `BASE_SEPOLIA_USDC_ADDRESS`
  - **L36–38:** `erc20TransferAbi` (transfer only)
  - **L147–148:** `SPONSORED_CHAIN_ID = 84532` (Base Sepolia)

The chain and contract address are fixed in your code; the recipient is the one you type in the “USDC recipient” field before clicking the button.

---

## What is `privy-authorization-signature`? (User signer, not wallet key)

The **`privy-authorization-signature`** header is produced when the **user is asked to sign** — but it is **not** signed with the wallet’s private key (the key that holds USDC and signs chain transactions).

- **What it is:** A signature over the **API request payload** (canonicalized: version, URL, method, headers, body), base64-encoded. The payload is hashed/signed so Privy can verify that this exact wallet RPC call was authorized.
- **What key signs it:** A **user signer** (user authorization key), not the embedded wallet’s spending key. For user-owned wallets, Privy uses a “user key” tied to the user’s session (obtained via the access token). The SDK calls `signWithUserSigner({ accessToken, message })`; the iframe/TEE returns the signature. So the user-facing “sign” step is this authorization signature.
- **Where it happens in code:**  
  - `generateAuthorizationSignature(signRequest, payload)` in `@privy-io/js-sdk-core` builds the canonical payload and calls `signRequest({ message })`.  
  - For unified embedded wallets, `signRequest` is `() => this._walletProxy.signWithUserSigner({ accessToken, message })` (see `EmbeddedWalletProvider.mjs`).  
  - The iframe handles the event `privy:user-signer:sign` and returns the signature, which is sent as `privy-authorization-signature`.
- **Wallet key vs user signer:** The **wallet private key** (the one that could sign the USDC transfer on-chain) stays in Privy’s secure environment (e.g. TEE). It is used by Privy’s backend to sign the actual transaction after the API validates the authorization signature. So: **user signs once** (authorization request → `privy-authorization-signature`); **Privy backend signs the chain tx** with the wallet key.

A typical value like `MEQCIEa284AqitA2dI/...` is a base64-encoded ECDSA signature (e.g. DER), from the user signer key, not from the Ethereum/secp256k1 wallet key.

---

## How to generate `privy-authorization-signature` yourself

Yes, it is **deterministic**: same request (same URL, method, headers, body) → same canonical payload → same message to sign → same signature. So the same USDC amount and recipient yields the same body and thus the same signature every time.

Exact steps (from Privy docs and SDK):

### 1. Build the signature payload (must match the real request)

For `POST /api/v1/wallets/:wallet_id/rpc` the payload you sign is:

```ts
const payload = {
  version: 1,
  method: "POST",
  url: "/api/v1/wallets/<wallet_id>/rpc",   // path only (SDK uses getCompiledPath → path, no host)
  headers: {
    "privy-app-id": "<your-privy-app-id>",
    // "privy-idempotency-key": "<key>"  // only if the request includes it
  },
  body: {
    // Exact body you will send in the POST (e.g. eth_sendTransaction + params + sponsor)
    caip2: "eip155:84532",
    sponsor: true,
    params: {
      transaction: { to: "0x...", data: "0x...", value: "0x0", chainId: 84532 },
      // ...
    },
  },
};
```

- **url** in the SDK is the **path only** (e.g. `/api/v1/wallets/y4i3sya7z3mrv42sr23bptwi/rpc`), from `getCompiledPath(WalletRpc, { params: { wallet_id } })`. Use the same path when generating the signature so it matches what the client sends.
- **body** must be the **exact** JSON body of the RPC request (same keys and values). Same body ⇒ same signature.

### 2. Canonicalize the payload (RFC 8785)

Canonicalize the JSON payload so the string is deterministic. Privy’s SDK uses the [canonicalize](https://github.com/erdtman/canonicalize) package (RFC 8785).

**Node (same as SDK):**

```ts
import canonicalize from "canonicalize";

const serializedPayload = canonicalize(payload); // string
if (!serializedPayload) throw new Error("Failed to canonicalize");
```

Use **one** of the following for what you sign, depending on context (see step 3).

### 3. Sign the payload

- **Privy “direct implementation” docs:** Sign the **canonical JSON string** (the result of step 2) with **ECDSA P-256 (SHA-256)** using the **user authorization key** (or your app’s authorization key if the wallet owner is an app key). Serialize the signature (e.g. DER) and **base64-encode** it → that is `privy-authorization-signature`.
- **SDK (user signer in browser):** The SDK does `message = Base64(canonicalize(payload))` and the iframe **user signer** signs that `message`. So the **signed message** in the client flow is the base64-encoded canonical string. The **signature** is still base64-encoded (e.g. DER).

So:

- **On your backend / direct implementation:** follow the [Privy signing docs](https://docs.privy.io/controls/authorization-keys/using-owners/sign/direct-implementation): sign the **canonical JSON string** with ECDSA P-256 SHA-256, then base64-encode the signature.
- **Same request → same signature:** Because the payload is fully determined by `version`, `method`, `url`, `headers`, and `body`, the same USDC transfer (same recipient, amount, chainId, sponsor, etc.) produces the same body and hence the same canonical string and the same signature.

### 4. Get the key to sign with (user owner)

For **user-owned** embedded wallets you must sign with the **user’s** authorization key, not an app key:

1. **Request a user key:**  
   `POST https://api.privy.io/v1/wallets/authenticate`  
   Body: `{ "user_jwt": "<user-access-token>" }`  
   (Optional: encryption with your ECDH P-256 public key; see [Request user key](https://docs.privy.io/controls/authorization-keys/keys/create/user/request).)

2. Response (without encryption) includes `authorization_key`. That key is used to sign the payload (step 3). It is time-bound and wallet-scoped.

3. **Sign** the canonical payload (or, in SDK flow, the base64 of it) with that key as in the [direct implementation](https://docs.privy.io/controls/authorization-keys/using-owners/sign/direct-implementation) (ECDSA P-256, SHA-256, then base64 signature).

### 5. Minimal Node example (direct implementation, sign canonical JSON)

```ts
import canonicalize from "canonicalize";
import crypto from "crypto";

function getAuthorizationSignature({
  url,
  body,
  privyAppId,
  privateKeyPem, // PEM of the user/auth key (after stripping "wallet-auth:" and wrapping in BEGIN/END PRIVATE KEY)
}: {
  url: string;
  body: object;
  privyAppId: string;
  privateKeyPem: string;
}) {
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
  const signature = crypto.sign("sha256", Buffer.from(serialized, "utf8"), privateKey);
  return signature.toString("base64");
}
```

Use the **same** `url` and `body` you will send in the actual `POST .../rpc` request. Then set the result as the `privy-authorization-signature` header.

### References

- [Authorization signatures (overview)](https://docs.privy.io/api-reference/authorization-signatures)
- [Sign requests (direct implementation)](https://docs.privy.io/controls/authorization-keys/using-owners/sign/direct-implementation) — payload shape, RFC 8785, ECDSA P-256, base64 signature
- [Request user key (REST)](https://docs.privy.io/controls/authorization-keys/keys/create/user/request) — get user’s authorization key from access token
- SDK: `node_modules/@privy-io/js-sdk-core/dist/esm/wallet-api/generate-authorization-signature.mjs` (canonicalize → then SDK uses base64 as message for user signer); `wallet-api/rpc.mjs` (builds payload with `version`, `url`, `method`, `headers`, `body`).

---

## Using the access token and `generateAuthorizationSignature`

### Can you generate the signature if you have the Privy access token?

- **In the browser (React app):** Yes. You don’t pass the access token into the signer. When the user is logged in, the session already has the access token and the **user signer** (authorization key) is available. Use the **`useAuthorizationSignature()`** hook and call **`generateAuthorizationSignature(payload)`** with the same payload shape (version, method, url, headers, body). The hook uses the current user’s authorization key to sign. So: have the user logged in (access token in session) → call the hook’s `generateAuthorizationSignature` with the request payload → you get the signature.

- **On the backend (only the access token):** The access token (JWT) **cannot sign** arbitrary messages. You use it to **obtain** the user’s authorization key (e.g. `POST .../v1/wallets/authenticate` with `user_jwt`), then you **sign yourself** (canonicalize + ECDSA P-256 + base64). So you generate the signature “using” the access token only in the sense: access token → get key → sign with key.

### Can it be generated using `generateAuthorizationSignature`?

- **Yes, in the client:** Use the React hook **`useAuthorizationSignature()`**. It returns `{ generateAuthorizationSignature }`. Call it with a single argument: the **payload** object (`GenerateAuthorizationSignatureInput`):

  - `version: 1`
  - `method: 'POST'` (or PUT/PATCH/DELETE)
  - `url`: path, e.g. `/api/v1/wallets/<wallet_id>/rpc`
  - `headers`: `{ 'privy-app-id': appId }` (and `'privy-idempotency-key'` if you use it)
  - `body`: the exact request body you will send

  The hook uses the **user’s authorization key** (no need to pass the access token). The user may be prompted to approve the sign if required by your app/Privy config.

- **No, on the backend:** The low-level `generateAuthorizationSignature(sign, payload)` in `@privy-io/js-sdk-core` expects a **signer function** `sign({ message })` that returns the signature. That signer is only provided in the browser (iframe/user signer). On the server you don’t call `generateAuthorizationSignature`; you get the key via the access token (authenticate), then implement the same steps (canonicalize → sign with that key → base64).

### Minimal client-side example (React)

```tsx
import { useAuthorizationSignature } from '@privy-io/react-auth';

// In your component (user must be logged in):
const { generateAuthorizationSignature } = useAuthorizationSignature();

// When you need the header for POST /api/v1/wallets/:wallet_id/rpc:
const payload = {
  version: 1 as const,
  method: 'POST' as const,
  url: `/api/v1/wallets/${walletId}/rpc`,
  headers: { 'privy-app-id': process.env.NEXT_PUBLIC_PRIVY_APP_ID! },
  body: { caip2: 'eip155:84532', sponsor: true, params: { transaction: { ... } } },
};
const { signature } = await generateAuthorizationSignature(payload);
// Use in request: headers['privy-authorization-signature'] = signature
```

You do **not** pass the access token into `generateAuthorizationSignature`; the hook is already bound to the authenticated user.
