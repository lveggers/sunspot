import { useState } from "react";
import { Share2, MapPin } from "lucide-react";
import { useLanguage } from "./Language.jsx";
import { placeMapsUrl } from "./placeShare.js";
import HangCreate from "./HangCreate.jsx";
export default function PlaceShare({ place, result, instant, live, pending }) {
  const { t } = useLanguage();
  const [creating, setCreating] = useState(false);
  return (
    <div className="place-share">
      <button
        className="primary wide share-place-action"
        onClick={() => setCreating(true)}
      >
        {t(live ? "Jag är här – kom!" : "Bjud in hit")}
        <Share2 size={19} />
      </button>
      <div className="place-share-meta">
        <span>{t("En länk. Inget konto.")}</span>
        <a href={placeMapsUrl(place)} target="_blank" rel="noreferrer">
          <MapPin size={13} />
          {t("Öppna i Maps")}
        </a>
      </div>
      {creating && (
        <HangCreate
          place={place}
          result={result}
          instant={instant}
          live={live}
          pending={pending}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  );
}
