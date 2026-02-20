// src/app/(dashboard)/dashboard/profile/page.js
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  Avatar,
  Tag,
  Typography,
  Space,
  Form,
  Input,
  Button,
  Divider,
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

const { Title, Text } = Typography;

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
      <ProfileHeader
        user={user}
        roles={translatedRoles}
        tProfile={tProfile}
        uploadProps={uploadProps}
        loadingAvatar={loading.avatar}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
  return (
    <Card className="shadow-sm p-0 relative overflow-hidden !bg-gradient-to-r !from-indigo-500 !via-sky-500 !to-cyan-400">
      <div className="absolute left-6 bottom-6 flex flex-col items-center gap-2">
        <Avatar
          size={112}
          src={user?.avatar_url}
          icon={!user?.avatar_url && <UserOutlined />}
          className="shadow ring-4 ring-white bg-white"
        />
        <Upload {...uploadProps} disabled={loadingAvatar}>
          <Tooltip title={tProfile("header.uploadTooltip")}>
            <Button
              size="small"
              icon={<UploadOutlined />}
              loading={loadingAvatar}
            >
              {tProfile("buttons.changePhoto")}
            </Button>
          </Tooltip>
        </Upload>
      </div>

      <div className="px-6 pt-16 pb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="pl-36 md:pl-0 md:ml-36">
            <Title level={3} className="mb-1">
              {user?.first_name} {user?.last_name}
            </Title>
            <Space size="small" wrap>
              {roles.map((role) => (
                <Tag key={role} color="blue">
                  {role}
                </Tag>
              ))}
              {user?.entity?.entity_name && (
                <Tag color="geekblue">{user.entity.entity_name}</Tag>
              )}
            </Space>
          </div>

          <Space split={<Divider type="vertical" />} align="center" wrap>
            <Space>
              <MailOutlined />
              <Text>{user?.email}</Text>
            </Space>
            {user?.mobile_phone && (
              <Space>
                <PhoneOutlined />
                <Text>{user.mobile_phone}</Text>
              </Space>
            )}
          </Space>
        </div>
      </div>
    </Card>
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
      className="shadow-sm"
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
          <Space className="justify-end w/full">
            <Button type="primary" onClick={onSave} loading={saving}>
              {tCommon("actions.save")}
            </Button>
          </Space>
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
      className="shadow-sm"
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

        <Space className="justify-end w/full">
          <Button onClick={() => form.resetFields()}>
            {tProfile("security.actions.clear")}
          </Button>
          <Button type="primary" onClick={onSubmit} loading={submitting}>
            {tProfile("security.actions.update")}
          </Button>
        </Space>
      </Form>
    </Card>
  );
}
