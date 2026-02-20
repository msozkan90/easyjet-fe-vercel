"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Divider,
  Form,
  Input,
  Modal,
  Select,
  Switch,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useTranslations } from "@/i18n/use-translations";
import { SubCategoriesAPI } from "@/utils/api";
import { fetchGenericList } from "@/utils/fetchGenericList";

export default function ProductForm({
  initialValues,
  onFinish,
  submitText,
  categories = [],
}) {
  const [form] = Form.useForm();
  const [manageForm] = Form.useForm();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [modalApi, modalContextHolder] = Modal.useModal();
  const tCommon = useTranslations("forms.common");
  const tForm = useTranslations("forms.product");
  const tStatus = useTranslations("common.status");
  const tActions = useTranslations("common.actions");
  const submitButtonLabel = submitText || tCommon("buttons.save");

  const [subCategories, setSubCategories] = useState([]);
  const [subCategoriesLoading, setSubCategoriesLoading] = useState(false);
  const [creatingSubCategory, setCreatingSubCategory] = useState(false);
  const [subCategorySearch, setSubCategorySearch] = useState("");
  const [createOptional, setCreateOptional] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [editingSubCategory, setEditingSubCategory] = useState(null);
  const [manageSubmitting, setManageSubmitting] = useState(false);

  const previousCategoryIdRef = useRef();
  const categoryId = Form.useWatch("category_id", form);

  const categoryLabel = useMemo(() => {
    if (!categoryId) return "";
    const match = categories.find((item) => item.id === categoryId);
    return match?.name ?? "";
  }, [categories, categoryId]);

  const normalizeItemResponse = useCallback((resp) => {
    const payload = resp?.data ?? resp;
    if (payload?.data) return payload.data;
    if (payload?.item) return payload.item;
    return payload;
  }, []);

  useEffect(() => {
    if (!categoryId) {
      setSubCategories([]);
      setSubCategorySearch("");
      previousCategoryIdRef.current = undefined;
      form.setFieldsValue({ sub_category_id: undefined });
      return;
    }

    if (
      previousCategoryIdRef.current &&
      previousCategoryIdRef.current !== categoryId
    ) {
      form.setFieldsValue({ sub_category_id: undefined });
    }
    previousCategoryIdRef.current = categoryId;

    let alive = true;
    const fetchSubCategories = async () => {
      setSubCategoriesLoading(true);
      try {
        const list = await fetchGenericList("sub_category", {
          filters: { category_id: categoryId },
        });
        if (!alive) return;
        const nextList = Array.isArray(list)
          ? list.filter((item) => item && typeof item === "object")
          : [];
        setSubCategories(nextList);
      } catch {
        if (alive) {
          messageApi.error(tForm("messages.subCategoryLoadError"));
        }
      } finally {
        if (alive) setSubCategoriesLoading(false);
      }
    };

    fetchSubCategories();

    return () => {
      alive = false;
    };
  }, [categoryId, form, messageApi, tForm]);

  const confirmModal = useCallback(
    ({ title, content, okText }) =>
      new Promise((resolve) => {
        modalApi.confirm({
          title,
          content,
          centered: true,
          okText: okText || tCommon("buttons.save"),
          cancelText: tCommon("buttons.cancel"),
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      }),
    [modalApi, tCommon]
  );

  const handleCreateSubCategory = useCallback(
    async (name, { resetSearch = true, optional = false } = {}) => {
      const trimmed = name?.trim();
      if (!trimmed) return null;
      if (!categoryId) {
        messageApi.warning(tForm("messages.subCategoryCreateNoCategory"));
        return null;
      }

      const existing = subCategories.find(
        (item) => item?.name?.toLowerCase() === trimmed.toLowerCase()
      );
      if (existing) {
        form.setFieldsValue({ sub_category_id: existing.id });
        messageApi.info(
          tForm("messages.subCategoryAlreadyExists", { name: existing.name })
        );
        if (resetSearch) setSubCategorySearch("");
        return existing;
      }

      const confirmed = await confirmModal({
        title: tForm("confirms.createTitle", { name: trimmed }),
        content: tForm("confirms.createContent", {
          name: trimmed,
          category:
            categoryLabel || tForm("messages.subCategoryUnknownCategory"),
        }),
      });
      if (!confirmed) return null;

      setCreatingSubCategory(true);
      try {
        const resp = await SubCategoriesAPI.create({
          name: trimmed,
          category_id: categoryId,
          optional: optional ?? false,
        });
        const item = normalizeItemResponse(resp);
        if (!item?.id) {
          throw new Error("Missing id");
        }
        setSubCategories((prev) => {
          const list = Array.isArray(prev) ? [...prev] : [];
          const existsAlready = list.some((entry) => entry.id === item.id);
          if (existsAlready) return list;
          return [...list, { ...item, optional: item.optional ?? optional }];
        });
        form.setFieldsValue({ sub_category_id: item.id });
        messageApi.success(tForm("messages.subCategoryCreateSuccess"));
        if (resetSearch) setSubCategorySearch("");
        return item;
      } catch {
        messageApi.error(tForm("messages.subCategoryCreateError"));
        return null;
      } finally {
        setCreatingSubCategory(false);
      }
    },
    [
      categoryId,
      categoryLabel,
      confirmModal,
      form,
      messageApi,
      normalizeItemResponse,
      subCategories,
      tForm,
    ]
  );

  const sortedSubCategories = useMemo(() => {
    const list = Array.isArray(subCategories) ? [...subCategories] : [];
    return list.sort((a, b) =>
      (a?.name ?? "").localeCompare(b?.name ?? "", undefined, {
        sensitivity: "base",
      })
    );
  }, [subCategories]);

  const subCategoryOptions = useMemo(
    () =>
      sortedSubCategories.map((subCategory) => ({
        value: subCategory.id,
        label: subCategory.name,
      })),
    [sortedSubCategories]
  );

  const trimmedSearch = subCategorySearch.trim();
  const createButtonLabel = trimmedSearch
    ? tForm(
        subCategories.some(
          (item) => item?.name?.toLowerCase() === trimmedSearch.toLowerCase()
        )
          ? "helpers.subCategoryExisting"
          : "actions.createSubCategory",
        { name: trimmedSearch }
      )
    : tForm("actions.createSubCategoryPlaceholder");
  const createButtonDisabled = !categoryId || !trimmedSearch;

  useEffect(() => {
    if (!initialValues) return;
    const initialCategoryId =
      initialValues?.category_id ?? initialValues?.category?.id;
    if (initialCategoryId && categoryId && initialCategoryId !== categoryId)
      return;

    const initialSubCategoryId =
      initialValues?.sub_category_id ?? initialValues?.sub_category?.id;
    const initialSubCategoryName =
      initialValues?.sub_category?.name ??
      initialValues?.sub_category_name ??
      initialValues?.sub_categoryLabel ??
      initialValues?.sub_category ??
      "";

    if (!initialSubCategoryId || !initialSubCategoryName) return;

    setSubCategories((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      if (list.some((item) => item?.id === initialSubCategoryId)) return list;
      return [
        ...list,
        { id: initialSubCategoryId, name: initialSubCategoryName },
      ];
    });
  }, [categoryId, initialValues]);

  useEffect(() => {
    if (!initialValues) return;
    const initialSubCategoryId =
      initialValues?.sub_category_id ?? initialValues?.sub_category?.id;
    if (!initialSubCategoryId) return;
    const currentValue = form.getFieldValue("sub_category_id");
    if (currentValue !== undefined && currentValue !== null) return;
    form.setFieldsValue({ sub_category_id: initialSubCategoryId });
  }, [form, initialValues, subCategories]);

  useEffect(() => {
    if (!manageModalOpen) return;
    if (editingSubCategory) {
      manageForm.setFieldsValue({
        name: editingSubCategory.name,
        optional: !!editingSubCategory.optional,
      });
    } else {
      manageForm.resetFields();
    }
  }, [editingSubCategory, manageForm, manageModalOpen]);

  const handleOpenManageModal = useCallback(() => {
    if (!categoryId) {
      messageApi.warning(tForm("messages.subCategoryManageNoCategory"));
      return;
    }
    setManageModalOpen(true);
    setEditingSubCategory(null);
  }, [categoryId, messageApi, tForm]);

  const handleCloseManageModal = useCallback(() => {
    setManageModalOpen(false);
    setEditingSubCategory(null);
    manageForm.resetFields();
  }, [manageForm]);

  useEffect(() => {
    if (!categoryId) {
      handleCloseManageModal();
    }
  }, [categoryId, handleCloseManageModal]);

  const handleManageSubmit = useCallback(async () => {
    if (!categoryId) {
      messageApi.warning(tForm("messages.subCategoryManageNoCategory"));
      return;
    }

    try {
      const values = await manageForm.validateFields();
      const trimmed = values?.name?.trim();
      if (!trimmed) {
        manageForm.setFieldsValue({ name: trimmed });
        return;
      }

      if (!editingSubCategory) {
        const created = await handleCreateSubCategory(trimmed, {
          resetSearch: false,
          optional: values?.optional ?? false,
        });
        if (!created) return;
        manageForm.resetFields();
        setEditingSubCategory(null);
        return;
      }

      const existing = subCategories.find(
        (item) =>
          item?.id !== editingSubCategory.id &&
          item?.name?.toLowerCase() === trimmed.toLowerCase()
      );
      if (existing) {
        form.setFieldsValue({ sub_category_id: existing.id });
        messageApi.info(
          tForm("messages.subCategoryAlreadyExists", { name: existing.name })
        );
        setEditingSubCategory(null);
        manageForm.resetFields();
        return;
      }

      const confirmed = await confirmModal({
        title: tForm("confirms.updateTitle", { name: trimmed }),
        content: tForm("confirms.updateContent", {
          name: trimmed,
          category:
            categoryLabel || tForm("messages.subCategoryUnknownCategory"),
        }),
        okText: tCommon("buttons.save"),
      });
      if (!confirmed) return;

      setManageSubmitting(true);
      try {
        const resp = await SubCategoriesAPI.update(editingSubCategory.id, {
          name: trimmed,
          category_id: categoryId,
          optional: values?.optional ?? false,
        });
        const updated = normalizeItemResponse(resp) ?? {
          ...editingSubCategory,
          name: trimmed,
          optional: values?.optional ?? false,
        };
        setSubCategories((prev) => {
          const list = Array.isArray(prev) ? [...prev] : [];
          const index = list.findIndex((item) => item.id === updated.id);
          if (index >= 0) {
            list[index] = {
              ...list[index],
              name: updated.name ?? trimmed,
              optional: updated.optional ?? values?.optional ?? false,
            };
          }
          return list;
        });
        if (form.getFieldValue("sub_category_id") === editingSubCategory.id) {
          form.setFieldsValue({ sub_category_id: editingSubCategory.id });
        }
        messageApi.success(tForm("messages.subCategoryUpdateSuccess"));
        setEditingSubCategory(null);
        manageForm.resetFields();
      } catch {
        messageApi.error(tForm("messages.subCategoryUpdateError"));
      } finally {
        setManageSubmitting(false);
      }
    } catch {
      // handled by antd form validation
    }
  }, [
    categoryId,
    categoryLabel,
    confirmModal,
    form,
    handleCreateSubCategory,
    manageForm,
    messageApi,
    normalizeItemResponse,
    editingSubCategory,
    subCategories,
    tCommon,
    tForm,
  ]);

  return (
    <>
      {messageContextHolder}
      {modalContextHolder}
      <Form
        form={form}
        layout="vertical"
        initialValues={{ status: "active", ...(initialValues || {}) }}
        onFinish={onFinish}
      >
        <Form.Item
          name="name"
          label={tForm("labels.name")}
          rules={[
            {
              required: true,
              message: tCommon("validation.required", {
                field: tForm("labels.name"),
              }),
            },
          ]}
        >
          <Input placeholder={tForm("placeholders.name")} />
        </Form.Item>

        <Form.Item
          name="category_id"
          label={tForm("labels.category")}
          rules={[
            {
              required: true,
              message: tCommon("validation.required", {
                field: tForm("labels.category"),
              }),
            },
          ]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder={tCommon("placeholders.selectCategories")}
            options={categories.map((category) => ({
              value: category.id,
              label: category.name,
            }))}
          />
        </Form.Item>

        <Form.Item name="sub_category_id" label={tForm("labels.subCategory")}>
          <Select
            disabled={!categoryId}
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={tForm("placeholders.subCategory")}
            loading={subCategoriesLoading || creatingSubCategory}
            options={subCategoryOptions}
            onSearch={(value) => setSubCategorySearch(value ?? "")}
            onClear={() => setSubCategorySearch("")}
            onOpenChange={(open) => {
              if (!open) {
                setSubCategorySearch("");
              }
            }}
            onChange={() => setSubCategorySearch("")}
            onInputKeyDown={(event) => {
              if (event.key !== "Enter") return;
              const value = subCategorySearch.trim();
              if (!value) return;
              event.preventDefault();
              event.stopPropagation();
              handleCreateSubCategory(value, { optional: createOptional });
            }}
            filterOption={(input, option) =>
              (option?.label ?? "")
                .toString()
                .toLowerCase()
                .includes(input.toLowerCase())
            }
            popupRender={(menu) => (
              <div>
                {menu}
                <Divider style={{ margin: "4px 0" }} />
                <div className="px-3 py-2">
                  <Typography.Text
                    type="secondary"
                    style={{ fontSize: 12, display: "block" }}
                  >
                    {categoryId
                      ? tForm("helpers.subCategoryHint")
                      : tForm("helpers.subCategoryHintNoCategory")}
                  </Typography.Text>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <Typography.Text style={{ fontSize: 12 }}>
                      {tForm("labels.subCategoryOptional")}
                    </Typography.Text>
                    <Switch
                      size="small"
                      checked={createOptional}
                      onChange={setCreateOptional}
                    />
                  </div>
                  <Typography.Text
                    type="secondary"
                    style={{ fontSize: 12, display: "block", marginTop: 4 }}
                  >
                    {tForm("helpers.subCategoryOptionalHint")}
                  </Typography.Text>
                </div>
                <div className="px-2 pb-2 space-y-2">
                  <Button
                    block
                    type="text"
                    icon={<PlusOutlined />}
                    disabled={createButtonDisabled}
                    loading={creatingSubCategory}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      const value = subCategorySearch.trim();
                      if (!value) return;
                      handleCreateSubCategory(value, {
                        optional: createOptional,
                      });
                    }}
                  >
                    {createButtonLabel}
                  </Button>
                  <Button
                    block
                    disabled={!categoryId}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={handleOpenManageModal}
                  >
                    {tForm("actions.manageSubCategories")}
                  </Button>
                </div>
              </div>
            )}
          />
        </Form.Item>

        <Form.Item
          name="status"
          label={tForm("labels.status")}
          rules={[
            {
              required: true,
              message: tCommon("validation.required", {
                field: tForm("labels.status"),
              }),
            },
          ]}
        >
          <Select
            placeholder={tCommon("placeholders.selectStatus")}
            options={[
              { value: "active", label: tStatus("active") },
              { value: "inactive", label: tStatus("inactive") },
            ]}
          />
        </Form.Item>

        <Form.Item className="mb-0">
          <button
            type="submit"
            className="w-full rounded-md px-4 py-2 bg-blue-600 text-white transition hover:bg-blue-700"
          >
            {submitButtonLabel}
          </button>
        </Form.Item>
      </Form>

      <Modal
        open={manageModalOpen}
        onCancel={handleCloseManageModal}
        footer={null}
        title={tForm("manageModal.title", {
          category:
            categoryLabel || tForm("messages.subCategoryUnknownCategory"),
        })}
      >
        <Form
          form={manageForm}
          layout="vertical"
          initialValues={{ optional: false }}
          onFinish={handleManageSubmit}
        >
          <Form.Item
            name="name"
            label={tForm("labels.subCategory")}
            rules={[
              {
                required: true,
                message: tCommon("validation.required", {
                  field: tForm("labels.subCategory"),
                }),
              },
            ]}
          >
            <Input placeholder={tForm("placeholders.subCategory")} />
          </Form.Item>
          <Form.Item
            name="optional"
            valuePropName="checked"
            label={tForm("labels.subCategoryOptional")}
          >
            <Switch />
          </Form.Item>
          <Space className="w-full justify-end">
            <Button onClick={handleCloseManageModal}>
              {tCommon("buttons.cancel")}
            </Button>
            <Button type="primary" htmlType="submit" loading={manageSubmitting}>
              {editingSubCategory
                ? tForm("actions.saveSubCategory")
                : tForm("actions.newSubCategory")}
            </Button>
          </Space>
        </Form>

        <Divider />

        {sortedSubCategories.length ? (
          <div className="space-y-2 max-h-60 overflow-auto">
            {sortedSubCategories.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded border border-gray-200 px-2 py-1"
              >
                <Space size="small">
                  <Typography.Text>{item.name}</Typography.Text>
                  {item.optional ? (
                    <Tag color="blue">{tForm("labels.optional")}</Tag>
                  ) : null}
                </Space>
                <Space>
                  <Button
                    size="small"
                    onClick={() => setEditingSubCategory(item)}
                  >
                    {tActions("edit")}
                  </Button>
                </Space>
              </div>
            ))}
          </div>
        ) : (
          <Typography.Text type="secondary">
            {tForm("manageModal.empty")}
          </Typography.Text>
        )}
      </Modal>
    </>
  );
}
