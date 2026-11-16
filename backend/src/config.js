import "dotenv/config";

const bool = (value, fallback = false) => {
  if (value === undefined) return fallback;
  return ["1", "true", "yes"].includes(String(value).toLowerCase());
};

export const config = {
  env: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  host: process.env.HOST || "0.0.0.0",
  port: Number(process.env.PORT || 4000),
  corsOrigin: (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  jwtSecret: process.env.JWT_SECRET || "sivep-dev-secret-no-usar-en-produccion",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/sivep_tech",
  mysql: {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "sivep",
    password: process.env.MYSQL_PASSWORD || "sivep",
    database: process.env.MYSQL_DATABASE || "sivep_tech",
    charset: "utf8mb4",
    timezone: process.env.MYSQL_TIMEZONE || "local",
    dateStrings: false,
  },
  mail: {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: bool(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    to: process.env.CONTACT_TO || "siveptech@gmail.com",
    fromName: process.env.CONTACT_FROM_NAME || "SIVEP Tech",
  },
  logLevel: process.env.LOG_LEVEL || "info",
  prettyLogs: bool(
    process.env.PRETTY_LOGS,
    process.env.NODE_ENV !== "production",
  ),
};

export const VERTICALS = ["hotel", "farmacia", "veterinaria", "tienda"];
export const ROLES = ["owner", "admin", "staff"];
