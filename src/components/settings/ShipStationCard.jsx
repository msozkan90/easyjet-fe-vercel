"use client";

import { useMemo } from "react";
import {
  Card,
  Tabs,
  Space,
  Skeleton,
  Empty,
  Form,
  Input,
  Select,
  Button,
  Typography,
} from "antd";
import {
  SafetyCertificateOutlined,
  CheckCircleTwoTone,
  SaveOutlined,
  CloseOutlined,
  EditOutlined,
} from "@ant-design/icons";

const { Text } = Typography;

export default function ShipStationCard({
  form,
  credential,
  isEditing,
  loading,
  storeList,
  onEdit,
  onCancel,
  onSave,
  onVerify,
  tProfile,
  tCommon,
  tForms,
  sources,
  activeSourceId,
  onSourceChange,
  tabsLoading,
  onValuesChange,
  formatSourceLabel,
  activeSourceLabel,
  activeSourceFields,
  hasApiKeyField,
  hasApiSecretField,
  shouldShowStoreId,
  canVerify,
  isShipstation,
}) {
  const isSaving = loading.ship_save;
  const isFetching = loading.ship_fetch;
  const isVerifying = loading.ship_verify;

  const tabItems = useMemo(
    () =>
      (sources || []).map((source) => ({
        key: String(source.id),
        label: (
          <Space size={8} align="center">
            {source.config?.logo && (
              <img
                src={source.config.logo}
                alt={source.name}
                className="h-8 w-8 object-contain"
              />
            )}
            <span>{formatSourceLabel(source)}</span>
          </Space>
        ),
      })),
    [formatSourceLabel, sources]
  );

  const renderFieldLabel = (field) => field?.label || field?.key || "";

  const buildFieldRules = (field) => {
    const rules = [];
    if (field?.required && !credential) {
      rules.push({
        required: true,
        message: tFormsRequired(tForms, renderFieldLabel(field)),
      });
    }
    if (field?.key === "api_key" && credential && hasApiSecretField) {
      rules.push(({ getFieldValue }) => ({
        validator(_, value) {
          const masked = credential?.api_key_mask || "";
          const keyProvided = !!value && value !== masked;
          const secretProvided = !!getFieldValue("api_secret");
          if (keyProvided !== secretProvided) {
            return Promise.reject(
              new Error(tProfile("messages.apiPairRequired"))
            );
          }
          return Promise.resolve();
        },
      }));
    }
    if (field?.key === "api_secret" && credential && hasApiKeyField) {
      rules.push(({ getFieldValue }) => ({
        validator(_, value) {
          const masked = credential?.api_key_mask || "";
          const keyProvided =
            !!getFieldValue("api_key") && getFieldValue("api_key") !== masked;
          const secretProvided = !!value;
          if (keyProvided !== secretProvided) {
            return Promise.reject(
              new Error(tProfile("messages.apiPairRequired"))
            );
          }
          return Promise.resolve();
        },
      }));
    }
    return rules;
  };

  const cardTitle = (
    <Space>
      <SafetyCertificateOutlined />
      <span>{activeSourceLabel || tProfile("shipStation.title")}</span>
    </Space>
  );

  const activeKey = activeSourceId || tabItems[0]?.key;

  return (
    <Card
      title={cardTitle}
      extra={<Text type="secondary">{tProfile("shipStation.subtitle")}</Text>}
      className="shadow-sm"
    >
      {tabItems.length > 0 && (
        <Tabs
          activeKey={activeKey}
          onChange={onSourceChange}
          items={tabItems}
          type="card"
          size="large"
          className="mb-4"
        />
      )}

      {tabsLoading ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : !tabItems.length ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={tProfile("shipStation.subtitle")}
        />
      ) : !activeSourceId ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={tProfile("shipStation.subtitle")}
        />
      ) : isFetching ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : (
        <Form form={form} layout="vertical" onValuesChange={onValuesChange}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeSourceFields.map((field) => {
              const deps =
                field.key === "api_key"
                  ? ["api_secret"]
                  : field.key === "api_secret"
                  ? ["api_key"]
                  : undefined;
              return (
                <Form.Item
                  key={field.key}
                  name={field.key}
                  label={renderFieldLabel(field)}
                  rules={buildFieldRules(field)}
                  dependencies={deps}
                >
                  {field.secret ? (
                    <Input.Password
                      disabled={!isEditing}
                      placeholder={renderFieldLabel(field)}
                    />
                  ) : (
                    <Input
                      disabled={!isEditing}
                      placeholder={renderFieldLabel(field)}
                    />
                  )}
                </Form.Item>
              );
            })}

            <Form.Item name="label" label={tProfile("shipStation.labels.label")}>
              <Input
                disabled={!isEditing}
                placeholder={tProfile("shipStation.placeholders.label")}
              />
            </Form.Item>

            {shouldShowStoreId && (
              <Form.Item
                name="store_id"
                label={tProfile("shipStation.labels.storeId")}
                rules={[
                  {
                    required: !credential,
                    message: tProfile("messages.storeIdRequired"),
                  },
                ]}
                tooltip={tProfile("shipStation.tooltip.storeId")}
              >
                <Select
                  disabled={!isEditing || !!credential}
                  options={(storeList || []).map((store) => ({
                    value: store.storeId?.toString(),
                    label: `${store.storeName} - ${store.marketplaceName}`,
                  }))}
                  placeholder={
                    credential
                      ? tProfile("shipStation.placeholders.storeId.edit")
                      : tProfile("shipStation.placeholders.storeId.create")
                  }
                />
              </Form.Item>
            )}

            {canVerify && (
              <Form.Item label=" " colon={false}>
                <Button
                  type="primary"
                  onClick={() => onVerify?.(activeSourceId)}
                  loading={isVerifying}
                  icon={<CheckCircleTwoTone twoToneColor="#52c41a" />}
                >
                  {tProfile("shipStation.buttons.verify")}
                </Button>
              </Form.Item>
            )}
          </div>

          {credential && (
            <div className="text-xs text-gray-500 mt-1">
              <div>
                <Text strong>{tProfile("shipStation.labels.createdAt")}:</Text>{" "}
                {credential.created_at
                  ? new Date(credential.created_at).toLocaleString()
                  : "-"}
              </div>
              <div>
                <Text strong>{tProfile("shipStation.labels.lastUsed")}:</Text>{" "}
                {credential.last_used_at
                  ? new Date(credential.last_used_at).toLocaleString()
                  : "-"}
              </div>
            </div>
          )}

          <Space className="justify-end w/full mt-3">
            {!credential ? (
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={() => onSave?.(activeSourceId)}
                loading={isSaving}
              >
                {tCommon("actions.save")}
              </Button>
            ) : isEditing ? (
              <Space>
                <Button
                  icon={<CloseOutlined />}
                  onClick={() => onCancel?.(activeSourceId)}
                >
                  {tCommon("actions.cancel")}
                </Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={() => onSave?.(activeSourceId)}
                  loading={isSaving}
                >
                  {tCommon("actions.save")}
                </Button>
              </Space>
            ) : (
              <Button
                icon={<EditOutlined />}
                onClick={() => onEdit?.(activeSourceId)}
              >
                {tProfile("shipStation.buttons.edit")}
              </Button>
            )}
          </Space>

          {isShipstation && (
            <div className="mt-3">
              <Text type="secondary">{tProfile("shipStation.note")}</Text>
            </div>
          )}
        </Form>
      )}
    </Card>
  );
}

function tFormsRequired(tForms, fieldLabel) {
  return tForms("validation.required", { field: fieldLabel });
}
