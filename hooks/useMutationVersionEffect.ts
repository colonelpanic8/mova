import { useEffect, useRef } from "react";

/**
 * Run an effect when mutationVersion changes, without pulling the callback into
 * the effect dependency array (avoids "exhaustive-deps" disables).
 */
export function useMutationVersionEffect(
  mutationVersion: number,
  effect: () => void,
  options: { skipInitial?: boolean } = {},
) {
  const effectRef = useRef(effect);
  const isInitial = useRef(true);

  useEffect(() => {
    effectRef.current = effect;
  }, [effect]);

  useEffect(() => {
    if (options.skipInitial !== false && isInitial.current) {
      isInitial.current = false;
      return;
    }
    effectRef.current();
  }, [mutationVersion, options.skipInitial]);
}
