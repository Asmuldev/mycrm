-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'TERMINATED');

-- CreateTable
CREATE TABLE "ServerNode" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'AAPANEL',
    "baseUrl" TEXT NOT NULL,
    "apiKeyEnc" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "panelVersion" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServerNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "serverNodeId" TEXT,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "status" "ServiceStatus" NOT NULL DEFAULT 'ACTIVE',
    "remoteId" TEXT,
    "remoteName" TEXT,
    "recurringInvoiceId" TEXT,
    "remoteRunning" BOOLEAN,
    "diskUsedBytes" DECIMAL(20,0),
    "diskQuotaBytes" DECIMAL(20,0),
    "phpVersion" TEXT,
    "sslIssuer" TEXT,
    "sslExpiresAt" TIMESTAMP(3),
    "remoteExpiresAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "syncError" TEXT,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServerNode_active_idx" ON "ServerNode"("active");

-- CreateIndex
CREATE INDEX "Service_clientId_idx" ON "Service"("clientId");

-- CreateIndex
CREATE INDEX "Service_status_idx" ON "Service"("status");

-- CreateIndex
CREATE INDEX "Service_deletedAt_idx" ON "Service"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Service_serverNodeId_remoteId_key" ON "Service"("serverNodeId", "remoteId");

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_serverNodeId_fkey" FOREIGN KEY ("serverNodeId") REFERENCES "ServerNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_recurringInvoiceId_fkey" FOREIGN KEY ("recurringInvoiceId") REFERENCES "RecurringInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
