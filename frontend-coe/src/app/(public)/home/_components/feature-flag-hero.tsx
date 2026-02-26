"use client";

import { useFeatureFlagVariantKey } from "posthog-js/react";

export default function FeatureFlagHero() {
  const feature = useFeatureFlagVariantKey("new-landing-page");

  if (feature === "show-video-hero") {
    return (
      <p className="text-center font-mono text-4xl font-bold">
        Welcome to the new landing page with{" "}
        <span className="text-blue-500">video feature flag</span>
      </p>
    );
  }

  return (
    <p className="text-center font-mono text-4xl font-bold">
      Welcome to the new landing page with <span className="text-blue-500">image feature flag</span>
    </p>
  );
}
