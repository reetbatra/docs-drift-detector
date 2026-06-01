import { describe, it, expect } from "vitest";
import {
  extractFromPythonFile,
  extractPythonSurface,
} from "../lib/extract-python";
import type { SourceFile } from "../lib/types";

function makeFile(content: string, path = "api.py"): SourceFile {
  return { path, url: "", content, size: content.length };
}

describe("extractFromPythonFile", () => {
  it("extracts a typed function with docstring", () => {
    const f = makeFile(
      'def greet(name: str) -> str:\n    """Say hello."""\n    return f"Hello, {name}"\n',
    );
    const [sym] = extractFromPythonFile(f);
    expect(sym.kind).toBe("function");
    expect(sym.name).toBe("greet");
    expect(sym.signature).toBe("def greet(name: str) -> str");
    expect(sym.doc).toBe("Say hello.");
    expect(sym.line).toBe(1);
  });

  it("extracts an async function", () => {
    const f = makeFile("async def fetch(url: str) -> bytes:\n    pass\n");
    const [sym] = extractFromPythonFile(f);
    expect(sym.kind).toBe("function");
    expect(sym.name).toBe("fetch");
    expect(sym.signature).toBe("async def fetch(url: str) -> bytes");
  });

  it("excludes private functions", () => {
    const f = makeFile(
      "def _internal() -> None:\n    pass\n\ndef public() -> None:\n    pass\n",
    );
    const syms = extractFromPythonFile(f);
    expect(syms).toHaveLength(1);
    expect(syms[0].name).toBe("public");
  });

  it("extracts a class with public methods and excludes private methods", () => {
    const f = makeFile(
      [
        "class Linter:",
        '    """Main linter class."""',
        "    def check(self, code: str) -> list[str]:",
        "        pass",
        "    def _helper(self) -> None:",
        "        pass",
      ].join("\n"),
    );
    const [cls] = extractFromPythonFile(f);
    expect(cls.kind).toBe("class");
    expect(cls.name).toBe("Linter");
    expect(cls.doc).toBe("Main linter class.");
    expect(cls.signature).toContain("def check(self, code: str) -> list[str]");
    expect(cls.signature).not.toContain("_helper");
  });

  it("includes dunder methods in class signatures", () => {
    const f = makeFile(
      [
        "class Rule:",
        "    def __init__(self, name: str) -> None:",
        "        self.name = name",
        "    def apply(self, code: str) -> bool:",
        "        pass",
      ].join("\n"),
    );
    const [cls] = extractFromPythonFile(f);
    expect(cls.signature).toContain("def __init__(self, name: str) -> None");
    expect(cls.signature).toContain("def apply(self, code: str) -> bool");
  });

  it("extracts a multi-line function signature", () => {
    const f = makeFile(
      [
        "def complex(",
        "    arg1: int,",
        "    arg2: str = 'default',",
        ") -> dict[str, int]:",
        "    pass",
      ].join("\n"),
    );
    const [sym] = extractFromPythonFile(f);
    expect(sym.name).toBe("complex");
    expect(sym.signature).toContain("arg1: int");
    expect(sym.signature).toContain("arg2: str = 'default'");
    expect(sym.signature).toContain("-> dict[str, int]");
  });

  it("extracts a typed module constant", () => {
    const f = makeFile("MAX_ERRORS: int = 10\n");
    const [sym] = extractFromPythonFile(f);
    expect(sym.kind).toBe("const");
    expect(sym.name).toBe("MAX_ERRORS");
    expect(sym.signature).toBe("MAX_ERRORS: int");
  });

  it("handles .pyi stub syntax (inline ellipsis)", () => {
    const f = makeFile(
      "def validate(data: dict) -> bool: ...\n",
      "types.pyi",
    );
    const [sym] = extractFromPythonFile(f);
    expect(sym.kind).toBe("function");
    expect(sym.name).toBe("validate");
    expect(sym.signature).toBe("def validate(data: dict) -> bool");
  });

  it("returns an empty array for an empty file", () => {
    expect(extractFromPythonFile(makeFile(""))).toHaveLength(0);
  });
});

describe("extractPythonSurface", () => {
  it("combines symbols from multiple files", () => {
    const files = [
      makeFile("def foo() -> None:\n    pass\n", "a.py"),
      makeFile("def bar() -> None:\n    pass\n", "b.py"),
    ];
    const syms = extractPythonSurface(files);
    expect(syms).toHaveLength(2);
    expect(syms.map((s) => s.name)).toContain("foo");
    expect(syms.map((s) => s.name)).toContain("bar");
  });

  it("respects maxSymbols", () => {
    const content = Array.from(
      { length: 10 },
      (_, i) => `def fn${i}() -> None:\n    pass`,
    ).join("\n\n");
    const syms = extractPythonSurface([makeFile(content)], { maxSymbols: 3 });
    expect(syms).toHaveLength(3);
  });
});
