import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/** Models that are archived rather than removed. */
const SOFT_DELETE_MODELS = new Set(["Client", "Deal", "Invoice", "Quote"]);

const FILTERED_OPERATIONS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

  return new PrismaClient({ adapter }).$extends({
    name: "soft-delete",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !SOFT_DELETE_MODELS.has(model)) return query(args);
          if (!FILTERED_OPERATIONS.has(operation)) return query(args);

          // Hide archived rows unless a caller asks for them explicitly, which
          // is how the trash page reads them back.
          const shaped = args as { where?: Record<string, unknown> };
          if (shaped.where?.deletedAt === undefined) {
            shaped.where = { ...shaped.where, deletedAt: null };
          }
          return query(shaped);
        },
      },
    },
  });
}

type ExtendedPrismaClient = ReturnType<typeof createClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
