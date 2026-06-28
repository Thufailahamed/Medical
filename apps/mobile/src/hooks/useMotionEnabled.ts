import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** Subscribes to the system reduce-motion setting. */
export function useMotionEnabled(): boolean {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setEnabled(!v);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (e) => {
      setEnabled(!(e as any).reduceMotionEnabled);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return enabled;
}
