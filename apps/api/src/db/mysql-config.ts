export type MysqlEnvironment = {
  DB_HOST?: string | undefined;
  DB_PORT?: string | number | undefined;
  DB_NAME?: string | undefined;
  DB_USER?: string | undefined;
  DB_PASSWORD?: string | undefined;
  DATABASE_URL?: string | undefined;
};

export type MysqlConnection = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
};

export const connectionCollation = "utf8mb4_unicode_ci" as const;

export function createMysqlPoolConfig(
  connection: MysqlConnection,
  ssl: false | { rejectUnauthorized: true },
  connectionLimit: number,
) {
  return { ...connection, connectionLimit, ssl, collation: connectionCollation };
}

const componentKeys = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"] as const;
const hasValue = (value: string | number | undefined): boolean => value !== undefined && String(value) !== "";

export function readMysqlConnection(source: MysqlEnvironment): MysqlConnection {
  const hasComponents = componentKeys.some((key) => hasValue(source[key]));
  if (hasComponents) {
    const missing = componentKeys.filter((key) => !String(source[key] ?? "").trim());
    if (missing.length > 0) throw new Error(`Set DB_HOST, DB_PORT, DB_NAME, DB_USER, and DB_PASSWORD together; missing ${missing.join(", ")}.`);

    const port = Number(source.DB_PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("DB_PORT must be an integer between 1 and 65535.");

    return {
      host: source.DB_HOST!.trim(),
      port,
      database: source.DB_NAME!.trim(),
      user: source.DB_USER!.trim(),
      password: source.DB_PASSWORD!,
    };
  }

  const configuredUrl = source.DATABASE_URL?.trim();
  if (!configuredUrl) throw new Error("Configure MySQL with DB_HOST, DB_PORT, DB_NAME, DB_USER, and DB_PASSWORD, or provide DATABASE_URL.");

  let url: URL;
  try {
    url = new URL(configuredUrl);
  } catch {
    throw new Error("The configured MySQL connection URL must be valid.");
  }
  if (url.protocol !== "mysql:" || !url.hostname || !url.username || !url.password || !url.pathname.slice(1)) {
    throw new Error("The configured MySQL URL must include MySQL host, database, username, and password.");
  }

  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    database: decodeURIComponent(url.pathname.slice(1)),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  };
}

export function buildDatabaseUrl(source: MysqlEnvironment): string {
  if (!componentKeys.some((key) => hasValue(source[key]))) {
    return source.DATABASE_URL?.trim() ?? "";
  }

  const connection = readMysqlConnection(source);
  const url = new URL("mysql://localhost");
  url.hostname = connection.host;
  url.port = String(connection.port);
  url.username = connection.user;
  url.password = connection.password;
  url.pathname = `/${connection.database}`;
  return url.toString();
}

export function resolveMysqlSsl(
  explicitSetting: boolean | undefined,
  nodeEnv: string | undefined,
  host: string,
): false | { rejectUnauthorized: true } {
  if (explicitSetting !== undefined) return explicitSetting ? { rejectUnauthorized: true } : false;
  const loopback = ["localhost", "127.0.0.1", "::1"].includes(host.toLowerCase());
  return nodeEnv === "production" && !loopback ? { rejectUnauthorized: true } : false;
}
