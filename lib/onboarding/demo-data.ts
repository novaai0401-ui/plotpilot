import type { Prisma } from "@prisma/client";

/**
 * Demo data seeded for a brand-new org on first signup.
 *
 * Why: a fresh broker_admin landing in an empty dashboard has no way to feel
 * out the product. Activation rate drops measurably. Three plots + two clients
 * + one scheduled visit lets them poke at every screen without typing data.
 *
 * Why "Demo:" prefix: makes the demo rows obvious so the broker can delete
 * them via the normal UI once they're ready to add real listings. No schema
 * change (no `isDemo` column), so no migration risk.
 *
 * Skipped for invite-driven signups (joining an existing org or accepting a
 * client invite) — those flows already have real org data.
 */

export function plotSeeds(orgId: string, ownerAgentId: string): Prisma.PlotCreateManyInput[] {
  return [
    {
      orgId,
      title: "Demo: Sunrise Hills · 1200 sqft corner plot",
      description:
        "East-facing 30×40 corner plot in a gated layout. Demo listing — feel free to delete once you've added your own.",
      location: "Sunrise Hills Layout, near Whitefield",
      city: "Bangalore",
      lat: 12.9698,
      lng: 77.7499,
      sizeSqft: 1200,
      priceInr: 7_500_000,
      status: "available",
      photos: [],
    },
    {
      orgId,
      title: "Demo: Greenfield Estate · 2400 sqft villa plot",
      description:
        "Premium 40×60 plot with park frontage. BMRDA approved. Demo listing — replace with your own once you're set up.",
      location: "Greenfield Estate, off Sarjapur Road",
      city: "Bangalore",
      lat: 12.9032,
      lng: 77.6981,
      sizeSqft: 2400,
      priceInr: 18_500_000,
      status: "available",
      photos: [],
    },
    {
      orgId,
      title: "Demo: Lakeview Acres · 4800 sqft farmhouse plot",
      description:
        "Large-format plot adjacent to a 12-acre lake. Suitable for weekend home / vineyard. Demo listing.",
      location: "Lakeview Acres, Devanahalli",
      city: "Bangalore",
      lat: 13.2496,
      lng: 77.7106,
      sizeSqft: 4800,
      priceInr: 24_000_000,
      status: "reserved",
      photos: [],
    },
  ];
}

export function clientSeeds(
  orgId: string,
  ownerAgentId: string
): Prisma.UserCreateManyInput[] {
  const stamp = Date.now().toString(36);
  // Preferences are picked so the Match Radar demo lights up usefully against
  // the three demo plots above:
  //  - Anita's bracket fits Sunrise Hills (1200 sqft, ₹75L, Whitefield) near-perfectly
  //  - Vikram's range fits Greenfield (2400 sqft, ₹1.85Cr, Sarjapur)
  return [
    {
      authId: `demo-client-1-${stamp}`,
      orgId,
      role: "client",
      name: "Demo: Anita Sharma",
      email: `demo-anita-${stamp}@example.com`,
      phone: `+9199${Math.floor(Math.random() * 100_000_000)}`,
      ownerAgentId,
      preferences: {
        location: "Bangalore Whitefield",
        sizeSqftMin: 1000,
        sizeSqftMax: 1600,
        budgetInrMin: 5_000_000,
        budgetInrMax: 9_000_000,
        facings: ["E", "NE"],
        mustHaves: ["gated"],
        notes:
          "Young family with two kids. Visited Sunrise Hills last month, liked the layout. Decision in next 60 days.",
      } as object,
    },
    {
      authId: `demo-client-2-${stamp}`,
      orgId,
      role: "client",
      name: "Demo: Vikram Reddy",
      email: `demo-vikram-${stamp}@example.com`,
      phone: `+9199${Math.floor(Math.random() * 100_000_000)}`,
      ownerAgentId,
      preferences: {
        location: "Bangalore Sarjapur",
        sizeSqftMin: 2000,
        sizeSqftMax: 3000,
        budgetInrMin: 15_000_000,
        budgetInrMax: 22_000_000,
        facings: ["E", "N"],
        mustHaves: ["BMRDA"],
        notes:
          "Self-employed; wants villa-buildable plot. Has approval for home loan up to ₹2 Cr.",
      } as object,
    },
  ];
}
