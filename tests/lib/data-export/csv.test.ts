import { describe, it, expect } from "vitest";
import { csvEscape, csvRow, csvDocument } from "@/lib/data-export/csv";

describe("csvEscape", () => {
  it("returns empty string for null/undefined", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });

  it("returns plain values unchanged", () => {
    expect(csvEscape("hello")).toBe("hello");
    expect(csvEscape(42)).toBe("42");
    expect(csvEscape(true)).toBe("true");
  });

  it("quotes values containing comma", () => {
    expect(csvEscape("a, b")).toBe('"a, b"');
  });

  it("quotes values containing newlines", () => {
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
    expect(csvEscape("line1\r\nline2")).toBe('"line1\r\nline2"');
  });

  it("escapes embedded double-quotes by doubling them", () => {
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  });

  it("defuses formula injection (Excel/LibreOffice/Sheets attack)", () => {
    expect(csvEscape("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(csvEscape("+1234")).toBe("'+1234");
    expect(csvEscape("-cmd|/c calc")).toBe("'-cmd|/c calc");
    expect(csvEscape("@SUM")).toBe("'@SUM");
    expect(csvEscape("\t=danger")).toBe("'\t=danger");
  });

  it("does not over-defuse non-leading dangerous characters", () => {
    expect(csvEscape("price = 100")).toBe("price = 100");
    expect(csvEscape("email@domain.com")).toBe("email@domain.com");
  });
});

describe("csvRow", () => {
  it("joins values with commas", () => {
    expect(csvRow(["a", "b", "c"])).toBe("a,b,c");
  });

  it("quotes individual values as needed", () => {
    expect(csvRow(["plain", "a,b", "with \"quotes\""])).toBe(
      'plain,"a,b","with ""quotes"""'
    );
  });
});

describe("csvDocument", () => {
  it("emits a UTF-8 BOM at start (Excel-friendly)", () => {
    const doc = csvDocument(["a"], [["1"]]);
    expect(doc.charCodeAt(0)).toBe(0xfeff);
  });

  it("emits CRLF line endings (RFC 4180)", () => {
    const doc = csvDocument(["a", "b"], [["1", "2"]]);
    // Strip BOM for clarity
    const body = doc.slice(1);
    expect(body).toBe("a,b\r\n1,2\r\n");
  });

  it("handles an empty rows array", () => {
    const doc = csvDocument(["a", "b"], []);
    expect(doc.slice(1)).toBe("a,b\r\n");
  });

  it("round-trips a realistic mix of fields", () => {
    const doc = csvDocument(
      ["id", "name", "note"],
      [
        ["1", "Plain", "Just text"],
        ["2", "Has, comma", "Has \"quote\""],
        ["3", "=danger", "+also danger"],
      ]
    );
    const lines = doc.slice(1).split("\r\n");
    expect(lines[0]).toBe("id,name,note");
    expect(lines[1]).toBe('1,Plain,Just text');
    expect(lines[2]).toBe('2,"Has, comma","Has ""quote"""');
    expect(lines[3]).toBe("3,'=danger,'+also danger");
  });
});
