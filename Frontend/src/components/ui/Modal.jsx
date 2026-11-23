import { useEffect } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";

// A modal dialog. It renders into the body so it layers above everything.
//   <Modal onClose={close} title="Confirm">
//     …content…
//   </Modal>
// Close on clicking the backdrop or the X. Pressing Esc is ignored
// deliberately so the POS keyboard flow is never interrupted.

export default function Modal({
  title,
  onClose,
  children,
  size = "md",
  className = "",
  dark = false,
  ...rest
}) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Tab") e.preventDefault();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative z-10 w-full rounded-2xl p-6 shadow-card-lg ${
          size === "lg" ? "max-w-2xl" : size === "sm" ? "max-w-md" : "max-w-lg"
        } ${className} ${
          dark ? "bg-slate-800" : "bg-card"
        }`}
        {...rest}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className={`text-lg font-semibold ${dark ? "text-slate-100" : "text-slate-800"}`}>{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`rounded-lg p-1 transition ${
              dark
                ? "text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                : "text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            }`}
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
