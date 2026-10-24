const databaseKeys = ["DATABASE_URL", "DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"];

export function testDatabaseEnvironment(source) {
  if (databaseKeys.some((key) => source[key]?.trim())) return source;
  return { ...source, DATABASE_URL: "mysql://test:test@127.0.0.1:3306/reviewroom_test" };
}
