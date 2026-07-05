import { cn } from "@/portal/lib/utils";
import { initials } from "@/portal/lib/format";

interface AvatarProps {
  name?: string | null;
  src?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
} as const;

// Mobile app uses semi-transparent tinted backgrounds, not gradients.
// Each palette entry: [bg class, text class]
const palettes: [string, string][] = [
  ["bg-sky-100", "text-sky-700"],
  ["bg-emerald-100", "text-emerald-700"],
  ["bg-violet-100", "text-violet-700"],
  ["bg-rose-100", "text-rose-700"],
  ["bg-amber-100", "text-amber-700"],
  ["bg-teal-100", "text-teal-700"],
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  const label = initials(name);
  const [bg, fg] = palettes[hash(name ?? "anon") % palettes.length];
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-bold overflow-hidden shrink-0",
        sizeMap[size],
        bg,
        fg,
        className
      )}
      aria-hidden={src ? "false" : "true"}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name ?? "avatar"}
          className="h-full w-full object-cover"
        />
      ) : (
        label
      )}
    </div>
  );
}
