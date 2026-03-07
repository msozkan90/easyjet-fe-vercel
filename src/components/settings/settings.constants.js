export const SETTINGS_SECTIONS = {
  API_CONF: "api_conf",
  NOTIFICATION: "notification",
};

export const INITIAL_NOTIFICATION_ROWS = [
  {
    key: "order_created",
    enabled: true,
  },
  {
    key: "order_delayed",
    enabled: true,
  },
  {
    key: "sync_failure",
    enabled: false,
  },
];
