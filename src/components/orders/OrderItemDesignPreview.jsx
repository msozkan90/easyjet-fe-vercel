"use client";

import { Card, Empty, Image, Tag, Typography } from "antd";
import {
  OriginalDesignButton,
  resolveDesignThumbnailStatus,
} from "@/components/common/media/DesignThumbnailImage";
import { useTranslations } from "@/i18n/use-translations";
import { extractDesignAreaFromRecord } from "@/utils/designArea";

const hasFilledPersonalization = (item) =>
  Number(item?.quantity || 1) > 1 && Boolean(item?.has_personalization);

const buildPersonalizedDesignGroups = (item) => {
  const rawDesigns = Array.isArray(item?.designs) ? item.designs : [];
  const groups = new Map();

  rawDesigns.forEach((design) => {
    const key = design?.design_group_id
      ? `group-${design.design_group_id}`
      : "legacy";
    const current = groups.get(key) || [];
    current.push(design);
    groups.set(key, current);
  });

  return Array.from(groups.entries()).map(([key, groupDesigns]) => {
    const designsByPosition = new Map();
    groupDesigns.forEach((design) => {
      const positionId = String(design?.product_position_id || "");
      const current = designsByPosition.get(positionId) || [];
      current.push(design);
      designsByPosition.set(positionId, current);
    });

    const legacy = key === "legacy";
    const quantity = legacy
      ? Number(item?.quantity || 1)
      : Math.max(
          1,
          ...Array.from(designsByPosition.values()).map(
            (positionDesigns) => positionDesigns.length,
          ),
        );

    return {
      id: key,
      legacy,
      quantity,
      designs: Array.from(designsByPosition.values()).map(
        (positionDesigns) => ({
          ...positionDesigns[0],
          display_quantity: legacy ? quantity : positionDesigns.length,
        }),
      ),
    };
  });
};

const PositionDesignCard = ({
  item,
  design,
  positionMap,
  tDetail,
  tOrders,
  fallbackText,
  showQuantity = true,
}) => {
  const tThumbnail = useTranslations("common.designThumbnail");
  const positionId = String(design?.product_position_id || "");
  const position = positionMap.get(positionId);
  const designArea = position ? extractDesignAreaFromRecord(position) : null;
  const positionImageUrl = position?.images?.[0]?.image_url;
  const previewImageUrl = positionImageUrl || item?.image_url;
  const designPreviewUrl = design?.thumbnail_url;
  const thumbnailStatus = resolveDesignThumbnailStatus(design);
  const thumbnailFallbackText =
    thumbnailStatus === "pending" || thumbnailStatus === "processing"
      ? tThumbnail("preparing")
      : thumbnailStatus === "failed"
        ? tThumbnail("failed")
        : thumbnailStatus === "not_applicable"
          ? tThumbnail("notApplicable")
          : fallbackText;
  const positionName =
    position?.name ||
    design?.product_position?.name ||
    tDetail("designs.unknownPosition");

  return (
    <Card
      title={positionName}
      extra={
        showQuantity && Number(design?.display_quantity || 1) > 1 ? (
          <Tag color="blue">
            {tOrders("columns.quantity")}: {design.display_quantity}
          </Tag>
        ) : null
      }
      className="rounded-2xl border border-slate-100 shadow-sm"
      styles={{
        body: {
          display: "flex",
          flexDirection: "column",
          gap: 12,
          flex: 1,
          padding: 16,
        },
      }}
    >
      <div className="relative flex w-full flex-1 items-center overflow-hidden rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-slate-100">
        {previewImageUrl ? (
          <div className="relative w-full">
            <img
              src={previewImageUrl}
              alt={positionName}
              className="block w-full rounded-2xl object-contain"
              style={{ backgroundColor: item?.color?.hex_code || undefined }}
            />
            <div className="absolute inset-0">
              {designArea ? (
                <div
                  className="absolute rounded-xl border-2 border-blue-500/70 bg-blue-500/10 shadow-inner"
                  style={{
                    left: `${designArea.x * 100}%`,
                    top: `${designArea.y * 100}%`,
                    width: `${designArea.width * 100}%`,
                    height: `${designArea.height * 100}%`,
                  }}
                >
                  {designPreviewUrl ? (
                    <Image
                      src={designPreviewUrl}
                      alt="design preview"
                      width="100%"
                      height="100%"
                      preview={{ src: designPreviewUrl }}
                      style={{ objectFit: "contain", borderRadius: 8 }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-blue-600">
                      {thumbnailFallbackText}
                    </div>
                  )}
                </div>
              ) : designPreviewUrl ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Image
                    src={designPreviewUrl}
                    alt="design preview"
                    width={96}
                    height={96}
                    preview={{ src: designPreviewUrl }}
                    style={{ objectFit: "contain", borderRadius: 8 }}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : designPreviewUrl ? (
          <div className="flex aspect-[4/5] items-center justify-center p-6">
            <Image
              src={designPreviewUrl}
              alt="design preview"
              width="100%"
              height="100%"
              preview={{ src: designPreviewUrl }}
              style={{ objectFit: "contain" }}
            />
          </div>
        ) : (
          <div className="flex aspect-[4/5] items-center justify-center p-6">
            <Empty description={thumbnailFallbackText || tDetail("designs.noPreview")} />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {tDetail("designs.positionLabel")}
        </Typography.Text>
        <Typography.Text>{positionName}</Typography.Text>
        <OriginalDesignButton url={design?.design_url} block />
      </div>
    </Card>
  );
};

export default function OrderItemDesignPreview({
  item,
  positionMap,
  tDetail,
  tOrders,
  fallbackText,
}) {
  const rawDesigns = Array.isArray(item?.designs) ? item.designs : [];
  if (!rawDesigns.length) {
    return <Empty description={tDetail("designs.empty")} />;
  }

  if (!hasFilledPersonalization(item)) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {rawDesigns.map((design) => (
          <PositionDesignCard
            key={design?.id || design?.design_url}
            item={item}
            design={design}
            positionMap={positionMap}
            tDetail={tDetail}
            tOrders={tOrders}
            fallbackText={fallbackText}
          />
        ))}
      </div>
    );
  }

  const groups = buildPersonalizedDesignGroups(item);
  return (
    <div className="space-y-4">
      {groups.map((group, groupIndex) => (
        <Card
          key={group.id}
          title={tDetail("designs.groupTitle", { number: groupIndex + 1 })}
          extra={
            <Tag color="blue">
              {tDetail("designs.groupQuantity", {
                quantity: group.quantity,
              })}
            </Tag>
          }
          className="rounded-2xl border border-slate-200 bg-slate-50/40"
          styles={{ body: { padding: 16 } }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            {group.designs.map((design) => (
              <PositionDesignCard
                key={`${group.id}-${design?.product_position_id}`}
                item={item}
                design={design}
                positionMap={positionMap}
                tDetail={tDetail}
                tOrders={tOrders}
                fallbackText={fallbackText}
                showQuantity={false}
              />
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
