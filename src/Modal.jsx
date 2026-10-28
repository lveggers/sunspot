"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { LanguageSwitcher, useLanguage } from "./Language.jsx";

export default function Modal({ title, children, onClose, className = "" }) {
  const { t } = useLanguage();
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    const opener = document.activeElement;
    d.showModal();
    return () => {
      d.close();
      if (opener instanceof HTMLElement && opener.isConnected)
        opener.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      className={`modal ${className}`}
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-top">
        <h2>{title}</h2>
        <LanguageSwitcher />
        <button
          type="button"
          className="icon-button"
          aria-label={t("common.close")}
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
