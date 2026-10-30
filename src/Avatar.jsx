import { useState } from "react";
import { UserRound } from "lucide-react";
export default function Avatar({ name = "", photo = null, className = "" }) {
  const [failed, setFailed] = useState(null);
  return (
    <span className={`profile-avatar ${className}`}>
      {photo &&
      failed !==
        photo /* Already-sized JPEG; skip Next image optimization and its persistent cache. */ ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={photo}
          alt={name}
          width={192}
          height={192}
          onError={() => setFailed(photo)}
        />
      ) : name ? (
        name.slice(0, 1).toUpperCase()
      ) : (
        <UserRound size={22} />
      )}
    </span>
  );
}
