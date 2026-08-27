import { useId, type SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 18, ...rest }: P, children: React.ReactNode, filled = false) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IcScissors = (p: P) =>
  base(
    p,
    <>
      <circle cx="6" cy="6" r="2.6" />
      <circle cx="6" cy="18" r="2.6" />
      <path d="M8.2 7.6 20 19M8.2 16.4 20 5M14.2 10.1l1.9 1.9" />
    </>
  );

export const IcCalendar = (p: P) =>
  base(
    p,
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <path d="M3.5 10h17M8 2.8V7M16 2.8V7" />
    </>
  );

export const IcUsers = (p: P) =>
  base(
    p,
    <>
      <circle cx="9" cy="8" r="3.4" />
      <path d="M2.8 20.2c.7-3.3 3.2-5.2 6.2-5.2s5.5 1.9 6.2 5.2" />
      <path d="M15.5 4.9a3.4 3.4 0 0 1 0 6.2M17.8 15.4c1.7.8 3 2.3 3.4 4.8" />
    </>
  );

export const IcCog = (p: P) =>
  base(
    p,
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.2 12a7.2 7.2 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7.3 7.3 0 0 0-2-1.2L14.4 3h-4l-.4 2.5a7.3 7.3 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5a7.2 7.2 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a7.3 7.3 0 0 0 2 1.2l.4 2.5h4l.4-2.5a7.3 7.3 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z" />
    </>
  );

export const IcPlus = (p: P) => base(p, <path d="M12 5v14M5 12h14" />);
export const IcX = (p: P) => base(p, <path d="m6 6 12 12M18 6 6 18" />);
export const IcChevronL = (p: P) => base(p, <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />);
export const IcChevronR = (p: P) => base(p, <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />);
export const IcArrowL = (p: P) => base(p, <path d="M19 12H5m6-7-7 7 7 7" />);

export const IcClock = (p: P) =>
  base(
    p,
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  );

export const IcPhone = (p: P) =>
  base(
    p,
    <path d="M5.5 3.5h3l1.7 4.2-2.1 1.6a12.5 12.5 0 0 0 6.6 6.6l1.6-2.1 4.2 1.7v3a2 2 0 0 1-2.1 2A16.5 16.5 0 0 1 3.5 5.6a2 2 0 0 1 2-2.1Z" />
  );

export const IcPin = (p: P) =>
  base(
    p,
    <>
      <path d="M12 21s-6.8-6-6.8-11a6.8 6.8 0 0 1 13.6 0c0 5-6.8 11-6.8 11Z" />
      <circle cx="12" cy="9.8" r="2.4" />
    </>
  );

export const IcSearch = (p: P) =>
  base(
    p,
    <>
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="m15.5 15.5 5 5" />
    </>
  );

export const IcTrash = (p: P) =>
  base(
    p,
    <>
      <path d="M4 6.5h16M9.5 6.5V4.8A1.3 1.3 0 0 1 10.8 3.5h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7M6.2 6.5l.9 12.6a2 2 0 0 0 2 1.9h5.8a2 2 0 0 0 2-1.9l.9-12.6M10 10.8v6M14 10.8v6" />
    </>
  );

export const IcPencil = (p: P) =>
  base(p, <path d="M4 20h4.2L19.5 8.7a2.1 2.1 0 0 0-3-3L5.3 17 4 20ZM14.5 7.5l2 2" />);

export const IcCheck = (p: P) => base(p, <path d="m5 12.5 4.5 4.5L19 7.5" />);

export const IcDownload = (p: P) =>
  base(p, <path d="M12 4v11m0 0 4.5-4.5M12 15l-4.5-4.5M4.5 19.5h15" />);

export const IcUpload = (p: P) =>
  base(p, <path d="M12 15V4m0 0 4.5 4.5M12 4 7.5 8.5M4.5 19.5h15" />);

export const IcAlert = (p: P) =>
  base(
    p,
    <>
      <path d="M12 3.5 22 20H2L12 3.5Z" />
      <path d="M12 10v4.2M12 17.3v.2" />
    </>
  );

export const IcMobile = (p: P) =>
  base(
    p,
    <>
      <rect x="7" y="2.8" width="10" height="18.4" rx="2.4" />
      <path d="M11 18h2" />
    </>
  );

export const IcMonitor = (p: P) =>
  base(
    p,
    <>
      <rect x="3" y="4" width="18" height="12.5" rx="2" />
      <path d="M9 20.5h6M12 16.5v4" />
    </>
  );

