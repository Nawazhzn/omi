/** Small corner accent echoing kolam line-work — a light touch of ornament on
    modal/panel corners, not a focal element. */
export function CornerAccent({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1.5 16C1.5 8 8 1.5 16 1.5" stroke="#e3bd5d" strokeOpacity="0.45" strokeWidth="1" />
      <circle cx="16" cy="1.5" r="1.3" fill="#e3bd5d" fillOpacity="0.6" />
      <circle cx="1.5" cy="16" r="1.3" fill="#e3bd5d" fillOpacity="0.6" />
    </svg>
  );
}
