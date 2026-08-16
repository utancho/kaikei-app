type Tone = "gray" | "green" | "yellow" | "red" | "blue";

const TONE_CLASSES: Record<Tone, string> = {
  gray: "bg-gray-100 text-gray-600",
  green: "bg-emerald-100 text-emerald-700",
  yellow: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
  blue: "bg-sky-100 text-sky-700",
};

export function Badge({ tone = "gray", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TONE_CLASSES[tone]}`}>{children}</span>;
}
