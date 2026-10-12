// src/app/(dashboard)/dashboard/profile/page.js
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  Avatar,
  Typography,
  Form,
  Input,
  Button,
  App as AntdApp,
  Upload,
  Tooltip,
  Skeleton,
} from "antd";
import {
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { AuthAPI, ProfileAPI } from "@/utils/api";
import { setUser } from "@/redux/features/authSlice";
import { useTranslations } from "@/i18n/use-translations";
import PageHeader from "@/components/ui/PageHeader";
import StatusTag from "@/components/ui/StatusTag";
import FormActions from "@/components/ui/FormActions";
import { palette } from "@/theme/tokens";

const { Text } = Typography;

const INITIAL_LOADING_STATE = {
  me: true,
  info: false,
  pwd: false,
  avatar: false,
};

function translateOrFallback(translator, key, fallback) {
  const value = translator(key);
  return value === key ? fallback : value;
}

export default function ProfilePage() {
  const { message } = AntdApp.useApp();
  const dispatch = useDispatch();

  const tProfile = useTranslations("dashboard.profile");
  const tCommon = useTranslations("common");
  const tNavbar = useTranslations("common.navbar");
  const tForms = useTranslations("forms.common");

  const user = useSelector((state) => state.auth.user);

  const [infoForm] = Form.useForm();
  const [pwdForm] = Form.useForm();
  const [loading, setLoading] = useState({
    ...INITIAL_LOADING_STATE,
    me: !user,
  });

  const userRoles = useMemo(
    () => user?.roles || user?.role?.name || [],
    [user]
  );
  const normalizedRoles = useMemo(() => {
    if (Array.isArray(userRoles)) {
      return userRoles;
    }
    return userRoles ? [userRoles] : [];
  }, [userRoles]);

  const setLoadingFlag = useCallback((key, value) => {
    setLoading((prev) => ({ ...prev, [key]: value }));
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await AuthAPI.me();
    dispatch(setUser(me));
    return me;
  }, [dispatch]);

  const translatedRoles = useMemo(() => {
    if (!normalizedRoles.length) {
      return [tProfile("roles.fallback")];
    }
    return normalizedRoles.map((role) =>
      translateOrFallback(tProfile, `roles.${role}`, role)
    );
  }, [normalizedRoles, tProfile]);

  useEffect(() => {
    let canceled = false;
    if (user) {
      setLoadingFlag("me", false);
      return;
    }

    (async () => {
      try {
        const me = await AuthAPI.me();
        if (!canceled) {
          dispatch(setUser(me));
        }
      } finally {
        if (!canceled) {
          setLoadingFlag("me", false);
        }
      }
    })();

    return () => {
      canceled = true;
    };
  }, [user, dispatch, setLoadingFlag]);

  useEffect(() => {
    if (user) {
      infoForm.setFieldsValue({
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        mobile_phone: user.mobile_phone,
      });
    }
  }, [user, infoForm]);

  const uploadProps = useMemo(
    () => ({
      name: "file",
      showUploadList: false,
      beforeUpload: (file) => {
        const isSupportedType = [
          "image/png",
          "image/jpeg",
          "image/jpg",
          "image/webp",
        ].includes(file.type);
        if (!isSupportedType) {
          message.error(tProfile("messages.avatarTypeError"));
          return Upload.LIST_IGNORE;
        }

        const isUnderLimit = file.size / 1024 / 1024 < 5;
        if (!isUnderLimit) {
          message.error(tProfile("messages.avatarSizeError"));
          return Upload.LIST_IGNORE;
        }
        return true;
      },
      customRequest: async ({ file, onSuccess, onError }) => {
        setLoadingFlag("avatar", true);
        try {
          await ProfileAPI.uploadAvatar(file);
          await refreshUser();
          onSuccess?.({});
          message.success(tProfile("messages.avatarUploadSuccess"));
        } catch (error) {
          onError?.(error);
          message.error(tProfile("messages.avatarUploadError"));
        } finally {
          setLoadingFlag("avatar", false);
        }
      },
    }),
    [message, tProfile, refreshUser, setLoadingFlag]
  );

  const handleSaveInfo = useCallback(async () => {
    try {
      const values = await infoForm.validateFields();
      setLoadingFlag("info", true);
      await ProfileAPI.update(user.id, {
        first_name: values.first_name,
        last_name: values.last_name,
        mobile_phone: values.mobile_phone,
      });
      await refreshUser();
      message.success(tProfile("messages.infoUpdateSuccess"));
    } finally {
      setLoadingFlag("info", false);
    }
  }, [infoForm, message, refreshUser, setLoadingFlag, tProfile, user?.id]);

  const handleChangePassword = useCallback(async () => {
    try {
      const { old_password, new_password, new_password_confirm } =
        await pwdForm.validateFields();
      if (new_password !== new_password_confirm) {
        message.error(tProfile("messages.passwordMismatch"));
        return;
      }
      setLoadingFlag("pwd", true);
      await ProfileAPI.changePassword({ old_password, new_password });
      pwdForm.resetFields();
      message.success(tProfile("messages.passwordUpdateSuccess"));
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message ||
          tProfile("messages.passwordUpdateError")
      );
    } finally {
      setLoadingFlag("pwd", false);
    }
  }, [pwdForm, message, tProfile, setLoadingFlag]);

  const infoLabels = useMemo(
    () => ({
      firstName: tProfile("info.fields.firstName.label"),
      lastName: tProfile("info.fields.lastName.label"),
      email: tProfile("info.fields.email.label"),
      mobile: tProfile("info.fields.mobile.label"),
    }),
    [tProfile]
  );

  const securityLabels = useMemo(
    () => ({
      current: tProfile("security.fields.current"),
      next: tProfile("security.fields.new"),
      confirm: tProfile("security.fields.confirm"),
    }),
    [tProfile]
  );

  return (
    <div className="grid gap-4">
      <PageHeader className="" title={tNavbar("profile")} />
      <ProfileHeader
        user={user}
        roles={translatedRoles}
        tProfile={tProfile}
        uploadProps={uploadProps}
        loadingAvatar={loading.avatar}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PersonalInfoCard
          form={infoForm}
          loading={loading.me}
          saving={loading.info}
          labels={infoLabels}
          tProfile={tProfile}
          tForms={tForms}
          tCommon={tCommon}
          onSave={handleSaveInfo}
        />
        <SecurityCard
          form={pwdForm}
          submitting={loading.pwd}
          labels={securityLabels}
          tProfile={tProfile}
          tForms={tForms}
          onSubmit={handleChangePassword}
        />
      </div>
    </div>
  );
}

