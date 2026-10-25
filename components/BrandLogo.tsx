export function BrandLogo() {
  return (
    <span className="brand-lockup" aria-label="VOX">
      <svg
        className="brand-icon"
        viewBox="0 0 48 48"
        role="img"
        aria-hidden="true"
      >
        <path
          d="M8 21.5a15 15 0 0 1 28.5-6.7M36.5 33.2A15 15 0 0 1 8 26.5L4 39l12.5-3.5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.6"
        />
        <path
          d="M18 20v8m6-12v16m6-12v8"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2.8"
        />
      </svg>
      <span className="brand-wordmark">VOX</span>
    </span>
  );
}
