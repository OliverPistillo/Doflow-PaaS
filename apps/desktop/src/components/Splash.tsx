import { useEffect, useLayoutEffect, useRef } from "react";
import gsap from "gsap";

type SplashProps = {
  exiting: boolean;
  onAnimationFinished: () => void;
  onExitFinished: () => void;
};

export function Splash({ exiting, onAnimationFinished, onExitFinished }: SplashProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const finishedRef = useRef(false);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const context = gsap.context(() => {
      const finish = () => {
        if (!finishedRef.current) {
          finishedRef.current = true;
          onAnimationFinished();
        }
      };

      if (reduced) {
        gsap.set(".splash-logo-reveal", { clipPath: "inset(0 0% 0 0)" });
        gsap.fromTo(".splash-logo-wrap", { opacity: 0 }, { opacity: 1, duration: 0.35, ease: "power1.out", onComplete: finish });
        return;
      }

      const timeline = gsap.timeline({ onComplete: finish });
      timeline
        .set(".splash-logo-reveal", { clipPath: "inset(0 100% 0 0)" })
        .set(".splash-sweep", { xPercent: -145, opacity: 0 })
        .set(".splash-ambient", { opacity: 0.08, scale: 0.82 })
        .to(".splash-ambient", { opacity: 0.42, scale: 1, duration: 0.75, ease: "power2.out" }, 0.05)
        .to(".splash-logo-reveal", { clipPath: "inset(0 0% 0 0)", duration: 1.18, ease: "power2.inOut" }, 0.12)
        .to(".splash-sweep", { xPercent: 145, opacity: 1, duration: 1.2, ease: "power2.inOut" }, 0.16)
        .to(".splash-sweep", { opacity: 0, duration: 0.2, ease: "power1.out" }, 1.22)
        .to(".splash-ambient", { opacity: 0.18, scale: 0.94, duration: 0.28, ease: "power1.out" }, 1.26)
        .to({}, { duration: 0.08 });
    }, root);
    return () => context.revert();
  }, [onAnimationFinished]);

  useEffect(() => {
    if (!exiting || !rootRef.current) return;
    gsap.to(rootRef.current, {
      opacity: 0,
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.16 : 0.3,
      ease: "power2.inOut",
      onComplete: onExitFinished,
    });
  }, [exiting, onExitFinished]);

  return (
    <div ref={rootRef} className="splash" aria-label="Avvio di Doflow">
      <div className="splash-vignette" />
      <div className="splash-logo-wrap">
        <div className="splash-ambient" />
        <div className="splash-logo splash-logo-ghost" />
        <div className="splash-logo splash-logo-reveal" />
        <div className="splash-logo splash-sweep" />
      </div>
      <p className="splash-status">Preparazione del tuo workspace</p>
    </div>
  );
}
