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

const palettes = [
  "from-sky-500 to-sky-700",
  "from-emerald-500 to-emerald-700",
  "from-violet-500 to-violet-700",
  "from-rose-500 to-rose-700",
  "from-amber-500 to-amber-700",
  "from-teal-500 to-teal-700",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  const label = initials(name);
  const palette = palettes[hash(name ?? "anon") % palettes.length];
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center text-white font-semibold bg-gradient-to-br overflow-hidden shrink-0",
        sizeMap[size],
        palette,
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