export const IcList = (p: P) =>
  base(p, <path d="M8.5 6h12M8.5 12h12M8.5 18h12M3.8 6h.4M3.8 12h.4M3.8 18h.4" />);

export const IcGrid = (p: P) =>
  base(
    p,
    <>
      <rect x="3.5" y="3.5" width="7.3" height="7.3" rx="1.4" />
      <rect x="13.2" y="3.5" width="7.3" height="7.3" rx="1.4" />
      <rect x="3.5" y="13.2" width="7.3" height="7.3" rx="1.4" />
      <rect x="13.2" y="13.2" width="7.3" height="7.3" rx="1.4" />
    </>
  );

export const IcUserPlus = (p: P) =>
  base(
    p,
    <>
      <circle cx="10" cy="8" r="3.4" />
      <path d="M3.5 20.2c.7-3.3 3.2-5.2 6.5-5.2 1.4 0 2.7.3 3.8 1M18.5 13.5v5M16 16h5" />
    </>
  );

export const IcRotate = (p: P) =>
  base(p, <path d="M4.5 12a7.5 7.5 0 1 1 2.2 5.3M4.5 12V6.8M4.5 12h5.2" />);

export const IcBan = (p: P) =>
  base(
    p,
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6 6l12 12" />
    </>
  );

export const IcSparkle = (p: P) =>
  base(p, <path d="M12 3.5c.6 3.8 2.7 5.9 6.5 6.5-3.8.6-5.9 2.7-6.5 6.5-.6-3.8-2.7-5.9-6.5-6.5 3.8-.6 5.9-2.7 6.5-6.5ZM19 15.5c.3 1.8 1.2 2.7 3 3-1.8.3-2.7 1.2-3 3-.3-1.8-1.2-2.7-3-3 1.8-.3 2.7-1.2 3-3Z" />);

export const IcEuro = (p: P) =>
  base(p, <path d="M17.5 5.5A7.3 7.3 0 0 0 6.8 8.5a7.6 7.6 0 0 0 0 7 7.3 7.3 0 0 0 10.7 3M4.5 10.3h9M4.5 13.7h8" />);

export const IcWifi = (p: P) =>
  base(p, <path d="M3 9.5a13.5 13.5 0 0 1 18 0M6.2 13a9 9 0 0 1 11.6 0M9.4 16.4a4.5 4.5 0 0 1 5.2 0M12 19.5v.1" />);

export const IcMail = (p: P) =>
  base(
    p,
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.2" />
      <path d="m3.8 7 7.1 5.3a2 2 0 0 0 2.2 0L20.2 7" />
    </>
  );

export const IcShieldCheck = (p: P) =>
  base(
    p,
    <>
      <path d="M12 3.2 19 6v5.3c0 4.6-3 7.9-7 9.5-4-1.6-7-4.9-7-9.5V6l7-2.8Z" />
      <path d="m8.8 12 2.2 2.2 4.2-4.4" />
    </>
  );

export const IcFileText = (p: P) =>
  base(
    p,
    <>
      <path d="M6 3.5h8L19 8.5v12H6v-17Z" />
      <path d="M14 3.5v5h5M9 12.5h6M9 16h6" />
    </>
  );

export const IcPenNib = (p: P) =>
  base(
    p,
    <>
      <path d="m14.8 4.2 5 5L9 20H4v-5L14.8 4.2Z" />
      <path d="m12.5 6.5 5 5M4 20l3.5-3.5" />
    </>
  );

/** Poste de peluquero 💈: franjas diagonales rojas y azules sobre blanco. */
export function IcBarberPole({ size = 18, ...rest }: P) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      {...rest}
    >
      <defs>
        <clipPath id={id}>
          <rect x="9.3" y="5.2" width="5.4" height="16.4" rx="2.7" />
        </clipPath>
      </defs>
      {/* bola superior */}
      <circle cx="12" cy="3" r="1.7" fill="#fff" stroke="currentColor" strokeWidth="1.3" />
      {/* cuerpo con franjas */}
      <g clipPath={`url(#${id})`}>
        <rect x="9.3" y="5.2" width="5.4" height="16.4" fill="#ffffff" />
        <path d="M7.4 10.4 17 7v2.9L7.4 13.3z" fill="#b3364d" />
        <path d="M7.4 14.9 17 11.5v2.9L7.4 17.8z" fill="#34558b" />
        <path d="M7.4 19.4 17 16v2.9L7.4 22.3z" fill="#b3364d" />
      </g>
      {/* contorno */}
      <rect
        x="9.3"
        y="5.2"
        width="5.4"
        height="16.4"
        rx="2.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
