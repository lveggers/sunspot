"use client";

import Link from "next/link";
import Image from "next/image";
import { illustrations } from "./illustrations.js";
import { GoldenHourExample } from "./BrandTheatre.jsx";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  MapPin,
  Share2,
  Sun,
  Ticket,
  Wine,
} from "lucide-react";
import Modal from "./Modal.jsx";
import { api, clock, save, saved } from "./lib.js";
import { places } from "./places.js";
import { getDirectionsUrl } from "./spotSearch.js";

const money = (value) =>
  new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
    maximumFractionDigits: 2,
  }).format(value);
const publicOfferUrl = (id) =>
  `${window.location.origin}/?offer=${encodeURIComponent(id)}`;

export function GoldenHourArt({ kind = "sun", className = "" }) {
  const source =
    kind === "cocktail" || kind === "scene"
      ? illustrations["golden-hour-friends"]
      : kind === "beer"
        ? illustrations["tiny-sun-patch"]
        : illustrations["bench-sun"];
  return (
    <Image
      className={`golden-art ${className}`}
      src={source}
      alt=""
      placeholder="blur"
      width={1536}
      height={1024}
      sizes="(max-width: 760px) 92vw, 480px"
    />
  );
}

function PublicShare({ offer }) {
  const [status, setStatus] = useState("");
  const [fallback, setFallback] = useState(false);
  const url = publicOfferUrl(offer.id || offer.offerId);
  async function share() {
    const data = {
      title: `Golden hour · ${offer.placeName}`,
      text: `${offer.title} på ${offer.placeName}. Ska vi ses i solen?`,
      url,
    };
    if (navigator.share) {
      try {
        await navigator.share(data);
        setStatus("Delat.");
        return;
      } catch (error) {
        if (error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Länken till erbjudandet är kopierad.");
    } catch {
      setFallback(true);
      setStatus("Kopiera länken i fältet nedan.");
    }
  }
  return (
    <div className="golden-share">
      <button type="button" className="golden-text-button" onClick={share}>
        <Share2 size={16} />
        Dela erbjudandet med vänner
      </button>
      {status && <p role="status">{status}</p>}
      {fallback && (
        <label className="golden-copy-label">
          Länk till erbjudandet
          <input
            aria-label="Länk till erbjudandet"
            readOnly
            value={url}
            onFocus={(event) => event.target.select()}
          />
        </label>
      )}
    </div>
  );
}

function VoucherClock({ expiresAt, serverNow, children }) {
  const [anchor] = useState(() => performance.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const timer = setInterval(
      () => setElapsed(performance.now() - anchor),
      1000,
    );
    return () => clearInterval(timer);
  }, [anchor]);
  const remaining = Math.max(
    0,
    Date.parse(expiresAt) - Date.parse(serverNow) - elapsed,
  );
  const seconds = Math.ceil(remaining / 1000);
  const label = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return children({ remaining, label });
}

function VoucherCard({ voucher, serverNow }) {
  return (
    <VoucherClock
      key={`${voucher.id}:${serverNow}`}
      expiresAt={voucher.expiresAt}
      serverNow={serverNow}
    >
      {({ remaining, label }) => {
        const expired = remaining <= 0;
        const used = Boolean(voucher.redeemedAt);
        return (
          <div
            className={`golden-voucher ${expired || used ? "is-expired" : ""}`}
          >
            <div className="golden-voucher-heading">
              <Ticket size={22} />
              <span>DIN GOLDEN HOUR</span>
            </div>
            {voucher.demo && (
              <p className="golden-demo">
                LOKAL DEMOKUPONG · INGET VERKLIGT ERBJUDANDE
              </p>
            )}
            <GoldenHourArt kind={voucher.kind} />
            <h3>{voucher.title}</h3>
            <p>
              {voucher.placeName} · {money(voucher.priceDkk)}
            </p>
            <div
              className="golden-countdown"
              role="timer"
              aria-label="Tid kvar på kupongen"
            >
              {used ? "Inlöst" : expired ? "Tiden har gått ut" : label}
            </div>
            <p>
              {used
                ? "Personalen har redan löst in den här kupongen."
                : expired
                  ? "Kupongen har gått ut och kan inte användas igen."
                  : "Visa kupongen på mobilen för personalen. Gäller en gång, en timme från hämtning."}
            </p>
            <label className="golden-voucher-code">
              Kupongkod
              <input
                aria-label="Kupongkod"
                readOnly
                value={voucher.id}
                onFocus={(event) => event.target.select()}
              />
            </label>
            <small>
              Giltig till {clock(new Date(voucher.expiresAt))}. Servern
              kontrollerar giltigheten vid inlösen.
            </small>
            <PublicShare offer={{ ...voucher, id: voucher.offerId }} />
            <Link
              className="golden-text-button"
              href={`/voucher/${encodeURIComponent(voucher.id)}`}
            >
              <ArrowUpRight size={16} />
              Öppna kupongen på egen sida
            </Link>
          </div>
        );
      }}
    </VoucherClock>
  );
}

function OfferDetail({ id }) {
  const [data, setData] = useState(null);
  const [coupon, setCoupon] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let controller;
    const refresh = () => {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      api(`/golden-hour/offers/${encodeURIComponent(id)}`, {
        signal: request.signal,
      })
        .then((value) => {
          if (!request.signal.aborted) {
            setData(value);
            setError("");
          }
        })
        .catch((cause) => {
          if (!request.signal.aborted) setError(cause.message);
        });
      const voucherId = saved(`golden-voucher:${id}`);
      if (voucherId)
        api(`/golden-hour/vouchers/${encodeURIComponent(voucherId)}`, {
          signal: request.signal,
        })
          .then((value) => {
            if (!request.signal.aborted) setCoupon(value);
          })
          .catch(() => {
            /* The visitor can retry the original claim without extending it. */
          });
    };
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    refresh();
    const timer = setInterval(visible, 30000);
    document.addEventListener("visibilitychange", visible);
    return () => {
      controller?.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [id]);
  async function claim() {
    setBusy(true);
    setError("");
    try {
      const value = await api(
        `/golden-hour/offers/${encodeURIComponent(id)}/claim`,
        { method: "POST" },
      );
      setCoupon(value);
      if (!save(`golden-voucher:${id}`, value.voucher.id))
        setError(
          "Spara länken till kupongen: webbläsaren kunde inte lagra den lokalt.",
        );
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }
  if (coupon)
    return (
      <>
        <VoucherCard voucher={coupon.voucher} serverNow={coupon.serverNow} />
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </>
    );
  if (!data)
    return (
      <p role={error ? "alert" : "status"}>
        {error || "Hämtar din golden hour…"}
      </p>
    );
  const { offer, eligibilityReason } = data;
  const place = places.find((item) => item.id === offer.placeId);
  return (
    <div className="golden-offer-detail">
      <div className={`golden-offer-art ${offer.kind}`}>
        <GoldenHourArt kind={offer.kind} />
        <span className="golden-sticker">
          {offer.kind === "beer" ? "ÖL I SOLEN" : "COCKTAIL HOUR"}
        </span>
      </div>
      {offer.demo && (
        <p className="golden-demo">
          LOKALT DEMOERBJUDANDE · INGET VERKLIGT TILLBUD
        </p>
      )}
      <p className="golden-kicker">
        <MapPin size={14} />
        {offer.placeName}
      </p>
      <h3>{offer.title}</h3>
      <strong className="golden-price">{money(offer.priceDkk)}</strong>
      <p>{offer.description}</p>
      <p className="golden-availability" role="status">
        {offer.claimable
          ? `Aktivt nu · till ${clock(new Date(offer.activeUntil))}`
          : eligibilityReason || "Erbjudandet är inte tillgängligt just nu."}
      </p>
      <button
        type="button"
        className="golden-button"
        onClick={claim}
        disabled={!offer.claimable || busy}
      >
        <Ticket size={18} />
        {busy ? "Hämtar kupong…" : "Hämta min kupong · 1 timme"}
        <ArrowUpRight size={18} />
      </button>
      <small className="golden-terms">
        En kupong per besökare och erbjudande. Tiden börjar vid hämtning och
        förlängs inte om du hämtar igen.
      </small>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {place && (
        <a
          className="golden-text-button"
          href={getDirectionsUrl(place)}
          target="_blank"
          rel="noreferrer"
        >
          <MapPin size={15} />
          Ta mig till {place.name}
        </a>
      )}
      <PublicShare offer={offer} />
    </div>
  );
}

export function GoldenHourDiscovery({ compact = false }) {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeId, setActiveId] = useState(() =>
    new URL(window.location.href).searchParams.get("offer"),
  );
  const [open, setOpen] = useState(Boolean(activeId));
  useEffect(() => {
    let controller;
    const refresh = () => {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      api("/golden-hour/offers", { signal: request.signal })
        .then((data) => {
          if (!request.signal.aborted) {
            setOffers(data.offers);
            setError("");
          }
        })
        .catch((cause) => {
          if (!request.signal.aborted) {
            setOffers([]);
            setError(cause.message);
          }
        })
        .finally(() => {
          if (!request.signal.aborted) setLoading(false);
        });
    };
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    refresh();
    const timer = setInterval(visible, 60000);
    document.addEventListener("visibilitychange", visible);
    return () => {
      controller?.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  function close() {
    setOpen(false);
    setActiveId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("offer");
    window.history.replaceState(null, "", url);
  }
  return (
    <section
      className={`golden-discovery ${compact ? "is-compact" : ""}`}
      aria-label="Golden hour erbjudanden"
    >
      <button
        type="button"
        className="golden-discovery-button"
        onClick={() => setOpen(true)}
      >
        <span className="golden-discovery-icon">
          <Wine size={25} />
        </span>
        <span>
          <strong>Golden hour, någon?</strong>
          <small>
            {loading
              ? "Letar efter soliga erbjudanden…"
              : error
                ? "Erbjudanden kunde inte hämtas"
                : offers.length
                  ? `${offers.length} soliga erbjudanden just nu`
                  : "Inga aktiva erbjudanden just nu"}
          </small>
        </span>
        <ArrowUpRight size={21} />
      </button>
      {open && (
        <Modal
          title={activeId ? "Din golden hour" : "Golden hour just nu"}
          onClose={close}
          className="golden-modal"
        >
          {activeId ? (
            <>
              <button
                type="button"
                className="golden-text-button"
                onClick={() => setActiveId(null)}
              >
                <ArrowLeft size={15} />
                Alla erbjudanden
              </button>
              <OfferDetail key={activeId} id={activeId} />
            </>
          ) : (
            <>
              <div className="golden-list-intro">
                <GoldenHourArt />
                <div>
                  <p className="golden-kicker">MER SOL. MER SKÅL.</p>
                  <h3>
                    En god anledning
                    <br />
                    att gå ut.
                  </h3>
                </div>
              </div>
              <p className="golden-list-copy">
                Tillfälliga erbjudanden från platser med sol och öppet just nu.
                Hämta en kupong, gå dit och visa den för personalen.
              </p>
              {loading ? (
                <p role="status">Hämtar erbjudanden…</p>
              ) : error ? (
                <p role="alert">{error}</p>
              ) : !offers.length ? (
                <div className="golden-empty">
                  <Sun size={25} />
                  <h3>Vi väntar på nästa golden hour.</h3>
                  <p>
                    Erbjudanden syns när en partner har aktiverat dem och
                    platsen är öppen, med sol och en aktuell väderprognos.
                  </p>
                </div>
              ) : (
                <div className="golden-offer-list">
                  {offers.map((offer) => (
                    <button
                      type="button"
                      key={offer.id}
                      className={`golden-offer-card ${offer.kind}`}
                      onClick={() => setActiveId(offer.id)}
                    >
                      <GoldenHourArt kind={offer.kind} />
                      <span>
                        <small>
                          {offer.placeName}
                          {offer.demo ? " · lokal demo" : ""}
                        </small>
                        <strong>{offer.title}</strong>
                        <b>{money(offer.priceDkk)}</b>
                      </span>
                      <ArrowUpRight size={19} />
                    </button>
                  ))}
                </div>
              )}
              <details className="prototype-offer-example">
                <summary>Se et tydeligt demoeksempel</summary>
                <GoldenHourExample />
              </details>
              <Link href="/partner" className="golden-text-button">
                Har du en plats i solen? Partnerportal
                <ArrowUpRight size={15} />
              </Link>
            </>
          )}
        </Modal>
      )}
    </section>
  );
}

export function GoldenVoucherPage({ id }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let controller;
    const refresh = () => {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      api(`/golden-hour/vouchers/${encodeURIComponent(id)}`, {
        signal: request.signal,
      })
        .then((value) => {
          if (!request.signal.aborted) {
            setData(value);
            setError("");
          }
        })
        .catch((cause) => {
          if (!request.signal.aborted) {
            setData(null);
            setError(cause.message);
          }
        });
    };
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    refresh();
    const timer = setInterval(visible, 30000);
    document.addEventListener("visibilitychange", visible);
    return () => {
      controller?.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [id]);
  return (
    <main className="golden-standalone">
      <Link className="brand" href="/">
        <span className="brand-icon">
          <Sun size={25} />
        </span>
        SunSpot
      </Link>
      <div className="golden-standalone-card">
        {data ? (
          <VoucherCard voucher={data.voucher} serverNow={data.serverNow} />
        ) : (
          <p role={error ? "alert" : "status"}>{error || "Hämtar kupongen…"}</p>
        )}
      </div>
      <Link className="golden-text-button" href="/">
        <ArrowLeft size={16} />
        Tillbaka till solen
      </Link>
    </main>
  );
}

export function PartnerPortal() {
  const [dashboard, setDashboard] = useState(null);
  const [status, setStatus] = useState("loading");
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState("beer");
  const [price, setPrice] = useState("");
  const [redeemId, setRedeemId] = useState("");
  const action = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    api("/partner/dashboard", { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          setDashboard(data);
          setStatus("authenticated");
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setDashboard(null);
          setStatus("anonymous");
          if (!cause.message.includes("Logga in")) setError(cause.message);
        }
      });
    return () => controller.abort();
  }, [revision]);
  useEffect(() => {
    if (status !== "authenticated") return;
    const refresh = () => {
      if (document.visibilityState === "visible")
        setRevision((value) => value + 1);
    };
    const timer = setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [status]);
  useEffect(
    () => () => {
      action.current += 1;
    },
    [],
  );
  async function mutate(path, body, success) {
    const request = ++action.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(path, {
        method: "POST",
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (request !== action.current) return;
      setNotice(success);
      setRevision((value) => value + 1);
      return true;
    } catch (cause) {
      if (request === action.current) setError(cause.message);
      return false;
    } finally {
      if (request === action.current) setBusy(false);
    }
  }
  async function login(event) {
    event.preventDefault();
    await mutate("/partner/login", { email, password }, "Inloggad.");
    setPassword("");
  }
  async function logout() {
    if (await mutate("/partner/logout", null, "Utloggad.")) {
      setDashboard(null);
      setStatus("anonymous");
    }
  }
  async function create(event) {
    event.preventDefault();
    if (
      await mutate(
        "/partner/offers",
        { title, description, kind, priceDkk: Number(price) },
        "Utkastet är sparat. Det är inte publikt ännu.",
      )
    ) {
      setTitle("");
      setDescription("");
      setPrice("");
    }
  }
  async function redeem(event) {
    event.preventDefault();
    if (
      await mutate(
        `/partner/vouchers/${encodeURIComponent(redeemId.trim())}/redeem`,
        null,
        "Kupongen är inlöst.",
      )
    )
      setRedeemId("");
  }
  return (
    <main className="partner-page">
      <header className="partner-header">
        <Link className="brand" href="/">
          <span className="brand-icon">
            <Sun size={26} />
          </span>
          SunSpot
        </Link>
        <span className="golden-kicker">PARTNERPORTAL</span>
        <Link href="/" className="golden-text-button">
          <ArrowLeft size={16} />
          Till kartan
        </Link>
      </header>
      <section className="partner-intro">
        <div>
          <p className="golden-kicker">YOUR PLACE. THEIR GOLDEN HOUR.</p>
          <h1>
            Har du sol?
            <br />
            <em>Skåla med oss.</em>
          </h1>
          <p>
            Skapa ett erbjudande för din plats. Aktivera det när det är öppet
            och solen faktiskt är framme.
          </p>
        </div>
        <GoldenHourArt kind="scene" />
      </section>
      {error && (
        <p className="partner-message error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="partner-message" role="status">
          {notice}
        </p>
      )}
      {status === "loading" ? (
        <p role="status">Hämtar partnerportalen…</p>
      ) : !dashboard ? (
        <section className="partner-login paper-card">
          <h2>Välkommen tillbaka.</h2>
          <p>Logga in till din plats och dina erbjudanden.</p>
          <form onSubmit={login}>
            <label htmlFor="partner-email">E-post</label>
            <input
              id="partner-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <label htmlFor="partner-password">Lösenord</label>
            <input
              id="partner-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button className="golden-button" disabled={busy}>
              Logga in
              <ArrowUpRight size={19} />
            </button>
          </form>
          <div className="golden-demo-panel">
            <strong>Lokal demo</strong>
            <p>
              Demo fungerar bara i lokal utveckling. Kontot är bundet till Café
              Stefanshus. Alla demoutkast, erbjudanden och kuponger märks som
              demo.
            </p>
            <button
              type="button"
              className="golden-text-button"
              onClick={() => {
                setEmail("demo@sunspot.local");
                setPassword("sunspot-local-demo");
              }}
            >
              Fyll i lokal demoinloggning
              <ArrowUpRight size={14} />
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="partner-place paper-card">
            <div>
              <p className="golden-kicker">DIN PLATS</p>
              <h2>{dashboard.partner.placeName}</h2>
              <p>
                {dashboard.partner.email}
                {dashboard.partner.demo ? " · lokalt demokonto" : ""}
              </p>
            </div>
            <button
              className="golden-text-button"
              disabled={busy}
              onClick={logout}
            >
              Logga ut
            </button>
          </section>
          {dashboard.partner.demo && (
            <p className="golden-demo partner-demo-banner">
              LOKAL DEMO · ERBJUDANDEN OCH KUPONGER ÄR INTE VERKLIGA
            </p>
          )}
          <div className="partner-grid">
            <section className="paper-card partner-create">
              <h2>Duka för golden hour.</h2>
              <p>
                Ett nytt erbjudande börjar som utkast och hör alltid till{" "}
                {dashboard.partner.placeName}.
              </p>
              <form onSubmit={create}>
                <label htmlFor="offer-title">Rubrik</label>
                <input
                  id="offer-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={80}
                  required
                  placeholder="Till exempel: En öl i solen"
                />
                <label htmlFor="offer-description">
                  Beskrivning och villkor
                </label>
                <textarea
                  id="offer-description"
                  required
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={300}
                  rows={3}
                  placeholder="Vad ingår?"
                />
                <div className="partner-field-row">
                  <label>
                    Dryck
                    <select
                      aria-label="Dryck"
                      value={kind}
                      onChange={(event) => setKind(event.target.value)}
                    >
                      <option value="beer">Öl</option>
                      <option value="cocktail">Cocktail</option>
                    </select>
                  </label>
                  <label>
                    Pris i DKK
                    <input
                      aria-label="Pris i DKK"
                      type="number"
                      min="0.01"
                      max="1000"
                      step="0.01"
                      value={price}
                      onChange={(event) => setPrice(event.target.value)}
                      required
                    />
                  </label>
                </div>
                <button className="golden-button" disabled={busy}>
                  Spara utkast
                  <ArrowUpRight size={18} />
                </button>
              </form>
            </section>
            <section className="paper-card partner-offers">
              <div className="partner-section-heading">
                <h2>Dina erbjudanden</h2>
                <GoldenHourArt kind="cocktail" />
              </div>
              <p className="partner-eligibility" role="status">
                {dashboard.eligibility.allowed
                  ? `Platsen kan aktivera golden hour nu · ${Math.floor(dashboard.eligibility.until)} min beräknad sol.`
                  : dashboard.eligibility.reason ||
                    "Ingen bekräftad sol just nu."}
              </p>
              <p className="golden-terms">
                Ett aktiverat erbjudande är aktivt i en timme. Varje hämtad
                kupong gäller en timme från hämtning. Servern kontrollerar
                alltid sol, väder och öppettid.
              </p>
              <div className="partner-offer-list">
                {dashboard.offers.map((offer) => (
                  <article key={offer.id} className="partner-offer">
                    <span className="golden-state">
                      {offer.state === "draft"
                        ? "UTKAST"
                        : offer.state === "active"
                          ? "AKTIVT"
                          : "AVSLUTAT"}
                      {offer.demo ? " · DEMO" : ""}
                    </span>
                    <h3>{offer.title}</h3>
                    <p>
                      {offer.kind === "beer" ? "Öl" : "Cocktail"} ·{" "}
                      {money(offer.priceDkk)}
                    </p>
                    {offer.state === "draft" ? (
                      <button
                        type="button"
                        className="golden-text-button"
                        disabled={busy || !dashboard.eligibility.allowed}
                        onClick={() =>
                          mutate(
                            `/partner/offers/${encodeURIComponent(offer.id)}/activate`,
                            null,
                            "Erbjudandet är aktiverat i en timme.",
                          )
                        }
                      >
                        <Sun size={16} />
                        Aktivera golden hour
                      </button>
                    ) : (
                      <>
                        <p className="golden-terms">
                          {offer.state === "active"
                            ? `Aktivt till ${clock(new Date(offer.activeUntil))}`
                            : "Skapa ett nytt utkast för nästa golden hour."}
                        </p>
                        <PublicShare offer={offer} />
                      </>
                    )}
                  </article>
                ))}
              </div>
            </section>
          </div>
          <section className="paper-card partner-vouchers">
            <h2>Lös in en kupong.</h2>
            <p>
              Kontrollera gästens kupongkod. En kod kan lösas in en gång och
              bara på din plats.
            </p>
            <form onSubmit={redeem} className="partner-redeem">
              <label htmlFor="redeem-id" className="sr-only">
                Kupongkod att lösa in
              </label>
              <input
                id="redeem-id"
                value={redeemId}
                onChange={(event) => setRedeemId(event.target.value)}
                placeholder="Klistra in kupongkoden"
                required
              />
              <button className="golden-button" disabled={busy}>
                <Check size={17} />
                Lös in
              </button>
            </form>
            <div className="partner-voucher-list">
              {dashboard.vouchers.map((voucher) => {
                const expired =
                  Date.parse(voucher.expiresAt) <=
                  Date.parse(dashboard.serverNow);
                return (
                  <div key={voucher.id}>
                    <span>
                      <strong>{voucher.title}</strong>
                      <small>
                        {voucher.redeemedAt
                          ? "Inlöst"
                          : expired
                            ? "Utgången"
                            : `Giltig till ${clock(new Date(voucher.expiresAt))}`}
                        {voucher.demo ? " · demo" : ""}
                      </small>
                      <code>{voucher.id}</code>
                    </span>
                    <button
                      type="button"
                      className="golden-text-button"
                      disabled={busy || Boolean(voucher.redeemedAt) || expired}
                      onClick={() =>
                        mutate(
                          `/partner/vouchers/${encodeURIComponent(voucher.id)}/redeem`,
                          null,
                          "Kupongen är inlöst.",
                        )
                      }
                    >
                      Lös in
                      <Check size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
