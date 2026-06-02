#!/usr/bin/env node
/**
 * Re-encrypt every stored ciphertext with the highest-numbered ENCRYPTION_KEY_V*.
 *
 * Usage:
 *   1. Generate a new key:
 *        node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *   2. Add it as ENCRYPTION_KEY_V<N+1> in .env (N+1 = next int after current active id).
 *   3. Keep the OLD key in env too (decrypt path needs it).
 *   4. Run: npx tsx scripts/rotate-encryption.ts
 *   5. After verifying success, remove the old key.
 *
 * Currently rotates only WhatsAppConfig.accessToken — extend the rotators[] list
 * when more encrypted fields are introduced.
 */
import { prisma } from "../lib/db/prisma";
import { decryptString, encryptString, inspectCiphertext, looksEncrypted } from "../lib/crypto/encrypt";

type Rotator = {
  table: string;
  findAll: () => Promise<Array<{ id: string; value: string | null }>>;
  update: (id: string, value: string) => Promise<unknown>;
};

const rotators: Rotator[] = [
  {
    table: "WhatsAppConfig.accessToken",
    findAll: async () => {
      const rows = await prisma.whatsAppConfig.findMany({
        where: { accessToken: { not: null } },
        select: { id: true, accessToken: true },
      });
      return rows.map((r) => ({ id: r.id, value: r.accessToken }));
    },
    update: (id, value) =>
      prisma.whatsAppConfig.update({ where: { id }, data: { accessToken: value } }),
  },
];

(async () => {
  let total = 0;
  let rotated = 0;
  let skipped = 0;

  for (const r of rotators) {
    console.log(`\n[${r.table}]`);
    const rows = await r.findAll();
    for (const row of rows) {
      total++;
      if (!row.value || !looksEncrypted(row.value)) {
        skipped++;
        continue;
      }
      try {
        const info = inspectCiphertext(row.value);
        const plain = decryptString(row.value);
        const reEnc = encryptString(plain);
        const newInfo = inspectCiphertext(reEnc);
        if (info?.keyId === newInfo?.keyId && info?.version === newInfo?.version) {
          console.log(`  ${row.id}: already on latest key, skipping`);
          skipped++;
          continue;
        }
        await r.update(row.id, reEnc);
        rotated++;
        console.log(`  ${row.id}: rotated ${info?.version}/${info?.keyId} → ${newInfo?.version}/${newInfo?.keyId}`);
      } catch (e: any) {
        console.error(`  ${row.id}: FAILED — ${e?.message}`);
      }
    }
  }

  console.log(`\nDone. ${rotated} rotated, ${skipped} skipped, ${total} total.`);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
