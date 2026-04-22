"use client";

import {
  Descriptions,
  Divider,
  Empty,
  Form,
  Input,
  Modal,
  Space,
  Spin,
} from "antd";
import GooglePlacesAutocomplete from "@/components/common/forms/GooglePlacesAutocomplete";
import { useTranslations } from "@/i18n/use-translations";

const AddressEditorModal = ({
  open,
  loading,
  saving,
  onCancel,
  onSave,
  editForm,
  editingOrder,
  onAddressSelect,
  orderDateLabel,
  zIndex = 1300,
  showRecipientFields = false,
  showBillToName = true,
}) => {
  const t = useTranslations("dashboard.orders");
  const tCommonActions = useTranslations("common.actions");
  const hasOrder = Boolean(editingOrder);
  const safeOrderDate =
    orderDateLabel ??
    (editingOrder?.order_date ? editingOrder.order_date : t("common.none"));

  return (
    <Modal
      open={open}
      title={t("addressEditor.title")}
      onCancel={onCancel}
      onOk={onSave}
      okText={tCommonActions("save")}
      cancelText={tCommonActions("cancel")}
      confirmLoading={saving}
      width={820}
      destroyOnClose={false}
      zIndex={zIndex}
    >
      {loading ? (
        <div style={{ padding: "20px 0", textAlign: "center" }}>
          <Spin />
        </div>
      ) : hasOrder ? (
        <>
          <Descriptions
            size="small"
            column={2}
            style={{ marginTop: 12 }}
            title={t("addressEditor.sections.order")}
          >
            <Descriptions.Item label={t("columns.orderNumber")}>
              {editingOrder?.order_number || t("common.none")}
            </Descriptions.Item>
            <Descriptions.Item label={t("columns.orderDate")}>
              {safeOrderDate}
            </Descriptions.Item>
            <Descriptions.Item label={t("columns.customerName")}>
              {editingOrder?.bill_to_name || t("common.none")}
            </Descriptions.Item>
          </Descriptions>
          <Divider />
          <Form layout="vertical" form={editForm}>
            {showBillToName ? (
              <Form.Item
                label={t("addressEditor.fields.billToName")}
                name="bill_to_name"
                rules={[
                  {
                    required: true,
                    message: t("addressEditor.validation.required", {
                      field: t("addressEditor.fields.billToName"),
                    }),
                  },
                ]}
              >
                <Input placeholder={t("addressEditor.placeholders.billToName")} />
              </Form.Item>
            ) : null}
            {showRecipientFields ? (
              <Space align="start" size="middle" style={{ width: "100%" }} wrap>
                <Form.Item
                  label={t("detail.fields.shipToName")}
                  name="ship_to_name"
                  style={{ flex: 1, minWidth: 180 }}
                >
                  <Input placeholder={t("detail.fields.shipToName")} />
                </Form.Item>
                <Form.Item
                  label={t("detail.fields.shipToCompany")}
                  name="ship_to_company"
                  style={{ flex: 1, minWidth: 180 }}
                >
                  <Input placeholder={t("detail.fields.shipToCompany")} />
                </Form.Item>
                <Form.Item
                  label={t("detail.fields.shipToPhone")}
                  name="ship_to_phone"
                  style={{ flex: 1, minWidth: 180 }}
                >
                  <Input placeholder={t("detail.fields.shipToPhone")} />
                </Form.Item>
              </Space>
            ) : null}
            <Form.Item label={t("addressEditor.fields.searchAddress")}>
              <GooglePlacesAutocomplete
                placeholder={t("addressEditor.placeholders.searchAddress")}
                onPlaceSelect={onAddressSelect}
              />
            </Form.Item>
            <Form.Item
              label={t("addressEditor.fields.street1")}
              name="ship_to_street1"
              rules={[
                {
                  required: true,
                  message: t("addressEditor.validation.required", {
                    field: t("addressEditor.fields.street1"),
                  }),
                },
              ]}
            >
              <Input placeholder={t("addressEditor.placeholders.street1")} />
            </Form.Item>
            <Form.Item
              label={t("addressEditor.fields.street2")}
              name="ship_to_street2"
            >
              <Input placeholder={t("addressEditor.placeholders.street2")} />
            </Form.Item>
            <Form.Item
              label={t("addressEditor.fields.street3")}
              name="ship_to_street3"
            >
              <Input placeholder={t("addressEditor.placeholders.street3")} />
            </Form.Item>
            <Space align="start" size="middle" style={{ width: "100%" }} wrap>
              <Form.Item
                label={t("addressEditor.fields.city")}
                name="ship_to_city"
                style={{ flex: 1, minWidth: 180 }}
                rules={[
                  {
                    required: true,
                    message: t("addressEditor.validation.required", {
                      field: t("addressEditor.fields.city"),
                    }),
                  },
                ]}
              >
                <Input placeholder={t("addressEditor.placeholders.city")} />
              </Form.Item>
              <Form.Item
                label={t("addressEditor.fields.state")}
                name="ship_to_state"
                style={{ flex: 1, minWidth: 180 }}
                rules={[
                  {
                    required: true,
                    message: t("addressEditor.validation.required", {
                      field: t("addressEditor.fields.state"),
                    }),
                  },
                ]}
              >
                <Input placeholder={t("addressEditor.placeholders.state")} />
              </Form.Item>
              <Form.Item
                label={t("addressEditor.fields.postalCode")}
                name="ship_to_postal_code"
                style={{ flex: 1, minWidth: 180 }}
                rules={[
                  {
                    required: true,
                    message: t("addressEditor.validation.required", {
                      field: t("addressEditor.fields.postalCode"),
                    }),
                  },
                ]}
              >
                <Input placeholder={t("addressEditor.placeholders.postalCode")} />
              </Form.Item>
              <Form.Item
                label={t("addressEditor.fields.country")}
                name="ship_to_country"
                style={{ flex: 1, minWidth: 180 }}
                rules={[
                  {
                    required: true,
                    message: t("addressEditor.validation.required", {
                      field: t("addressEditor.fields.country"),
                    }),
                  },
                ]}
              >
                <Input placeholder={t("addressEditor.placeholders.country")} />
              </Form.Item>
            </Space>
            <Space align="start" size="middle" style={{ width: "100%" }} wrap />
          </Form>
        </>
      ) : (
        <Empty description={t("addressEditor.messages.noItemFound")} />
      )}
    </Modal>
  );
};

export default AddressEditorModal;
