"use client";

import Link from "next/link";
import { GoldenHourExample } from "./BrandTheatre.jsx";
import CharacterScene from "./CharacterScene.jsx";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  MapPin,
  Share2,
  Sun,
  Ticket,
} from "lucide-react";
import Modal from "./Modal.jsx";
import { api, clock, save, saved } from "./lib.js";
import { places } from "./places.js";
import { getDirectionsUrl } from "./spotSearch.js";
import { useLanguage, LanguageSwitcher } from "./Language.jsx";
import { messages } from "./i18n.js";
import {
  formatOfferPrice as money,
  selectOfferMoment,
  selectVoucherMoment,
} from "./offerExperience.js";
import "./offer-experience.css";

const publicOfferUrl = (id) =>
  `${window.location.origin}/?offer=${encodeURIComponent(id)}`;

function PublicShare({ offer }) {
  const { t } = useLanguage();
  const [status, setStatus] = useState("");
  const [fallback, setFallback] = useState(false);
  const url = publicOfferUrl(offer.id || offer.offerId);
  async function share() {
    const data = {
      title: t("flows.share.title", { place: offer.placeName }),
      text: t("flows.share.text", { title: offer.title, place: offer.placeName }),
      url,
    };
    if (navigator.share) {
      try {
        await navigator.share(data);
        setStatus("flows.share.shared");
        return;
      } catch (error) {
        if (error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setStatus("flows.share.copied");
    } catch {
      setFallback(true);
      setStatus("flows.share.copyManually");
    }
  }
  return (
    <div className="golden-share">
      <button type="button" className="golden-text-button" onClick={share}>
        <Share2 size={16} />
        {t("flows.share.button")}
      </button>
      {status && <p role="status">{t(status)}</p>}
      {fallback && (
        <label className="golden-copy-label">
          {t("flows.share.link")}
          <input
            aria-label={t("flows.share.link")}
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
  const { language, t } = useLanguage();
  return (
    <VoucherClock
      key={`${voucher.id}:${serverNow}`}
      expiresAt={voucher.expiresAt}
      serverNow={serverNow}
    >
      {({ remaining, label }) => {
        const moment = selectVoucherMoment({ voucher, remaining });
        const expired = moment.id === "voucher.expired";
        const used = moment.id === "voucher.redeemed";
        return (
          <div
            className={`golden-voucher ${expired || used ? "is-expired" : ""}`}
            data-experience={moment.id}
          >
            <div className="golden-voucher-heading">
              <Ticket size={22} />
              <span>{t("flows.voucher.heading")}</span>
            </div>
            {voucher.demo && (
              <p className="golden-demo">{t("offerExperience.voucher.demo")}</p>
            )}
            <div className="golden-voucher-summary">
              <div>
                <h3>{voucher.title}</h3>
                <p>{voucher.placeName} · {money(voucher.priceDkk, language)}</p>
              </div>
              <CharacterScene
                moment={moment}
                className="offer-experience-character"
                sizes="100px"
              />
            </div>
            <div className="golden-voucher-proof">
              <div
                className="golden-countdown"
                role="timer"
                aria-label={t("flows.voucher.timer")}
              >
                {used ? t("flows.voucher.redeemed") : expired ? t("flows.voucher.expired") : label}
              </div>
              <label className="golden-voucher-code">
                {t("flows.voucher.code")}
                <textarea
                  aria-label={t("flows.voucher.code")}
                  readOnly
                  rows={2}
                  spellCheck={false}
                  value={voucher.id}
                  onFocus={(event) => event.target.select()}
                />
              </label>
            </div>
            <p className="offer-experience-copy">
              {t(`offerExperience.${moment.id}`, {
                title: voucher.title,
                time: clock(new Date(used ? voucher.redeemedAt : voucher.expiresAt)),
              })}
            </p>
            <small>
              {t("flows.voucher.validUntil", { time: clock(new Date(voucher.expiresAt)) })}
            </small>
            <PublicShare offer={{ ...voucher, id: voucher.offerId }} />
            <Link
              className="golden-text-button"
              href={`/voucher/${encodeURIComponent(voucher.id)}`}
            >
              <ArrowUpRight size={16} />
              {t("flows.voucher.open")}
            </Link>
            {(expired || used) && (
              <Link className="golden-text-button" href="/">
                <ArrowLeft size={16} />
                {t("offerExperience.backPlaces")}
              </Link>
            )}
          </div>
        );
      }}
    </VoucherClock>
  );
}

function OfferDetail({ id }) {
  const { language, t, errorText } = useLanguage();
  const [data, setData] = useState(null);
  const [coupon, setCoupon] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [claimRejected, setClaimRejected] = useState(false);
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
            setClaimRejected(false);
          }
        })
        .catch((cause) => {
          if (!request.signal.aborted) setError(cause);
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
    setClaimRejected(false);
    try {
      const value = await api(
        `/golden-hour/offers/${encodeURIComponent(id)}/claim`,
        { method: "POST" },
      );
      setCoupon(value);
      if (!save(`golden-voucher:${id}`, value.voucher.id))
        setError(
          "flows.offer.storage",
        );
    } catch (cause) {
      setError(cause);
      setClaimRejected(cause.status >= 400 && cause.status < 500);
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
            {errorText(error)}
          </p>
        )}
      </>
    );
  if (!data)
    return (
      <p role={error ? "alert" : "status"}>
        {error ? errorText(error) : t("flows.offer.loading")}
      </p>
    );
  const { offer, eligibilityReason } = data;
  const place = places.find((item) => item.id === offer.placeId);
  const moment = selectOfferMoment({ offer, busy, rejected: claimRejected });
  const rejectionReason = error?.code && Object.hasOwn(messages, error.code)
    ? errorText(error)
    : t("offerExperience.rejectedFallback");
  return (
    <div className="golden-offer-detail" data-experience={moment.id}>
      {offer.demo && (
        <p className="golden-demo">{t("offerExperience.offer.demo")}</p>
      )}
      <div className="golden-offer-summary">
        <div>
          <p className="golden-kicker">
            <MapPin size={14} />
            {offer.placeName}
          </p>
          <h3>{offer.title}</h3>
          <strong className="golden-price">{money(offer.priceDkk, language)}</strong>
        </div>
        <CharacterScene
          moment={moment}
          className="offer-experience-character"
          sizes="100px"
        />
      </div>
      <p>{offer.description}</p>
      <p className="golden-availability" role="status">
        {offer.claimable
          ? t("flows.offer.activeUntil", { time: clock(new Date(offer.activeUntil)) })
          : errorText({ code: data.eligibilityCode, message: eligibilityReason || "flows.offer.unavailable", params: data.eligibilityParams })}
      </p>
      <button
        type="button"
        className="golden-button"
        onClick={claim}
        disabled={!offer.claimable || busy}
      >
        <Ticket size={18} />
        {busy ? t("flows.offer.claiming") : t("flows.offer.claim")}
        <ArrowUpRight size={18} />
      </button>
      <small className="golden-terms">{t("flows.offer.terms")}</small>
      {error && (
        <p className="error" role="alert">
          {claimRejected
            ? t("offerExperience.offer.rejected", { reason: rejectionReason })
            : errorText(error)}
        </p>
      )}
      {!claimRejected && !offer.demo && (
        <p className="offer-experience-copy" role={busy ? "status" : undefined}>
          {t(`offerExperience.${moment.id}`)}
        </p>
      )}
      {offer.demo && busy && (
        <p className="offer-experience-copy" role="status">
          {t("offerExperience.offer.checking")}
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
          {t("flows.offer.directions", { place: place.name })}
        </a>
      )}
      <PublicShare offer={offer} />
    </div>
  );
}

export function GoldenHourDiscovery({ compact = false }) {
  const { language, t, errorText } = useLanguage();
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
            setError(cause);
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
      aria-label={t("flows.discovery.label")}
    >
      <button
        type="button"
        className="golden-discovery-button"
        onClick={() => setOpen(true)}
      >
        <CharacterScene
          moment={selectOfferMoment({ offer: offers[0] })}
          className="offer-experience-discovery-character"
          sizes="64px"
        />
        <span className="golden-discovery-copy">
          <strong>{t("flows.discovery.heading")}</strong>
          <small>
            {loading
              ? t("flows.discovery.loading")
              : error
                ? t("flows.discovery.failed")
                : offers.length
                  ? offers.length === 1
                    ? t("flows.discovery.one")
                    : t("flows.discovery.count", { count: offers.length })
                  : t("flows.discovery.none")}
          </small>
        </span>
        <ArrowUpRight size={21} />
      </button>
      {open && (
        <Modal
          title={activeId ? t("flows.discovery.detail") : t("flows.discovery.now")}
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
                {t("flows.discovery.all")}
              </button>
              <OfferDetail key={activeId} id={activeId} />
            </>
          ) : (
            <>
              <div className="golden-list-intro">
                <div>
                  <p className="golden-kicker">{t("flows.discovery.kicker")}</p>
                  <h3>{t("flows.discovery.questionTop")}<br />
                    {t("flows.discovery.questionBottom")}</h3>
                </div>
              </div>
              <p className="golden-list-copy">{t("flows.discovery.help")}</p>
              {loading ? (
                <p role="status">{t("flows.discovery.fetching")}</p>
              ) : error ? (
                <p role="alert">{errorText(error)}</p>
              ) : !offers.length ? (
                <div className="golden-empty" data-experience="offer.none">
                  <Sun size={25} />
                  <p>{t("offerExperience.offer.none")}</p>
                </div>
              ) : (
                <div className="golden-offer-list">
                  {offers.map((offer) => (
                    <button
                      type="button"
                      key={offer.id}
                      className={`golden-offer-card ${offer.kind}`}
                      data-experience={selectOfferMoment({ offer }).id}
                      onClick={() => setActiveId(offer.id)}
                    >
                      <CharacterScene
                        moment={selectOfferMoment({ offer })}
                        className="offer-experience-card-character"
                        sizes="96px"
                      />
                      <span>
                        <small>
                          {offer.placeName}
                          {offer.demo ? t("flows.discovery.demoSuffix") : ""}
                        </small>
                        <strong>{offer.title}</strong>
                        <b>{money(offer.priceDkk, language)}</b>
                      </span>
                      <ArrowUpRight size={19} />
                    </button>
                  ))}
                </div>
              )}
              <details className="prototype-offer-example">
                <summary>{t("flows.discovery.demoExample")}</summary>
                <GoldenHourExample />
              </details>
              <Link href="/partner" className="golden-text-button">
                {t("flows.discovery.partner")}
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
  const { t, errorText } = useLanguage();
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
            setError(cause);
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
      <LanguageSwitcher />
      <div className="golden-standalone-card">
        {data ? (
          <VoucherCard voucher={data.voucher} serverNow={data.serverNow} />
        ) : (
          <p role={error ? "alert" : "status"}>{error ? errorText(error) : t("flows.voucher.loading")}</p>
        )}
      </div>
      <Link className="golden-text-button" href="/">
        <ArrowLeft size={16} />
        {t("flows.voucher.back")}
      </Link>
    </main>
  );
}

export function PartnerPortal() {
  const { language, t, errorText } = useLanguage();
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
          if (cause.status !== 401) setError(cause);
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
      if (request === action.current) setError(cause);
      return false;
    } finally {
      if (request === action.current) setBusy(false);
    }
  }
  async function login(event) {
    event.preventDefault();
    await mutate("/partner/login", { email, password }, "flows.partner.loggedIn");
    setPassword("");
  }
  async function logout() {
    if (await mutate("/partner/logout", null, "flows.partner.loggedOut")) {
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
        "flows.partner.savedDraft",
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
        "flows.partner.redeemed",
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
        <span className="golden-kicker">{t("flows.partner.heading")}</span>
        <LanguageSwitcher />
        <Link href="/" className="golden-text-button">
          <ArrowLeft size={16} />
          {t("flows.partner.map")}
        </Link>
      </header>
      <section className="partner-intro">
        <div>
          <p className="golden-kicker">{t("flows.partner.kicker")}</p>
          <h1>{t("flows.partner.sun")}<br />
            <em>{t("flows.partner.cheers")}</em>
          </h1>
          <p>{t("flows.partner.intro")}</p>
        </div>
      </section>
      {error && (
        <p className="partner-message error" role="alert">
          {errorText(error)}
        </p>
      )}
      {notice && (
        <p className="partner-message" role="status">
          {t(notice)}
        </p>
      )}
      {status === "loading" ? (
        <p role="status">{t("flows.partner.loading")}</p>
      ) : !dashboard ? (
        <section className="partner-login paper-card">
          <h2>{t("flows.partner.welcome")}</h2>
          <p>{t("flows.partner.loginHelp")}</p>
          <form onSubmit={login}>
            <label htmlFor="partner-email">{t("flows.partner.email")}</label>
            <input
              id="partner-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <label htmlFor="partner-password">{t("flows.partner.password")}</label>
            <input
              id="partner-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button className="golden-button" disabled={busy}>
              {t("flows.partner.login")}
              <ArrowUpRight size={19} />
            </button>
          </form>
          {process.env.NODE_ENV === "development" && (
            <div className="golden-demo-panel">
              <strong>{t("flows.partner.demo")}</strong>
              <p>{t("flows.partner.demoHelp")}</p>
              <button
                type="button"
                className="golden-text-button"
                onClick={() => {
                  setEmail("demo@sunspot.local");
                  setPassword("sunspot-local-demo");
                }}
              >
                {t("flows.partner.fillDemo")}
                <ArrowUpRight size={14} />
              </button>
            </div>
          )}
        </section>
      ) : (
        <>
          <section className="partner-place paper-card">
            <div>
              <p className="golden-kicker">{t("flows.partner.place")}</p>
              <h2>{dashboard.partner.placeName}</h2>
              <p>
                {dashboard.partner.email}
                {dashboard.partner.demo ? t("flows.partner.demoAccount") : ""}
              </p>
            </div>
            <button
              className="golden-text-button"
              disabled={busy}
              onClick={logout}
            >{t("flows.partner.logout")}
            </button>
          </section>
          {dashboard.partner.demo && (
            <p className="golden-demo partner-demo-banner">{t("flows.partner.demoBanner")}</p>
          )}
          <div className="partner-grid">
            <section className="paper-card partner-create">
              <h2>{t("flows.partner.createHeading")}</h2>
              <p>
                {t("flows.partner.draftHelp", { place: dashboard.partner.placeName })}
              </p>
              <form onSubmit={create}>
                <label htmlFor="offer-title">{t("flows.partner.title")}</label>
                <input
                  id="offer-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={80}
                  required
                  placeholder={t("flows.partner.titlePlaceholder")}
                />
                <label htmlFor="offer-description">{t("flows.partner.description")}</label>
                <textarea
                  id="offer-description"
                  required
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={300}
                  rows={3}
                  placeholder={t("flows.partner.descriptionPlaceholder")}
                />
                <div className="partner-field-row">
                  <label>{t("flows.partner.drink")}<select
                      aria-label={t("flows.partner.drink")}
                      value={kind}
                      onChange={(event) => setKind(event.target.value)}
                    >
                      <option value="beer">{t("flows.partner.beer")}</option>
                      <option value="cocktail">{t("flows.partner.cocktail")}</option>
                    </select>
                  </label>
                  <label>
                    {t("flows.partner.price")}
                    <input
                      aria-label={t("flows.partner.price")}
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
                  {t("flows.partner.saveDraft")}
                  <ArrowUpRight size={18} />
                </button>
              </form>
            </section>
            <section className="paper-card partner-offers">
              <div className="partner-section-heading">
                <h2>{t("flows.partner.offers")}</h2>
              </div>
              <p className="partner-eligibility" role="status">
                {dashboard.eligibility.allowed
                  ? t("flows.partner.eligible", { minutes: Math.floor(dashboard.eligibility.until) })
                  : errorText({ code: dashboard.eligibility.reasonCode, message: dashboard.eligibility.reason || "flows.partner.noSun", params: dashboard.eligibility.params })}
              </p>
              <p className="golden-terms">{t("flows.partner.offerTerms")}</p>
              <div className="partner-offer-list">
                {dashboard.offers.map((offer) => (
                  <article key={offer.id} className="partner-offer">
                    <CharacterScene
                      moment={selectOfferMoment({ offer })}
                      className="offer-experience-partner-character"
                      sizes="64px"
                    />
                    <span className="golden-state">
                      {offer.state === "draft"
                        ? t("flows.partner.draft")
                        : offer.state === "active"
                          ? t("flows.partner.active")
                          : t("flows.partner.ended")}
                      {offer.demo ? t("flows.partner.demoSuffix") : ""}
                    </span>
                    <h3>{offer.title}</h3>
                    <p>
                      {offer.kind === "beer"
                        ? t("flows.partner.beer")
                        : offer.kind === "cocktail"
                          ? t("flows.partner.cocktail")
                          : t("offerExperience.otherKind")} ·{" "}
                      {money(offer.priceDkk, language)}
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
                            "flows.partner.activated",
                          )
                        }
                      >
                        <Sun size={16} />
                        {t("flows.partner.activate")}
                      </button>
                    ) : (
                      <>
                        <p className="golden-terms">
                          {offer.state === "active"
                            ? t("flows.partner.activeUntil", { time: clock(new Date(offer.activeUntil)) })
                            : t("flows.partner.nextDraft")}
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
            <h2>{t("flows.partner.redeemHeading")}</h2>
            <p>{t("flows.partner.redeemHelp")}</p>
            <form onSubmit={redeem} className="partner-redeem">
              <label htmlFor="redeem-id" className="sr-only">{t("flows.partner.redeemCode")}</label>
              <input
                id="redeem-id"
                value={redeemId}
                onChange={(event) => setRedeemId(event.target.value)}
                placeholder={t("flows.partner.redeemPlaceholder")}
                required
              />
              <button className="golden-button" disabled={busy}>
                <Check size={17} />
                {t("flows.partner.redeem")}
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
                          ? t("flows.voucher.redeemed")
                          : expired
                            ? t("flows.partner.voucherExpired")
                            : t("flows.partner.validUntil", { time: clock(new Date(voucher.expiresAt)) })}
                        {voucher.demo ? t("flows.partner.lowerDemoSuffix") : ""}
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
                          "flows.partner.redeemed",
                        )
                      }
                    >{t("flows.partner.redeem")}<Check size={15} />
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
