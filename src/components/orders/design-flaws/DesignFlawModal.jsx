"use client";

import { useEffect, useMemo, useState } from "react";
import {
  App as AntdApp,
  Card,
  Checkbox,
  Empty,
  Image,
  InputNumber,
  Modal,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import { OrdersAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";
import { OriginalDesignButton } from "@/components/common/media/DesignThumbnailImage";

export default function DesignFlawModal({
  open,
  orderItem,
  onCancel,
  onSaved,
}) {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.orders.designFlaws");
  const tThumbnail = useTranslations("common.designThumbnail");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState([]);
  const [selections, setSelections] = useState({});

  useEffect(() => {
    if (!open || !orderItem?.id) {
      setGroups([]);
      setSelections({});
      return;
    }
    let active = true;
    setLoading(true);
    OrdersAPI.designFlawOptions(orderItem.id)
      .then((response) => {
        if (!active) return;
        const data = response?.data ?? response;
        setGroups(Array.isArray(data?.groups) ? data.groups : []);
      })
      .catch((error) => {
        if (!active) return;
        message.error(
          error?.response?.data?.error?.message || t("messages.optionsFailed"),
        );
        onCancel?.();
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [message, onCancel, open, orderItem?.id, t]);

  const selectedGroups = useMemo(
    () =>
      groups.flatMap((group) => {
        const quantity = Number(selections[group.group_key] || 0);
        return quantity > 0
          ? [{ group_key: group.group_key, missing_quantity: quantity }]
          : [];
      }),
    [groups, selections],
  );

  const handleSave = async () => {
    if (!selectedGroups.length) {
      message.warning(t("validation.groupRequired"));
      return;
    }
    setSaving(true);
    try {
      await OrdersAPI.markDesignFlaw(orderItem.id, { groups: selectedGroups });
      message.success(t("messages.marked"));
      onSaved?.();
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || t("messages.markFailed"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t("modal.title")}
      okText={t("actions.mark")}
      cancelText={t("actions.cancel")}
      confirmLoading={saving}
      okButtonProps={{ disabled: loading || !selectedGroups.length }}
      onOk={handleSave}
      onCancel={onCancel}
      width={760}
      destroyOnClose
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Typography.Text type="secondary">
          {t("modal.description", {
            orderNumber:
              orderItem?.order?.order_number || orderItem?.order_number || "-",
          })}
        </Typography.Text>
        {loading ? (
          <div className="flex justify-center py-10">
            <Spin />
          </div>
        ) : groups.length ? (
          groups.map((group, index) => {
            const selected = Number(selections[group.group_key] || 0) > 0;
            return (
              <Card
                key={group.group_key}
                size="small"
                title={
                  <Checkbox
                    checked={selected}
                    onChange={(event) =>
                      setSelections((current) => ({
                        ...current,
                        [group.group_key]: event.target.checked ? 1 : 0,
                      }))
                    }
                  >
                    {group.is_legacy
                      ? t("groups.legacy")
                      : t("groups.number", { number: index + 1 })}
                  </Checkbox>
                }
                extra={
                  <Tag color="blue">
                    {t("groups.available", {
                      quantity: group.available_quantity,
                    })}
                  </Tag>
                }
              >
                <div className="grid gap-4 md:grid-cols-[1fr_180px]">
                  <Space wrap>
                    {(group.positions || []).map((position) => (
                      <Space key={position.id} direction="vertical" size={2}>
                        {position.preview_url ? (
                          <Image
                            src={position.preview_url}
                            alt={position.name}
                            width={64}
                            height={64}
                            preview={{ src: position.preview_url }}
                            style={{ objectFit: "contain", borderRadius: 6 }}
                          />
                        ) : (
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {position.preview_status === "failed"
                              ? tThumbnail("failed")
                              : position.preview_status === "not_applicable"
                                ? tThumbnail("notApplicable")
                                : tThumbnail("preparing")}
                          </Typography.Text>
                        )}
                        <Typography.Text>{position.name}</Typography.Text>
                        <OriginalDesignButton url={position.original_url} block />
                      </Space>
                    ))}
                  </Space>
                  <Space direction="vertical" size={4}>
                    <Typography.Text>
                      {t("fields.missingQuantity")}
                    </Typography.Text>
                    <InputNumber
                      min={1}
                      max={group.available_quantity}
                      precision={0}
                      disabled={!selected}
                      value={selected ? selections[group.group_key] : null}
                      onChange={(value) =>
                        setSelections((current) => ({
                          ...current,
                          [group.group_key]: Number(value || 1),
                        }))
                      }
                      style={{ width: "100%" }}
                    />
                  </Space>
                </div>
              </Card>
            );
          })
        ) : (
          <Empty description={t("messages.noGroups")} />
        )}
      </Space>
    </Modal>
  );
}
