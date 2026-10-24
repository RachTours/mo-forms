import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client.js";
import { env, mysqlConnection, mysqlSsl } from "../env.js";
import { createMysqlPoolConfig } from "./mysql-config.js";

const adapter = new PrismaMariaDb(createMysqlPoolConfig(mysqlConnection, mysqlSsl, env.DATABASE_CONNECTION_LIMIT));

export const prisma = new PrismaClient({ adapter });
