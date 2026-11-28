export function KeepIcon({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <svg
      viewBox="10 0 100 100"
      className={className}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Left tower */}
      <rect x="10" y="20" width="20" height="60" />
      {/* Left tower crenellations */}
      <rect x="10" y="15" width="4" height="5" />
      <rect x="18" y="15" width="4" height="5" />
      <rect x="26" y="15" width="4" height="5" />

      {/* Right tower */}
      <rect x="70" y="20" width="20" height="60" />
      {/* Right tower crenellations */}
      <rect x="70" y="15" width="4" height="5" />
      <rect x="78" y="15" width="4" height="5" />
      <rect x="86" y="15" width="4" height="5" />

      {/* Central section (lower) */}
      <rect x="30" y="40" width="40" height="40" />
      {/* Central crenellations */}
      <rect x="30" y="35" width="6" height="5" />
      <rect x="40" y="35" width="6" height="5" />
      <rect x="50" y="35" width="6" height="5" />
      <rect x="60" y="35" width="6" height="5" />

      {/* Gate/door */}
      <rect x="45" y="60" width="10" height="20" fill="black" />
    </svg>
  );
}
