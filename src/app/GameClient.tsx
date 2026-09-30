"use client";

import dynamic from "next/dynamic";

// WebGL and the physics engine only exist in the browser.
export const GameClient = dynamic(() => import("@/scene/Game").then((m) => m.Game), { ssr: false });
