"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import CryptoBackground from "./CryptoBackground";
import Splash from "./Splash";

const API =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:5000/api";

const SEPOLIA = "0xaa36a7";

type User = {
  id: number;
  name: string;
  mobile: string;
  wallet_address: string | null;
};

type Route = {
  id: string;
  name: string;
  fee: number;
  exchange_rate: number;
  estimated_minutes: number;
  receive_amount: number;
};

type Rec = {
  recommended_route_id: string;
  recommended_route: string;
  reason: string;
  score: number;
};

type Tx = {
  hash: string;
  block_number: number;
  status: string;
  from: string;
  to: string;
};

async function api<T>(
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(
    API + path,
    body === undefined
      ? undefined
      : {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
  );

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ??
        "Something went wrong. Try again."
    );
  }

  return data as T;
}

const money = (n: number) =>
  n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const msg = (e: unknown) => {
  const m =
    typeof e === "object" &&
    e !== null &&
    "message" in e
      ? String(
          (e as { message: unknown }).message
        )
      : "";

  if (m === "Failed to fetch") {
    return "Cannot reach the server. Is the backend running?";
  }

  return m || "Something went wrong.";
};

/* =====================================================
   ETH → WEI
===================================================== */

function ethToWei(value: string): bigint {
  const input = value.trim();

  if (!/^\d+(\.\d+)?$/.test(input)) {
    throw new Error("Invalid ETH amount.");
  }

  const [whole, decimal = ""] =
    input.split(".");

  if (decimal.length > 18) {
    throw new Error(
      "ETH amount cannot have more than 18 decimal places."
    );
  }

  const decimalPart =
    decimal.padEnd(18, "0");

  return (
    BigInt(whole) *
      BigInt("1000000000000000000") +
    BigInt(decimalPart || "0")
  );
}

