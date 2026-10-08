"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

const SHOW_MS = 3400;

export default function Splash({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const done = useRef(onDone);

  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    const t = setTimeout(() => setLeaving(true), SHOW_MS);
    const skip = () => setLeaving(true);
    window.addEventListener("keydown", skip);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", skip);
    };
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => done.current(), 1000);
    return () => clearTimeout(t);
  }, [leaving]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className={"splash" + (leaving ? " leaving" : "")}
      onClick={() => setLeaving(true)}
      aria-label="RemitAI intro. Click to skip."
    >
      <Image
        src="/remitai-4k.png"
        alt="RemitAI"
        fill
        priority
        sizes="100vw"
        className="splash-img"
        style={{ objectFit: "cover" }}
      />
      <div className="splash-shine" />
      <div className="splash-bar"><span /></div>
      <span className="splash-skip">Click to skip</span>
    </div>
  );
}
