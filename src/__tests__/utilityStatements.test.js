import { describe, it, expect } from "vitest";
import {
  distributeCents,
  signedCents,
  statementUnits,
  calculateStatement,
} from "../domain/utilityStatements";

function fixture() {
  return {
    start: "2024-01-01",
    end: "2024-12-31",
    houseConfirmed: true,
    heatingConfirmed: true,
    advancesConfirmed: true,
    documents: [{ id: "d1", name: "Versicherung", status: "checked" }],
    units: statementUnits(
      [{ id: "p1", name: "Wohnung", size: 60 }],
      [
        {
          id: "l1",
          propertyId: "p1",
          start: "2024-01-01",
          end: "2024-06-30",
          tenantIds: ["t1"],
        },
        { id: "l2", propertyId: "p1", start: "2024-07-02", tenantIds: ["t2"] },
      ],
      [
        { id: "t1", name: "A" },
        { id: "t2", name: "B" },
      ],
      "2024-01-01",
      "2024-12-31",
    ).map((unit) => ({
      ...unit,
      confirmed: true,
      periods: unit.periods.map((period) => ({ ...period, confirmed: true })),
    })),
    items: [
      {
        id: "i1",
        name: "Versicherung",
        category: "Versicherung",
        amount: "366.01",
        start: "2024-01-01",
        end: "2024-12-31",
        documentId: "d1",
        page: "Seite 1",
        contractBasis: "Mietvertrag § 3",
        reference: "R1-1",
        allocation: "area",
        confirmed: true,
      },
    ],
    advances: [],
    heating: [],
  };
}
describe("Deterministic utility statements", () => {
  it("uses documented occupant changes and rejects gaps in their history", () => {
    const statement = fixture();
    statement.items[0].allocation = "personDays";
    for (const unit of statement.units)
      for (const period of unit.periods)
        period.personCount = period.owner ? 0 : 1;
    statement.units[0].periods[0].occupancy = [
      { start: "2024-01-01", end: "2024-03-31", count: 1 },
      { start: "2024-04-01", end: "2024-06-30", count: 2 },
    ];
    const result = calculateStatement(statement);
    expect(result.issues).toEqual([]);
    expect(result.rows[0].totalCents).toBeGreaterThan(
      result.rows[2].totalCents,
    );
    statement.units[0].periods[0].occupancy[1].start = "2024-04-02";
    expect(calculateStatement(statement).issues.join(" ")).toMatch(
      /unvollständig/,
    );
  });
  it("distributes positive and negative amounts exactly and breaks ties by stable IDs", () => {
    expect(
      distributeCents(100, [
        { id: "c", weight: 1 },
        { id: "a", weight: 1 },
        { id: "b", weight: 1 },
      ]),
    ).toEqual({ c: 33, a: 34, b: 33 });
    expect(
      distributeCents(-100, [
        { id: "c", weight: 1 },
        { id: "a", weight: 1 },
        { id: "b", weight: 1 },
      ]),
    ).toEqual({ c: -33, a: -34, b: -33 });
    expect(() => distributeCents(100, [{ id: "a", weight: 0 }])).toThrow();
    expect(signedCents("-12,34")).toBe(-1234);
    expect(() => signedCents("1.234")).toThrow();
  });
  it("keeps vacancy with the owner, respects inclusive tenancy ends and accounts for leap years", () => {
    const statement = fixture(),
      result = calculateStatement(statement);
    expect(result.issues).toEqual([]);
    expect(result.rows.map((row) => row.totalCents)).toEqual([
      18200, 100, 18301,
    ]);
    expect(result.rows.reduce((sum, row) => sum + row.totalCents, 0)).toBe(
      36601,
    );
    expect(result.rows.find((row) => row.owner).start).toBe("2024-07-01");
  });
  it("subtracts only confirmed actual advances and reports missing payment evidence", () => {
    const statement = fixture();
    statement.advances = [
      {
        leaseId: "l1",
        date: "2024-02-01",
        amount: "100.00",
        reference: "Kontoauszug 2",
        confirmed: true,
      },
    ];
    expect(calculateStatement(statement).rows[0].balanceCents).toBe(8200);
    statement.advances[0].confirmed = false;
    expect(calculateStatement(statement).issues).toContain(
      "Vorauszahlung, Zahlungsdatum oder Nachweis prüfen.",
    );
  });
  it("blocks missing areas, unreviewed documents, duplicate invoices and unknown consumption", () => {
    const statement = fixture();
    statement.units[0].area = "";
    expect(calculateStatement(statement).issues.join(" ")).toMatch(
      /Wohnfläche fehlt/,
    );
    statement.units[0].area = 60;
    statement.items.push({ ...statement.items[0], id: "i2" });
    expect(calculateStatement(statement).issues.join(" ")).toMatch(/doppelte/);
    statement.items[0].allocation = "consumption";
    expect(calculateStatement(statement).issues.join(" ")).toMatch(
      /Anteil fehlt/,
    );
    statement.documents[0].status = "pending";
    expect(calculateStatement(statement).issues.join(" ")).toMatch(
      /Beleg prüfen/,
    );
  });
  it("prorates cross-year services before distribution and rejects overlapping tenancies", () => {
    const statement = fixture();
    statement.items[0] = {
      ...statement.items[0],
      amount: "100.00",
      start: "2023-12-31",
      end: "2024-01-01",
    };
    expect(
      calculateStatement(statement).rows.reduce(
        (sum, row) => sum + row.totalCents,
        0,
      ),
    ).toBe(5000);
    expect(() =>
      statementUnits(
        [{ id: "p1" }],
        [
          { id: "1", propertyId: "p1", start: "2024-01-01", tenantIds: [] },
          { id: "2", propertyId: "p1", start: "2024-02-01", tenantIds: [] },
        ],
        [],
        "2024-01-01",
        "2024-12-31",
      ),
    ).toThrow(/Überlappende/);
  });
});
