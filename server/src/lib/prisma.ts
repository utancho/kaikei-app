import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";

// Cloudflare Workersにはリクエストスコープ外で使えるグローバルなDB接続という概念がなく、
// D1バインディング(env.DB)はリクエストハンドラの中でしか手に入らない。
// 一方でサービス層(services/*.ts)は従来通り `import { prisma } from "../lib/prisma.js"`
// という単純な形で使いたいので、AsyncLocalStorageでリクエストごとのPrismaClientを
// 保持し、`prisma` はそれを都度参照するProxyとして公開する。
const storage = new AsyncLocalStorage<PrismaClient>();
const databaseStorage = new AsyncLocalStorage<D1Database>();

export function runWithPrisma<T>(d1: D1Database, fn: () => Promise<T>): Promise<T> {
  const client = new PrismaClient({ adapter: new PrismaD1(d1) });
  return databaseStorage.run(d1, () => storage.run(client, fn));
}

export function requestDatabase(): D1Database {
  const db = databaseStorage.getStore();
  if (!db) throw new Error("Database is unavailable outside request scope");
  return db;
}

function currentClient(): PrismaClient {
  const client = storage.getStore();
  if (!client) {
    throw new Error("Prisma client is not available outside of a request (runWithPrisma not called)");
  }
  return client;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(currentClient(), prop, receiver);
  },
}) as PrismaClient;
