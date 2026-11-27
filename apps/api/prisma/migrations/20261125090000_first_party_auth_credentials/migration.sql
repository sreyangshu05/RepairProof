CREATE TABLE "AuthCredential" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthCredential_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AuthCredential_userId_key" ON "AuthCredential"("userId");
CREATE UNIQUE INDEX "AuthCredential_email_key" ON "AuthCredential"("email");
CREATE INDEX "AuthCredential_email_idx" ON "AuthCredential"("email");
