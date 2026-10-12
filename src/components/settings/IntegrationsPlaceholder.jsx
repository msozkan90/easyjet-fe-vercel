"use client";

import { SafetyCertificateOutlined } from "@ant-design/icons";
import { translateOrFallback } from "@/components/settings/settings.helpers";
import { EmptyState } from "@/components/ui/StateView";

export default function IntegrationsPlaceholder({ tSettings }) {
  const title = translateOrFallback(
    tSettings,
    "integrations.restrictedTitle",
    "ShipStation is managed by your company"
  );
  const description = translateOrFallback(
    tSettings,
    "integrations.restrictedDescription",
    "Contact your EasyJet administrator to request access."
  );

  return (
    <div className="rounded-xl border border-line bg-surface">
      <EmptyState
        icon={<SafetyCertificateOutlined />}
        title={title}
        description={description}
      />
    </div>
  );
}
