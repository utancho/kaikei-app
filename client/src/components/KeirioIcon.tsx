export function KeirioIcon({ size = 36, className = "" }: { size?: number; className?: string }) {
  return <img src="/brand/keirio-icon.png" width={size} height={size} alt="" aria-hidden="true" className={"keirio-icon shrink-0 " + className} style={{ width: size, height: size }} />;
}