export default function Home() {
  /* =====================================================
     BASIC STATE
  ===================================================== */

  const [ready, setReady] = useState(false);
  const [splash, setSplash] = useState(true);

  const [user, setUser] = useState<User | null>(null);

  /* LOGIN BACKGROUND */
  useEffect(() => {
    const b = document.body;
    if (ready && !user) {
      b.style.background =
        'linear-gradient(rgba(4,8,28,.25),rgba(4,8,28,.5)), url("/login-bg.png") center / cover no-repeat fixed, #070d24';
    } else {
      b.style.background = "";
    }
    return () => {
      b.style.background = "";
    };
  }, [ready, user]);

  /* =====================================================
     AUTH
  ===================================================== */

  const [mode, setMode] =
    useState<"login" | "register">(
      "login"
    );

  const [form, setForm] = useState({
    name: "",
    mobile: "",
    password: "",
  });

  const [authMsg, setAuthMsg] = useState({
    text: "",
    ok: false,
  });

  /* =====================================================
     ROUTES
  ===================================================== */

  const [amount, setAmount] =
    useState("");

  const [destination, setDestination] =
    useState("");

  const [routes, setRoutes] =
    useState<Route[]>([]);

  const [rec, setRec] =
    useState<Rec | null>(null);

  const [quoteErr, setQuoteErr] =
    useState("");

  /* =====================================================
     WALLET
  ===================================================== */

  const [wallet, setWallet] =
    useState("");

  const [to, setTo] =
    useState("");

  const [eth, setEth] =
    useState("");

  const [payMsg, setPayMsg] =
    useState("");

  /* =====================================================
     TRANSACTION
  ===================================================== */

  const [txHash, setTxHash] =
    useState("");

  const [tx, setTx] =
    useState<Tx | null>(null);

  const [txMsg, setTxMsg] =
    useState("");

  const [busy, setBusy] =
    useState("");

  /* =====================================================
     LOAD USER
  ===================================================== */

  useEffect(() => {
    try {
      const raw =
        localStorage.getItem(
          "remitai_user"
        );

      if (raw) {
        setUser(
          JSON.parse(raw) as User
        );
      }
    } catch {
      localStorage.removeItem(
        "remitai_user"
      );
    }

    setReady(true);
  }, []);

  /* =====================================================
     MOBILE NUMBER
  ===================================================== */

  function handleMobileChange(
    value: string
  ) {
    const digits =
      value.replace(/\D/g, "");

    setForm((previous) => ({
      ...previous,
      mobile: digits.slice(0, 10),
    }));
  }

  /* =====================================================
     LOGIN / REGISTER
  ===================================================== */

  async function submitAuth(
    e: FormEvent
  ) {
    e.preventDefault();

    setAuthMsg({
      text: "",
      ok: false,
    });

    if (!/^\d{10}$/.test(form.mobile)) {
      setAuthMsg({
        text:
          "Mobile number must contain exactly 10 digits.",
        ok: false,
      });

      return;
    }

    if (!form.password.trim()) {
      setAuthMsg({
        text:
          "Please enter your password.",
        ok: false,
      });

      return;
    }

    if (
      mode === "register" &&
      !form.name.trim()
    ) {
      setAuthMsg({
        text: "Please enter your name.",
        ok: false,
      });

      return;
    }

    setBusy("auth");

    try {
      if (mode === "register") {
        await api(
          "/auth/register",
          {
            name: form.name.trim(),
            mobile: form.mobile,
            password: form.password,
          }
        );

        setMode("login");

        setAuthMsg({
          text:
            "Account created successfully. Log in to continue.",
          ok: true,
        });

        setForm({
          name: "",
          mobile: form.mobile,
          password: "",
        });
      } else {
        const data =
          await api<{ user: User }>(
            "/auth/login",
            {
              mobile: form.mobile,
              password: form.password,
            }
          );

        localStorage.setItem(
          "remitai_user",
          JSON.stringify(data.user)
        );

        setUser(data.user);

        setForm((previous) => ({
          ...previous,
          password: "",
        }));
      }
    } catch (err) {
      setAuthMsg({
        text: msg(err),
        ok: false,
      });
    } finally {
      setBusy("");
    }
  }

  /* =====================================================
     LOGOUT
  ===================================================== */

  function logout() {
    localStorage.removeItem(
      "remitai_user"
    );

    setUser(null);

    setRoutes([]);
    setRec(null);

    setWallet("");

    setTxHash("");
    setTx(null);
    setTxMsg("");
  }

  /* =====================================================
     COMPARE ROUTES
  ===================================================== */

  async function compare(
    e: FormEvent
  ) {
    e.preventDefault();

    setBusy("compare");

    setQuoteErr("");
    setRoutes([]);
    setRec(null);

    const numericAmount =
      Number(amount);

    if (
      !Number.isFinite(
        numericAmount
      ) ||
      numericAmount <= 0
    ) {
      setQuoteErr(
        "Enter a valid amount."
      );

      setBusy("");

      return;
    }

    if (!destination.trim()) {
      setQuoteErr(
        "Enter a destination."
      );

      setBusy("");

      return;
    }

    try {
      const quote =
        await api<{
          routes: Route[];
        }>(
          "/remittance/compare",
          {
            amount: numericAmount,
            destination:
              destination.trim(),
          }
        );

      const recommendation =
        await api<Rec>(
          "/ai/recommend",
          {
            routes: quote.routes,
          }
        );

      setRoutes(
        quote.routes
      );

      setRec(
        recommendation
      );
    } catch (err) {
      setQuoteErr(
        msg(err)
      );
    } finally {
      setBusy("");
    }
  }

  /* =====================================================
     SWITCH TO SEPOLIA
  ===================================================== */

  async function switchToSepolia() {
    if (!window.ethereum) {
      throw new Error(
        "MetaMask is not installed."
      );
    }

    try {
      await window.ethereum.request({
        method:
          "wallet_switchEthereumChain",

        params: [
          {
            chainId: SEPOLIA,
          },
        ],
      });
    } catch (error: unknown) {
      const code =
        typeof error ===
          "object" &&
        error !== null &&
        "code" in error
          ? Number(
              (
                error as {
                  code: unknown;
                }
              ).code
            )
          : undefined;

      if (code === 4902) {
        await window.ethereum.request({
          method:
            "wallet_addEthereumChain",

          params: [
            {
              chainId: SEPOLIA,

              chainName:
                "Sepolia",

              nativeCurrency: {
                name:
                  "Sepolia Ether",

                symbol: "ETH",

                decimals: 18,
              },

              rpcUrls: [
                "https://rpc.sepolia.org",
              ],

              blockExplorerUrls: [
                "https://sepolia.etherscan.io",
              ],
            },
          ],
        });

        return;
      }

      throw error;
    }
  }

  /* =====================================================
     CONNECT METAMASK
  ===================================================== */

  async function connect() {
    setPayMsg("");

    if (!window.ethereum) {
      setPayMsg(
        "MetaMask not found. Install MetaMask to continue."
      );

      return;
    }

    try {
      const accounts =
        (await window.ethereum.request({
          method:
            "eth_requestAccounts",
        })) as string[];

      const account =
        accounts[0];

      if (!account) {
        throw new Error(
          "No MetaMask account selected."
        );
      }

      setWallet(account);

      await switchToSepolia();

      setPayMsg(
        "MetaMask connected successfully."
      );
    } catch (err) {
      console.error(
        "WALLET ERROR:",
        err
      );

      setPayMsg(
        msg(err)
      );
    }
  }

  /* =====================================================
     TRACK BLOCKCHAIN TRANSACTION
  ===================================================== */

  async function track(
    hash: string
  ) {
    const cleanHash =
      hash.trim();

    if (
      !/^0x[0-9a-fA-F]{64}$/.test(
        cleanHash
      )
    ) {
      setTxMsg(
        "Invalid transaction hash."
      );

      return;
    }

    setTx(null);

    setTxMsg(
      "Checking blockchain transaction..."
    );

    for (
      let i = 0;
      i < 15;
      i++
    ) {
      try {
        const transaction =
          await api<Tx>(
            "/blockchain/transaction/" +
              encodeURIComponent(
                cleanHash
              )
          );

        setTx(
          transaction
        );

        if (
          transaction.status ===
          "CONFIRMED"
        ) {
          setTxMsg(
            "Transaction confirmed successfully."
          );
        } else {
          setTxMsg(
            "Transaction found on blockchain."
          );
        }

        return;
      } catch (err) {
        const message =
          msg(err);

        console.log(
          `Transaction check ${i + 1}/15:`,
          message
        );

        if (
          message
            .toLowerCase()
            .includes("pending") ||
          message
            .toLowerCase()
            .includes("not found")
        ) {
          await sleep(4000);
          continue;
        }

        setTxMsg(
          message
        );

        return;
      }
    }

    setTxMsg(
      "Transaction is still pending. The hash is available above."
    );
  }

  /* =====================================================
     SEND TRANSACTION
     
     COMPLETE FLOW:

     Validate wallet
          ↓
     Validate recipient
          ↓
     Validate ETH
          ↓
     Switch to Sepolia
          ↓
     MetaMask
          ↓
     eth_sendTransaction
          ↓
     🔥 hash returned
          ↓
     setTxHash(hash)
          ↓
     POST /api/transfers/create
          ↓
     MySQL INSERT
          ↓
     track(hash)
  ===================================================== */

  async function send(
    e: FormEvent
  ) {
    e.preventDefault();

    setPayMsg("");
    setTxMsg("");
    setTx(null);

    /* =========================================
       1. VALIDATE WALLET
    ========================================= */

    if (!window.ethereum) {
      setPayMsg(
        "MetaMask not found."
      );

      return;
    }

    if (!wallet) {
      setPayMsg(
        "Connect your wallet first."
      );

      return;
    }

    /* =========================================
       2. VALIDATE RECIPIENT
    ========================================= */

    const cleanRecipient =
      to.trim();

    if (
      !/^0x[0-9a-fA-F]{40}$/.test(
        cleanRecipient
      )
    ) {
      setPayMsg(
        "Enter a valid recipient wallet address."
      );

      return;
    }

    /* =========================================
       3. VALIDATE ETH
    ========================================= */

    if (!eth.trim()) {
      setPayMsg(
        "Enter an ETH amount."
      );

      return;
    }

    let wei: bigint;

    try {
      wei =
        ethToWei(eth);
    } catch (err) {
      setPayMsg(
        msg(err)
      );

      return;
    }

    if (
      wei <= BigInt(0)
    ) {
      setPayMsg(
        "ETH amount must be greater than 0."
      );

      return;
    }

    /* =========================================
       REQUIRE ROUTE COMPARISON
    ========================================= */

    if (
      !user ||
      !rec ||
      routes.length === 0
    ) {
      setPayMsg(
        "Please compare routes first."
      );

      return;
    }

    /* =========================================
       FIND AI RECOMMENDED ROUTE
    ========================================= */

    const selectedRoute =
      routes.find(
        (route) =>
          route.id ===
          rec.recommended_route_id
      );

    if (!selectedRoute) {
      setPayMsg(
        "Recommended route not found."
      );

      return;
    }

    setBusy("send");

    try {
      /* =========================================
         4. SWITCH TO SEPOLIA
      ========================================= */

      await switchToSepolia();

      /* =========================================
         GET CURRENT METAMASK ACCOUNT
      ========================================= */

      const accounts =
        (await window.ethereum.request({
          method:
            "eth_accounts",
        })) as string[];

      const currentWallet =
        accounts[0];

      if (!currentWallet) {
        throw new Error(
          "No MetaMask account is connected."
        );
      }

      setWallet(
        currentWallet
      );

      console.log(
        "================================"
      );

      console.log(
        "🚀 SENDING TRANSACTION"
      );

      console.log(
        "User ID:",
        user.id
      );

      console.log(
        "Sender:",
        currentWallet
      );

      console.log(
        "Recipient:",
        cleanRecipient
      );

      console.log(
        "ETH:",
        eth
      );

      console.log(
        "Wei:",
        wei.toString()
      );

      console.log(
        "Selected route:",
        selectedRoute.name
      );

      console.log(
        "================================"
      );

      /* =========================================
         5. METAMASK → ETH_SENDTRANSACTION
      ========================================= */

      const hash =
        (await window.ethereum.request({
          method:
            "eth_sendTransaction",

          params: [
            {
              from:
                currentWallet,

              to:
                cleanRecipient,

              value:
                "0x" +
                wei.toString(16),
            },
          ],
        })) as string;

      /* =========================================
         6. HASH RETURNED
      ========================================= */

      console.log(
        "🔥 TRANSACTION HASH:",
        hash
      );

      /* =========================================
         7. SAVE HASH IN FRONTEND
      ========================================= */

      setTxHash(
        hash
      );

      setPayMsg(
        "Transaction submitted successfully."
      );

      setTxMsg(
        "Transaction hash received. Saving transfer to database..."
      );

      /* =========================================
         8. POST /api/transfers/create
         
         THIS IS THE IMPORTANT DATABASE STEP
      ========================================= */

      const saved =
        await api<{
          success: boolean;
          message: string;
          transfer_id: number;
          transaction_hash: string;
          status: string;
        }>(
          "/transfers/create",
          {
            user_id:
              user.id,

            sender_wallet:
              currentWallet,

            recipient_wallet:
              cleanRecipient,

            amount:
              Number(amount),

            destination:
              destination.trim(),

            selected_route:
              selectedRoute.name,

            fee:
              selectedRoute.fee,

            exchange_rate:
              selectedRoute.exchange_rate,

            estimated_minutes:
              selectedRoute.estimated_minutes,

            amount_received:
              selectedRoute.receive_amount,

            ai_reason:
              rec.reason || "",

            transaction_hash:
              hash,

            status:
              "PENDING",
          }
        );

      /* =========================================
         DATABASE SAVE SUCCESS
      ========================================= */

      console.log(
        "================================"
      );

      console.log(
        "✅ MYSQL TRANSFER SAVED"
      );

      console.log(
        "Transfer ID:",
        saved.transfer_id
      );

      console.log(
        "Transaction Hash:",
        saved.transaction_hash
      );

      console.log(
        "Status:",
        saved.status
      );

      console.log(
        "================================"
      );

      setPayMsg(
        "Transaction submitted and saved successfully."
      );

      setTxMsg(
        "Transaction saved in database. Waiting for blockchain confirmation..."
      );

      /* =========================================
         9. TRACK BLOCKCHAIN TRANSACTION
      ========================================= */

      await track(
        hash
      );

    } catch (err: unknown) {
      console.error(
        "❌ TRANSACTION ERROR:",
        err
      );

      const errorCode =
        typeof err ===
          "object" &&
        err !== null &&
        "code" in err
          ? Number(
              (
                err as {
                  code: unknown;
                }
              ).code
            )
          : undefined;

      if (
        errorCode === 4001
      ) {
        setPayMsg(
          "Transaction rejected in MetaMask."
        );
      } else {
        setPayMsg(
          msg(err)
        );
      }
    } finally {
      setBusy("");
    }
  }

  /* =====================================================
     LOOKUP TRANSACTION
  ===================================================== */

  async function lookup(
    e: FormEvent
  ) {
    e.preventDefault();

    const cleanHash =
      txHash.trim();

    if (
      !/^0x[0-9a-fA-F]{64}$/.test(
        cleanHash
      )
    ) {
      setTxMsg(
        "Enter a valid transaction hash starting with 0x."
      );

      return;
    }

    setBusy("tx");

    await track(
      cleanHash
    );

    setBusy("");
  }

  /* =====================================================
     LOADING
  ===================================================== */

  if (!ready) {
    return (
      <CryptoBackground />
    );
  }

  /* =====================================================
     UI
  ===================================================== */

  return (
    <>
      {user ? <CryptoBackground /> : <div className="auth-bg" aria-hidden="true" />}
      {splash && <Splash onDone={() => setSplash(false)} />}

      <header>
        <Image
          src="/remitai-4k.png"
          alt="RemitAI"
          width={140}
          height={44}
          style={{
            height: 44,
            width: "auto",
          }}
          priority
        />

        {user && (
          <button
            className="ghost"
            onClick={logout}
          >
            Log out
          </button>
        )}
      </header>

      <main className="wrap">

        {/* ==========================================
            LOGIN / REGISTER
        ========================================== */}

        {!user ? (
          <section className="panel auth">

            <h1>
              Welcome to RemitAI
            </h1>

            <p className="sub">
              Send money across borders
              on the cheapest, fastest
              route.
            </p>

            <div className="tabs">

              <button
                type="button"
                className={
                  mode === "login"
                    ? ""
                    : "ghost"
                }
                onClick={() => {
                  setMode("login");

                  setAuthMsg({
                    text: "",
                    ok: false,
                  });
                }}
              >
                Log in
              </button>

              <button
                type="button"
                className={
                  mode === "register"
                    ? ""
                    : "ghost"
                }
                onClick={() => {
                  setMode(
                    "register"
                  );

                  setAuthMsg({
                    text: "",
                    ok: false,
                  });
                }}
              >
                Create account
              </button>

            </div>

            <form
              onSubmit={
                submitAuth
              }
            >

              {mode ===
                "register" && (
                <>
                  <label htmlFor="name">
                    Name
                  </label>

                  <input
                    id="name"
                    type="text"
                    autoComplete="name"
                    required
                    value={
                      form.name
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        name:
                          e.target
                            .value,
                      })
                    }
                  />
                </>
              )}

              <label htmlFor="mobile">
                Mobile number
              </label>

              <input
                id="mobile"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="10 digit mobile number"
                maxLength={10}
                required
                value={
                  form.mobile
                }
                onChange={(e) =>
                  handleMobileChange(
                    e.target.value
                  )
                }
              />

              <small>
                Enter exactly 10
                digits.
              </small>

              <label htmlFor="password">
                Password
              </label>

              <input
                id="password"
                type="password"
                autoComplete={
                  mode ===
                  "login"
                    ? "current-password"
                    : "new-password"
                }
                required
                value={
                  form.password
                }
                onChange={(e) =>
                  setForm({
                    ...form,
                    password:
                      e.target
                        .value,
                  })
                }
              />

              <button
                className="full"
                disabled={
                  busy === "auth"
                }
              >
                {busy === "auth"
                  ? "Please wait..."
                  : mode ===
                    "login"
                  ? "Log in"
                  : "Create account"}
              </button>

              <div
                className={
                  "msg" +
                  (authMsg.ok
                    ? " ok"
                    : "")
                }
                role="alert"
              >
                {
                  authMsg.text
                }
              </div>

            </form>

          </section>
        ) : (

          <>
            {/* ==========================================
                ROUTE COMPARISON
            ========================================== */}

            <section className="panel">

              <h1>
                Hi {user.name},
                where are you
                sending money?
              </h1>

              <p className="sub">
                Enter an amount
                and destination
                to compare routes.
              </p>

              <form
                className="row"
                onSubmit={
                  compare
                }
              >

                <div>

                  <label htmlFor="amount">
                    Amount (USD)
                  </label>

                  <input
                    id="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={
                      amount
                    }
                    onChange={(e) =>
                      setAmount(
                        e.target
                          .value
                      )
                    }
                  />

                </div>

                <div>

                  <label htmlFor="dest">
                    Destination
                  </label>

                  <input
                    id="dest"
                    placeholder="India"
                    required
                    value={
                      destination
                    }
                    onChange={(e) =>
                      setDestination(
                        e.target
                          .value
                      )
                    }
                  />

                </div>

                <button
                  disabled={
                    busy ===
                    "compare"
                  }
                >
                  {busy ===
                  "compare"
                    ? "Comparing..."
                    : "Compare routes"}
                </button>

              </form>

              <div
                className="msg"
                role="alert"
              >
                {
                  quoteErr
                }
              </div>

            </section>

            {/* ==========================================
                ROUTES
            ========================================== */}

            {rec &&
              routes.length >
                0 && (
                <section className="panel">

                  <h2>
                    Available routes
                  </h2>

                  <div className="routes">

                    {routes.map(
                      (r) => (
                        <div
                          key={
                            r.id
                          }
                          className={
                            "route" +
                            (r.id ===
                            rec.recommended_route_id
                              ? " best"
                              : "")
                          }
                        >

                          <div>

                            <b>
                              {
                                r.name
                              }
                            </b>

                            {r.id ===
                              rec.recommended_route_id && (
                              <span className="badge">
                                AI recommended
                              </span>
                            )}

                            <small>
                              ≈{" "}
                              {
                                r.estimated_minutes
                              }{" "}
                              min
                            </small>

                          </div>

                          <div>
                            <b>
                              {
                                money(
                                  r.fee
                                )
                              }
                            </b>

                            <small>
                              Fee (USD)
                            </small>
                          </div>

                          <div>
                            <b>
                              {
                                r.exchange_rate
                              }
                            </b>

                            <small>
                              Rate
                            </small>
                          </div>

                          <div>
                            <b>
                              {
                                money(
                                  r.receive_amount
                                )
                              }
                            </b>

                            <small>
                              Recipient gets
                            </small>
                          </div>

                        </div>
                      )
                    )}

                  </div>

                  <p className="reason">
                    {
                      rec.reason
                    }
                  </p>

                </section>
              )}

            {/* ==========================================
                METAMASK / SEND
            ========================================== */}

            <section className="panel">

              <h2>
                Send on Sepolia
                testnet
              </h2>

              <p className="sub">

                {wallet
                  ? "Connected: " +
                    wallet.slice(
                      0,
                      6
                    ) +
                    "…" +
                    wallet.slice(
                      -4
                    )
                  : "Connect MetaMask to send test ETH."}

              </p>

              {!wallet && (
                <button
                  type="button"
                  onClick={
                    connect
                  }
                >
                  Connect wallet
                </button>
              )}

              {wallet && (
                <form
                  className="row"
                  onSubmit={
                    send
                  }
                >

                  <div>

                    <label htmlFor="to">
                      Recipient
                      address
                    </label>

                    <input
                      id="to"
                      placeholder="0x..."
                      value={
                        to
                      }
                      onChange={(
                        e
                      ) =>
                        setTo(
                          e.target
                            .value
                            .trim()
                        )
                      }
                    />

                  </div>

                  <div>

                    <label htmlFor="eth">
                      Amount
                      (ETH)
                    </label>

                    <input
                      id="eth"
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0.001"
                      value={
                        eth
                      }
                      onChange={(
                        e
                      ) =>
                        setEth(
                          e.target
                            .value
                        )
                      }
                    />

                  </div>

                  <button
                    disabled={
                      busy ===
                      "send"
                    }
                  >
                    {busy ===
                    "send"
                      ? "Sending..."
                      : "Send"}
                  </button>

                </form>
              )}

              <div
                className="msg"
                role="alert"
              >
                {
                  payMsg
                }
              </div>

            </section>

            {/* ==========================================
                TRANSACTION TRACKING
            ========================================== */}

            <section className="panel">

              <h2>
                Track a
                transaction
              </h2>

              <form
                className="row2"
                onSubmit={
                  lookup
                }
              >

                <div>

                  <label htmlFor="tx">
                    Transaction hash
                  </label>

                  <input
                    id="tx"
                    placeholder="0x..."
                    required
                    value={
                      txHash
                    }
                    onChange={(
                      e
                    ) =>
                      setTxHash(
                        e.target
                          .value
                      )
                    }
                  />

                </div>

                <button
                  disabled={
                    busy ===
                    "tx"
                  }
                >
                  {busy ===
                  "tx"
                    ? "Checking..."
                    : "Look up"}
                </button>

              </form>

              {/* HASH DISPLAY */}

              {txHash && (
                <div className="msg ok">

                  <strong>
                    Transaction Hash:
                  </strong>

                  <br />

                  <code
                    style={{
                      wordBreak:
                        "break-all",
                    }}
                  >
                    {
                      txHash
                    }
                  </code>

                  <br />

                  <a
                    href={
                      "https://sepolia.etherscan.io/tx/" +
                      txHash
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on Sepolia
                    Etherscan
                  </a>

                </div>
              )}

              <div
                className="msg"
                role="alert"
              >
                {
                  txMsg
                }
              </div>

              {/* TRANSACTION DETAILS */}

              {tx && (
                <dl>

                  <dt>
                    Status
                  </dt>

                  <dd
                    className={
                      tx.status ===
                      "CONFIRMED"
                        ? "ok"
                        : "fail"
                    }
                  >
                    {
                      tx.status
                    }
                  </dd>

                  <dt>
                    Block
                  </dt>

                  <dd>
                    {
                      tx.block_number
                    }
                  </dd>

                  <dt>
                    From
                  </dt>

                  <dd
                    style={{
                      wordBreak:
                        "break-all",
                    }}
                  >
                    {
                      tx.from
                    }
                  </dd>

                  <dt>
                    To
                  </dt>

                  <dd
                    style={{
                      wordBreak:
                        "break-all",
                    }}
                  >
                    {
                      tx.to
                    }
                  </dd>

                </dl>
              )}

            </section>

          </>
        )}

      </main>
    </>
  );
}


