-- TEA (Transparency Exchange API) Tables Migration
-- Based on the OpenAPI 3.1.1 specification

-- TEA Product table
CREATE TABLE "TeaProduct" (
    "uuid" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "barcode" TEXT,
    "sku" TEXT,
    "vendorUuid" TEXT,
    "identifiers" TEXT, -- JSON array of TeaIdentifier objects
    "type" TEXT NOT NULL DEFAULT 'generic',
    "namespace" TEXT,
    "version" TEXT,
    "qualifiers" TEXT, -- JSON array of qualifier objects
    "subpath" TEXT,
    "orgId" TEXT NOT NULL,
    "createdAt" INTEGER NOT NULL,
    "modifiedAt" INTEGER
);

-- TEA Component table
CREATE TABLE "TeaComponent" (
    "uuid" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "barcode" TEXT,
    "sku" TEXT,
    "vendorUuid" TEXT,
    "identifiers" TEXT, -- JSON array of TeaIdentifier objects
    "type" TEXT NOT NULL DEFAULT 'generic',
    "namespace" TEXT,
    "version" TEXT,
    "qualifiers" TEXT, -- JSON array of qualifier objects
    "subpath" TEXT,
    "orgId" TEXT NOT NULL,
    "createdAt" INTEGER NOT NULL,
    "modifiedAt" INTEGER
);

-- TEA Release table
CREATE TABLE "TeaRelease" (
    "uuid" TEXT NOT NULL PRIMARY KEY,
    "productUuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "barcode" TEXT,
    "sku" TEXT,
    "vendorUuid" TEXT,
    "identifiers" TEXT, -- JSON array of TeaIdentifier objects
    "type" TEXT NOT NULL DEFAULT 'generic',
    "namespace" TEXT,
    "version" TEXT NOT NULL,
    "qualifiers" TEXT, -- JSON array of qualifier objects
    "subpath" TEXT,
    "orgId" TEXT NOT NULL,
    "createdAt" INTEGER NOT NULL,
    "modifiedAt" INTEGER
);

-- TEA Collection table (separate from the main Collection table)
CREATE TABLE "TeaCollection" (
    "uuid" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "identifiers" TEXT, -- JSON array of TeaIdentifier objects
    "version" TEXT,
    "created" INTEGER NOT NULL,
    "artifacts" TEXT, -- JSON array of artifact UUIDs
    "lifecycle" TEXT, -- JSON array of lifecycle objects
    "orgId" TEXT NOT NULL,
    "createdAt" INTEGER NOT NULL,
    "modifiedAt" INTEGER
);

-- Product-Component relationship table
CREATE TABLE "TeaProductComponent" (
    "productUuid" TEXT NOT NULL,
    "componentUuid" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdAt" INTEGER NOT NULL,
    PRIMARY KEY ("productUuid", "componentUuid")
);

-- Release-Component relationship table
CREATE TABLE "TeaReleaseComponent" (
    "releaseUuid" TEXT NOT NULL,
    "componentUuid" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdAt" INTEGER NOT NULL,
    PRIMARY KEY ("releaseUuid", "componentUuid")
);

-- Create indexes for better performance
CREATE INDEX "TeaProduct_orgId_idx" ON "TeaProduct"("orgId");
CREATE INDEX "TeaProduct_name_idx" ON "TeaProduct"("name");
CREATE INDEX "TeaProduct_type_idx" ON "TeaProduct"("type");

CREATE INDEX "TeaComponent_orgId_idx" ON "TeaComponent"("orgId");
CREATE INDEX "TeaComponent_name_idx" ON "TeaComponent"("name");
CREATE INDEX "TeaComponent_type_idx" ON "TeaComponent"("type");

CREATE INDEX "TeaRelease_orgId_idx" ON "TeaRelease"("orgId");
CREATE INDEX "TeaRelease_productUuid_idx" ON "TeaRelease"("productUuid");
CREATE INDEX "TeaRelease_version_idx" ON "TeaRelease"("version");

CREATE INDEX "TeaCollection_orgId_idx" ON "TeaCollection"("orgId");
CREATE INDEX "TeaCollection_name_idx" ON "TeaCollection"("name");

CREATE INDEX "TeaProductComponent_productUuid_idx" ON "TeaProductComponent"("productUuid");
CREATE INDEX "TeaProductComponent_componentUuid_idx" ON "TeaProductComponent"("componentUuid");

CREATE INDEX "TeaReleaseComponent_releaseUuid_idx" ON "TeaReleaseComponent"("releaseUuid");
CREATE INDEX "TeaReleaseComponent_componentUuid_idx" ON "TeaReleaseComponent"("componentUuid");
