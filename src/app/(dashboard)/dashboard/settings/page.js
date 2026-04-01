// src/app/(dashboard)/dashboard/settings/page.js
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Form, App as AntdApp } from "antd";
import { useDispatch, useSelector } from "react-redux";
import { AuthAPI, ShipStationAPI } from "@/utils/api";
import { setUser } from "@/redux/features/authSlice";
import { useTranslations } from "@/i18n/use-translations";
import RequireRole from "@/components/common/Access/RequireRole";
import ShipStationCard from "@/components/settings/ShipStationCard";
import SettingsHero from "@/components/settings/SettingsHero";
import SettingsSideMenu from "@/components/settings/SettingsSideMenu";
import NotificationSettingsTable from "@/components/settings/NotificationSettingsTable";
import IntegrationsPlaceholder from "@/components/settings/IntegrationsPlaceholder";
import { SETTINGS_SECTIONS } from "@/components/settings/settings.constants";
import { translateOrFallback } from "@/components/settings/settings.helpers";
import { filterSourcesByAccess } from "@/utils/apiSourceRules";

const INITIAL_LOADING_STATE = {
  sources: true,
  ship_fetch: true,
  ship_save: false,
  ship_verify: false,
};

export default function SettingsPage() {
  const { message } = AntdApp.useApp();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);

  const tSettings = useTranslations("dashboard.settings");
  const tCommon = useTranslations("common");
  const tForms = useTranslations("forms.common");
  const tProfile = useTranslations("dashboard.profile");

  const [shipForm] = Form.useForm();

  const [loading, setLoading] = useState(INITIAL_LOADING_STATE);
  const [isUserLoading, setIsUserLoading] = useState(!user);
  const [activeSection, setActiveSection] = useState(SETTINGS_SECTIONS.API_CONF);
  const [apiSources, setApiSources] = useState([]);
  const [activeSourceId, setActiveSourceId] = useState(null);
  const [credentialsBySource, setCredentialsBySource] = useState({});
  const [editingSources, setEditingSources] = useState({});
  const [storeLists, setStoreLists] = useState({});
  const [formDrafts, setFormDrafts] = useState({});

  const setLoadingFlag = useCallback((key, value) => {
    setLoading((prev) => ({ ...prev, [key]: value }));
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await AuthAPI.me();
    dispatch(setUser(me));
    return me;
  }, [dispatch]);

  useEffect(() => {
    if (user) {
      setIsUserLoading(false);
      return;
    }

    let canceled = false;
    (async () => {
      try {
        const me = await AuthAPI.me();
        if (!canceled) {
          dispatch(setUser(me));
        }
      } finally {
        if (!canceled) {
          setIsUserLoading(false);
        }
      }
    })();

    return () => {
      canceled = true;
    };
  }, [user, dispatch]);

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

  const translatedRoles = useMemo(() => {
    if (!normalizedRoles.length) {
      return [tProfile("roles.fallback")];
    }
    return normalizedRoles.map((role) =>
      translateOrFallback(tProfile, `roles.${role}`, role)
    );
  }, [normalizedRoles, tProfile]);

  const isPartnerAdmin = normalizedRoles.includes("partneradmin");
  const isCustomerAdmin = normalizedRoles.includes("customeradmin");
  const isCompanyAdmin = normalizedRoles.includes("companyadmin");

  const hasOwnApiKeyCustomerAdmin = useMemo(() => {
    if (!user || !isCustomerAdmin) return false;
    const customer = user.entity;
    if (customer.store_id) return false;
    return true;
  }, [user, isCustomerAdmin]);

  const canSeeShipStation =
    isCompanyAdmin || isPartnerAdmin || isCustomerAdmin;

  const userEntityType = useMemo(
    () => `${user?.entity?.entity_type || ""}`.toLowerCase(),
    [user]
  );

  const userForRuleContext = useMemo(() => {
    if (!user) return null;
    const entity = user.entity || {};
    const derivedHasOwnKey =
      entity.has_own_key ??
      (!entity.store_id && `${entity.entity_type || userEntityType}`.toLowerCase() === "customer");
    return {
      ...user,
      entity: {
        ...entity,
        has_own_key: derivedHasOwnKey,
      },
    };
  }, [user, userEntityType]);

  const ruleContext = useMemo(
    () => ({
      user: userForRuleContext,
      entityType: userEntityType,
    }),
    [userEntityType, userForRuleContext]
  );

  const visibleApiSources = useMemo(
    () => filterSourcesByAccess(apiSources, ruleContext),
    [apiSources, ruleContext]
  );

  const getSourceById = useCallback(
    (sourceId) =>
      visibleApiSources.find((item) => `${item.id}` === `${sourceId}`) || null,
    [visibleApiSources]
  );

  const formatSourceLabel = useCallback((source) => {
    if (!source) return "";
    const fallback =
      source.name
        ?.replace(/_/g, " ")
        ?.replace(/\b\w/g, (char) => char.toUpperCase()) || "";
    return (
      source.config?.title ||
      source.config?.display_name ||
      source.config?.form?.title ||
      source.config?.label ||
      fallback
    );
  }, []);

  const buildInitialValuesForSource = useCallback(
    (sourceId, credentialData) => {
      const source = getSourceById(sourceId);
      const fields = source?.config?.form?.fields || [];
      const values = {};

      fields.forEach((field) => {
        if (!field?.key) return;
        if (field.secret) {
          values[field.key] = "";
        } else if (
          field.key === "api_key" &&
          credentialData?.api_key_mask !== undefined
        ) {
          values[field.key] = credentialData.api_key_mask || "";
        } else if (
          credentialData &&
          Object.prototype.hasOwnProperty.call(credentialData, field.key)
        ) {
          values[field.key] = credentialData[field.key] ?? "";
        } else {
          values[field.key] = "";
        }
      });

      values.label = credentialData?.label || "";
      values.store_id = credentialData?.store_id || "";

      return values;
    },
    [getSourceById]
  );

  const isShipstationSource = useCallback((source) => {
    return (source?.name || "").toLowerCase() === "shipstation_api";
  }, []);

  const isShopifySource = useCallback((source) => {
    return (source?.name || "").toLowerCase() === "shopify_api";
  }, []);

  const resetShipstationState = useCallback(() => {
    setCredentialsBySource({});
    setEditingSources({});
    setStoreLists({});
    setFormDrafts({});
  }, []);


  const loadApiSources = useCallback(async () => {
    if (!canSeeShipStation) {
      setApiSources([]);
      setActiveSourceId(null);
      setFormDrafts({});
      setCredentialsBySource({});
      setEditingSources({});
      setStoreLists({});
      setLoadingFlag("sources", false);
      return;
    }

    setLoadingFlag("sources", true);
    try {
      const response = await ShipStationAPI.listApiSources();
      const rawList = response?.data ?? [];
      const normalizedList = Array.isArray(rawList)
        ? rawList.map((source) => ({
            ...source,
            id: String(source.id),
          }))
        : [];
      setApiSources(normalizedList);
      if (!normalizedList.length) {
        setFormDrafts({});
        setCredentialsBySource({});
        setEditingSources({});
        setStoreLists({});
      }
    } catch {
      setApiSources([]);
      setActiveSourceId(null);
      setFormDrafts({});
      setCredentialsBySource({});
      setEditingSources({});
      setStoreLists({});
    } finally {
      setLoadingFlag("sources", false);
    }
  }, [canSeeShipStation, setLoadingFlag]);

  const loadShipStation = useCallback(async () => {
    if (!user || !canSeeShipStation) {
      resetShipstationState();
      setLoadingFlag("ship_fetch", false);
      return;
    }

    if (!visibleApiSources.length) {
      resetShipstationState();
      setLoadingFlag("ship_fetch", false);
      return;
    }

    setLoadingFlag("ship_fetch", true);
    try {
      const response = await ShipStationAPI.get();
      const rawList = Array.isArray(response?.data) ? response.data : [];
      const mapped = rawList.reduce((acc, item) => {
        if (
          !item ||
          item.api_source_id === undefined ||
          item.api_source_id === null
        ) {
          return acc;
        }
        const key = String(item.api_source_id);
        acc[key] = item;
        return acc;
      }, {});

      setCredentialsBySource(mapped);

      const draftMap = {};
      const editMap = {};
      visibleApiSources.forEach((source) => {
        const key = String(source.id);
        const credential = mapped[key] || null;
        draftMap[key] = buildInitialValuesForSource(key, credential);
        editMap[key] = credential ? false : true;
      });
      setFormDrafts(draftMap);
      setEditingSources(editMap);
      setStoreLists((prev) => {
        const next = {};
        visibleApiSources.forEach((source) => {
          const key = String(source.id);
          next[key] = prev[key] || [];
        });
        return next;
      });
    } catch {
      const draftMap = {};
      const editMap = {};
      visibleApiSources.forEach((source) => {
        const key = String(source.id);
        draftMap[key] = buildInitialValuesForSource(key, null);
        editMap[key] = true;
      });
      setCredentialsBySource({});
      setFormDrafts(draftMap);
      setEditingSources(editMap);
      setStoreLists({});
    } finally {
      setLoadingFlag("ship_fetch", false);
    }
  }, [
    buildInitialValuesForSource,
    canSeeShipStation,
    resetShipstationState,
    setLoadingFlag,
    user,
    visibleApiSources,
  ]);

  useEffect(() => {
    loadApiSources();
  }, [loadApiSources]);

  useEffect(() => {
    if (!visibleApiSources.length) {
      setActiveSourceId(null);
      return;
    }

    setActiveSourceId((prev) => {
      if (
        prev &&
        visibleApiSources.some((source) => String(source.id) === String(prev))
      ) {
        return prev;
      }
      return String(visibleApiSources[0].id);
    });
  }, [visibleApiSources]);

  useEffect(() => {
    if (!canSeeShipStation) return;
    loadShipStation();
  }, [canSeeShipStation, loadShipStation]);

  useEffect(() => {
    if (!activeSourceId) {
      shipForm.resetFields();
      return;
    }
    const snapshot = formDrafts[activeSourceId];
    if (snapshot) {
      shipForm.setFieldsValue(snapshot);
    } else {
      shipForm.resetFields();
    }
  }, [activeSourceId, formDrafts, shipForm]);

  const handleSourceTabChange = useCallback(
    (nextKey) => {
      if (!nextKey) return;
      const normalizedKey = String(nextKey);
      const isVisible = visibleApiSources.some(
        (source) => String(source.id) === normalizedKey
      );
      if (!isVisible) return;
      setActiveSourceId(normalizedKey);
      setFormDrafts((prev) => {
        if (prev[normalizedKey]) return prev;
        const credential = credentialsBySource[normalizedKey] || null;
        const initialValues = buildInitialValuesForSource(
          normalizedKey,
          credential
        );
        return { ...prev, [normalizedKey]: initialValues };
      });
    },
    [
      buildInitialValuesForSource,
      credentialsBySource,
      visibleApiSources,
    ]
  );

  const handleFormValuesChange = useCallback(
    (_, allValues) => {
      if (!activeSourceId) return;
      setFormDrafts((prev) => ({ ...prev, [activeSourceId]: allValues }));
    },
    [activeSourceId]
  );

  const handleEditShip = useCallback(
    (sourceId) => {
      if (!sourceId) return;
      const initialValues = buildInitialValuesForSource(
        sourceId,
        credentialsBySource[sourceId] || null
      );
      setEditingSources((prev) => ({ ...prev, [sourceId]: true }));
      setFormDrafts((prev) => ({ ...prev, [sourceId]: initialValues }));
    },
    [buildInitialValuesForSource, credentialsBySource]
  );

  const handleCancelShip = useCallback(
    (sourceId) => {
      if (!sourceId) return;
      const credential = credentialsBySource[sourceId] || null;
      const initialValues = buildInitialValuesForSource(sourceId, credential);
      setEditingSources((prev) => ({ ...prev, [sourceId]: !credential }));
      setFormDrafts((prev) => ({ ...prev, [sourceId]: initialValues }));
      setStoreLists((prev) => ({ ...prev, [sourceId]: [] }));
    },
    [buildInitialValuesForSource, credentialsBySource]
  );

  const handleSaveShipstation = useCallback(
    async (sourceId) => {
      if (!sourceId) return;
      setLoadingFlag("ship_save", true);
      try {
        const values = await shipForm.validateFields();
        const credential = credentialsBySource[sourceId] || null;
        const source = getSourceById(sourceId);
        const fields = source?.config?.form?.fields || [];
        const hasApiKeyField = fields.some((field) => field.key === "api_key");
        const hasApiSecretField = fields.some(
          (field) => field.key === "api_secret"
        );
        const maskedKey = credential?.api_key_mask || "";
        const keyProvided =
          hasApiKeyField && values.api_key && values.api_key !== maskedKey;
        const secretProvided = hasApiSecretField && !!values.api_secret;

        const isShipstation = isShipstationSource(source);
        const isShopify = isShopifySource(source);
        const resolvedStoreId = values.store_id ?? credential?.store_id ?? "";

        if (isShipstation && hasOwnApiKeyCustomerAdmin && !resolvedStoreId) {
          message.error(tProfile("messages.storeIdRequired"));
          return;
        }

        if (credential && hasApiKeyField && hasApiSecretField) {
          if (keyProvided !== secretProvided) {
            message.warning(tProfile("messages.apiPairRequired"));
            return;
          }
        }

        const payload = {
          label: values.label,
        };

        if (!credential) {
          payload.api_source_id = sourceId;
        }

        if (isShipstation && hasOwnApiKeyCustomerAdmin) {
          payload.store_id = resolvedStoreId;
        }

        fields.forEach((field) => {
          if (!field?.key) return;
          if (field.secret) {
            if (!credential || values[field.key]) {
              payload[field.key] = values[field.key];
            }
          } else if (field.key === "api_key") {
            if (!credential || keyProvided) {
              payload[field.key] = values[field.key];
            }
          } else {
            payload[field.key] = values[field.key];
          }
        });

        if (isShopify) {
          const rawStoreId = `${values.store_id ?? credential?.store_id ?? ""}`.trim();
          const rawAccessKey = `${values.access_key ?? ""}`.trim();
          payload.store_id = rawStoreId;
          payload.api_key = rawStoreId;
          if (rawAccessKey) {
            payload.api_secret = rawAccessKey;
          }
          delete payload.access_key;
        }

        if (!credential) {
          await ShipStationAPI.create(payload);
          message.success(tProfile("messages.shipstationCreated"));
        } else {
          const { api_source_id: _omit, ...updatePayload } = payload;
          await ShipStationAPI.update(credential.id, updatePayload);
          message.success(tProfile("messages.shipstationUpdated"));
        }

        await loadShipStation();
        await refreshUser();
      } catch (error) {
        console.log("error", error);
        const fallbackMessage =
          error?.response?.data?.error?.message ||
          error?.response?.data?.error?.message ||
          tProfile("messages.shipstationGenericError");
        message.error(fallbackMessage);
      } finally {
        setLoadingFlag("ship_save", false);
      }
    },
    [
      credentialsBySource,
      getSourceById,
      hasOwnApiKeyCustomerAdmin,
      isShopifySource,
      isShipstationSource,
      loadShipStation,
      message,
      refreshUser,
      setLoadingFlag,
      shipForm,
      tProfile,
    ]
  );

  const handleShipstationVerify = useCallback(
    async (sourceId) => {
      if (!sourceId) return;
      setLoadingFlag("ship_verify", true);
      try {
        const values = shipForm.getFieldsValue();
        const credential = credentialsBySource[sourceId] || null;
        const masked = credential?.api_key_mask || "";
        const currentKey = values.api_key;
        const currentSecret = values.api_secret;
        const keyProvided = !!currentKey && currentKey !== masked;
        const secretProvided = !!currentSecret;

        if (!keyProvided || !secretProvided) {
          message.warning(tProfile("messages.verificationMissing"));
          return;
        }

        const response = await ShipStationAPI.keyCheck({
          api_source_id: sourceId,
          api_key: currentKey,
          api_secret: currentSecret,
        });
        setStoreLists((prev) => ({
          ...prev,
          [sourceId]: response.data || [],
        }));
        message.success(tProfile("messages.verificationSuccess"));
      } catch (error) {
        const fallbackMessage =
          error?.response?.data?.error?.message ||
          error?.response?.data?.error?.message ||
          tProfile("messages.verificationError");
        message.error(fallbackMessage);
      } finally {
        setLoadingFlag("ship_verify", false);
      }
    },
    [
      credentialsBySource,
      message,
      setLoadingFlag,
      shipForm,
      tProfile,
    ]
  );

  const heroTitle = translateOrFallback(
    tSettings,
    "header.title",
    "Workspace settings"
  );
  const heroSubtitle = translateOrFallback(
    tSettings,
    "header.subtitle",
    "Manage integrations, preferences, and upcoming features from a single place."
  );

  const activeSource = useMemo(
    () => (activeSourceId ? getSourceById(activeSourceId) : null),
    [activeSourceId, getSourceById]
  );
  const activeSourceFields = activeSource?.config?.form?.fields || [];
  const hasApiKeyField = activeSourceFields.some(
    (field) => field.key === "api_key"
  );
  const hasApiSecretField = activeSourceFields.some(
    (field) => field.key === "api_secret"
  );
  const isShipstationActive = isShipstationSource(activeSource);
  const shouldShowStoreId = isShipstationActive && hasOwnApiKeyCustomerAdmin;
  const credential = credentialsBySource[activeSourceId] || null;
  const isEditing =
    editingSources[activeSourceId] ?? (credential ? false : true);
  const storeList = storeLists[activeSourceId] || [];
  const activeSourceLabel = formatSourceLabel(activeSource);
  const canVerifyCredentials =
    shouldShowStoreId && hasApiKeyField && hasApiSecretField;

  return (
    <div className="grid gap-4">
      <SettingsHero
        title={heroTitle}
        subtitle={heroSubtitle}
        user={user}
        roles={translatedRoles}
        isLoading={isUserLoading}
      />

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <div className="xl:col-span-1">
          <SettingsSideMenu
            activeKey={activeSection}
            onChange={setActiveSection}
            tSettings={tSettings}
          />
        </div>

        <div className="xl:col-span-3">
          {activeSection === SETTINGS_SECTIONS.API_CONF ? (
            <RequireRole
              anyOfRoles={["companyAdmin", "partnerAdmin", "customerAdmin"]}
            >
              {canSeeShipStation &&
              (visibleApiSources.length || loading.sources) ? (
                <ShipStationCard
                  form={shipForm}
                  credential={credential}
                  isEditing={isEditing}
                  loading={loading}
                  storeList={storeList}
                  onEdit={handleEditShip}
                  onCancel={handleCancelShip}
                  onSave={handleSaveShipstation}
                  onVerify={handleShipstationVerify}
                  tProfile={tProfile}
                  tCommon={tCommon}
                  tForms={tForms}
                  sources={visibleApiSources}
                  activeSourceId={activeSourceId}
                  onSourceChange={handleSourceTabChange}
                  tabsLoading={loading.sources}
                  onValuesChange={handleFormValuesChange}
                  formatSourceLabel={formatSourceLabel}
                  activeSourceLabel={activeSourceLabel}
                  activeSourceFields={activeSourceFields}
                  hasApiKeyField={hasApiKeyField}
                  hasApiSecretField={hasApiSecretField}
                  shouldShowStoreId={shouldShowStoreId}
                  canVerify={canVerifyCredentials}
                  isShipstation={isShipstationActive}
                />
              ) : (
                <IntegrationsPlaceholder tSettings={tSettings} />
              )}
            </RequireRole>
          ) : (
            <RequireRole
              anyOfRoles={["companyAdmin", "partnerAdmin", "customerAdmin"]}
            >
              <NotificationSettingsTable tSettings={tSettings} />
            </RequireRole>
          )}
        </div>
      </div>
    </div>
  );
}
