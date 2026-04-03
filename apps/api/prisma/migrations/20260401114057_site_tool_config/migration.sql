-- CreateTable
CREATE TABLE "site_tool_configs" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "toolSlug" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "minRole" TEXT NOT NULL DEFAULT 'operator',

    CONSTRAINT "site_tool_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "site_tool_configs_siteId_toolSlug_key" ON "site_tool_configs"("siteId", "toolSlug");

-- AddForeignKey
ALTER TABLE "site_tool_configs" ADD CONSTRAINT "site_tool_configs_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