function ProfileHeader({ user, roles, tProfile, uploadProps, loadingAvatar }) {
  const fullName = [user?.first_name, user?.last_name]
    .filter(Boolean)
    .join(" ");
  const initials = [user?.first_name, user?.last_name]
    .filter(Boolean)
    .map((part) => String(part).trim().charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <section className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-5 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <Avatar
          size={72}
          src={user?.avatar_url}
          icon={!user?.avatar_url && !initials ? <UserOutlined /> : undefined}
          style={{
            flexShrink: 0,
            background: palette.ink900,
            color: "#FFFFFF",
            fontSize: 24,
            fontWeight: 600,
          }}
        >
          {!user?.avatar_url ? initials : null}
        </Avatar>
        <div className="flex min-w-0 flex-col gap-2">
          <div className="truncate text-lg font-semibold text-text">
            {fullName || user?.email || "-"}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {roles.map((role) => (
              <StatusTag key={role} tone="info">
                {role}
              </StatusTag>
            ))}
            {user?.entity?.entity_name ? (
              <StatusTag tone="neutral">{user.entity.entity_name}</StatusTag>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-text-secondary">
            <span className="inline-flex items-center gap-1.5">
              <MailOutlined aria-hidden="true" />
              {user?.email || "-"}
            </span>
            {user?.mobile_phone ? (
              <span className="inline-flex items-center gap-1.5">
                <PhoneOutlined aria-hidden="true" />
                {user.mobile_phone}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <Upload {...uploadProps} disabled={loadingAvatar}>
        <Tooltip title={tProfile("header.uploadTooltip")}>
          <Button icon={<UploadOutlined />} loading={loadingAvatar}>
            {tProfile("buttons.changePhoto")}
          </Button>
        </Tooltip>
      </Upload>
    </section>
  );
}

function PersonalInfoCard({
  form,
  loading,
  saving,
  labels,
  tProfile,
  tForms,
  tCommon,
  onSave,
}) {
  return (
    <Card
      title={tProfile("info.title")}
      extra={<Text type="secondary">{tProfile("info.subtitle")}</Text>}
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        <Form form={form} layout="vertical">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Form.Item
              name="first_name"
              label={labels.firstName}
              rules={[
                {
                  required: true,
                  message: tForms("validation.required", {
                    field: labels.firstName,
                  }),
                },
              ]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="last_name"
              label={labels.lastName}
              rules={[
                {
                  required: true,
                  message: tForms("validation.required", {
                    field: labels.lastName,
                  }),
                },
              ]}
            >
              <Input />
            </Form.Item>
            <Form.Item name="email" label={labels.email}>
              <Input disabled />
            </Form.Item>
            <Form.Item name="mobile_phone" label={labels.mobile}>
              <Input placeholder={tProfile("info.fields.mobile.placeholder")} />
            </Form.Item>
          </div>
          <FormActions
            htmlType="button"
            onSubmit={onSave}
            loading={saving}
            submitText={tCommon("actions.save")}
          />
        </Form>
      )}
    </Card>
  );
}

function SecurityCard({
  form,
  submitting,
  labels,
  tProfile,
  tForms,
  onSubmit,
}) {
  return (
    <Card
      title={tProfile("security.title")}
      extra={<Text type="secondary">{tProfile("security.subtitle")}</Text>}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="old_password"
          label={labels.current}
          rules={[
            {
              required: true,
              message: tForms("validation.required", { field: labels.current }),
            },
          ]}
        >
          <Input.Password />
        </Form.Item>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Form.Item
            name="new_password"
            label={labels.next}
            rules={[
              {
                required: true,
                message: tForms("validation.required", { field: labels.next }),
              },
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="new_password_confirm"
            label={labels.confirm}
            rules={[
              {
                required: true,
                message: tForms("validation.required", {
                  field: labels.confirm,
                }),
              },
            ]}
          >
            <Input.Password />
          </Form.Item>
        </div>

        <FormActions
          htmlType="button"
          onCancel={() => form.resetFields()}
          cancelText={tProfile("security.actions.clear")}
          onSubmit={onSubmit}
          loading={submitting}
          submitText={tProfile("security.actions.update")}
        />
      </Form>
    </Card>
  );
}
