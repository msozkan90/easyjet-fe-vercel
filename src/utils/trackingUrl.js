const TRACKING_URL_BUILDERS = [
  {
    aliases: ["amazon", "amazonshipping", "amazonlogistics"],
    build: (trackingNumber) =>
      `https://track.amazon.com/tracking/${trackingNumber}`,
  },
  {
    aliases: [
      "usps",
      "unitedstatespostalservice",
      "stamps",
      "stampscom",
      "endicia",
    ],
    build: (trackingNumber) =>
      `https://tools.usps.com/go/TrackConfirmAction.action?tLabels=${trackingNumber}`,
  },
  {
    aliases: [
      "ups",
      "upsdap",
      "unitedparcelservice",
      "upsmailinnovations",
      "upssurepost",
    ],
    build: (trackingNumber) =>
      `https://www.ups.com/track?loc=en_US&tracknum=${trackingNumber}`,
  },
  {
    aliases: [
      "fedex",
      "federalexpress",
      "fedexground",
      "fedexsmartpost",
    ],
    build: (trackingNumber) =>
      `https://www.fedex.com/fedextrack/?action=track&trackingnumber=${trackingNumber}`,
  },
  {
    aliases: [
      "dhl",
      "dhlexpress",
      "dhlecommerce",
      "dhlglobalmail",
      "dhlparcel",
    ],
    build: (trackingNumber) =>
      `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${trackingNumber}`,
  },
  {
    aliases: ["ontrac", "ontracv3", "lasership"],
    build: (trackingNumber) =>
      `https://www.ontrac.com/tracking/?number=${trackingNumber}`,
  },
];

const normalizeCarrier = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");

const resolveProviderTrackingUrl = (value) => {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

export const resolveTrackingUrl = ({
  trackingNumber,
  trackingUrl,
  carrier,
  carrierCode,
  service,
} = {}) => {
  const normalizedTrackingNumber = String(trackingNumber ?? "").trim();
  if (!normalizedTrackingNumber) return null;

  const providerUrl = resolveProviderTrackingUrl(trackingUrl);
  if (providerUrl) return providerUrl;

  const carrierCandidates = [carrierCode, carrier, service]
    .map(normalizeCarrier)
    .filter(Boolean);
  const matchingCarrier = TRACKING_URL_BUILDERS.find(({ aliases }) =>
    carrierCandidates.some((candidate) =>
      aliases.some(
        (alias) => candidate === alias || candidate.startsWith(alias),
      ),
    ),
  );

  if (!matchingCarrier) return null;

  return matchingCarrier.build(encodeURIComponent(normalizedTrackingNumber));
};
