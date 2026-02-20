"use client";

import { useMemo } from "react";
import { Modal, Space, Table, Typography } from "antd";

const defaultLabels = {
  summary: "Summary",
  row: "Row",
  field: "Field",
  value: "Value",
  message: "Message",
  noErrors: "No errors found",
};

const parseErrors = (result) => {
  const errors = Array.isArray(result?.errors) ? result.errors : [];
  return errors.map((error, index) => {
    if (typeof error === "string") {
      return {
        key: `${index}`,
        row: "-",
        field: "-",
        value: "-",
        message: error,
      };
    }

    return {
      key: `${index}`,
      row:
        error?.rowNumber ??
        error?.row ??
        error?.row_number ??
        error?.line ??
        error?.lineNumber ??
        error?.index ??
        "-",
      field: error?.field ?? error?.column ?? error?.key ?? "-",
      value: error?.value ?? "-",
      message: error?.message ?? error?.error ?? "-",
    };
  });
};

const defaultSummaryBuilder = (result) => {
  if (!result) return "";
  const total = result?.total ?? 0;
  const created = result?.created ?? 0;
  const updated = result?.updated ?? 0;
  const failed = result?.failed ?? 0;
  return `Total: ${total}, Created: ${created}, Updated: ${updated}, Failed: ${failed}`;
};

const ImportResultModal = ({
  open,
  result,
  onClose,
  title = "Import Result",
  width = 860,
  labels,
  summaryBuilder = defaultSummaryBuilder,
  errorColumns,
  tableProps,
  modalProps,
}) => {
  const resolvedLabels = { ...defaultLabels, ...(labels || {}) };
  const parsedErrors = useMemo(() => parseErrors(result), [result]);
  const summaryText = useMemo(
    () => summaryBuilder?.(result) ?? "",
    [result, summaryBuilder]
  );

  const columns = useMemo(() => {
    if (errorColumns) return errorColumns;
    return [
      {
        title: resolvedLabels.row,
        dataIndex: "row",
        key: "row",
        width: 120,
      },
      {
        title: resolvedLabels.field,
        dataIndex: "field",
        key: "field",
        width: 180,
      },
      {
        title: resolvedLabels.value,
        dataIndex: "value",
        key: "value",
        width: 200,
      },
      {
        title: resolvedLabels.message,
        dataIndex: "message",
        key: "message",
      },
    ];
  }, [
    errorColumns,
    resolvedLabels.field,
    resolvedLabels.message,
    resolvedLabels.row,
    resolvedLabels.value,
  ]);

  const { onCancel: modalOnCancel, ...restModalProps } = modalProps ?? {};
  const handleCancel = (...args) => {
    modalOnCancel?.(...args);
    onClose?.(...args);
  };

  const mergedTableProps = {
    pagination: { pageSize: 6 },
    size: "small",
    ...tableProps,
  };

  return (
    <Modal
      open={open}
      title={title}
      width={width}
      footer={null}
      onCancel={handleCancel}
      destroyOnHidden
      {...restModalProps}
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        {summaryText ? (
          <Typography.Text>{summaryText}</Typography.Text>
        ) : null}
        {parsedErrors.length > 0 ? (
          <Table
            columns={columns}
            dataSource={parsedErrors}
            {...mergedTableProps}
          />
        ) : (
          <Typography.Text type="secondary">
            {resolvedLabels.noErrors}
          </Typography.Text>
        )}
      </Space>
    </Modal>
  );
};

export default ImportResultModal;
