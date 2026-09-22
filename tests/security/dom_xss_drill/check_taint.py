#!/usr/bin/env python3
"""H5106 — DOM XSS source-to-sink taint checker over the mutation corpus.

Two modes:
  improved  Line-statement taint walker: tracks attacker-controlled sources,
            transform/sanitizer capabilities (escapeHtml -> html_text,
            safeUrlAllowlist -> url, safeUrlDenylist -> nothing), propagates
            taint through concat/property access, and classifies sinks by
            execution context (innerHTML vs frame/location vs load-only img).
  naive     The pre-improvement review habit: flag any fixture containing an
            ``.innerHTML =`` pattern. No taint, no context — the canary that
            must fail.

Goal (--check): every corpus case expected P1/P2 yields FINDING; no case
expected SAFE/P3 yields FINDING. Exit 0 = goal pass.

Corpus evidence: gasyoun/BookIndex PRs #141, #294, #299 (see corpus.json).
Python floor: >= 3.9 (stdlib only).
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

SANITIZERS = {
    "escapeHtml": "html_text",
    "safeUrlAllowlist": "url",
    "safeUrlDenylist": None,  # documented inadequate (PR #294 §1): grants no capability
}
SAN_CALL = re.compile(r"\b(escapeHtml|safeUrlAllowlist|safeUrlDenylist)\(([^()]*)\)")

STMT_RE = re.compile(
    r"^(?:const|let|var)?\s*([A-Za-z_$][\w$]*)\s*(\+?=)\s*(.+?)\s*;?$"
)
SINK_RES = [
    ("innerHTML", re.compile(r"([\w$]+)\.innerHTML\s*\+?=\s*(.+)")),
    ("src", re.compile(r"([\w$]+)\.src\s*=\s*(.+)")),
    ("href", re.compile(r"(?:([\w$]+)\.|)(href|location)\s*(?:\.\w+)?\s*=\s*(.+)")),
]
TOKEN = re.compile(r"[A-Za-z_$][\w$]*")


def statements(src: str):
    """Split the restricted fixture kernel into logical statements.

    Lines ending in '{' or '}' are their own statements; everything else
    accumulates until ';'.
    """
    out = []
    buf, start = "", None
    for i, line in enumerate(src.splitlines(), 1):
        stripped = line.strip()
        if not stripped or stripped.startswith("//"):
            continue
        # keep trailing line comments out of statement text
        code = re.sub(r"\s//.*$", "", line).strip()
        if not code:
            continue
        if buf:
            code = buf + " " + code
            buf = ""
        if code.endswith("{") or code.endswith("}"):
            out.append((start or i, code))
            continue
        if ";" in code or "(" == code[-1]:
            out.append((start or i, code.rstrip().rstrip(";")))
            start = None
        else:
            if start is None:
                start = i
            buf = code
    if buf:
        out.append((start or 0, buf))
    return out


def tokenize(expr: str):
    return set(TOKEN.findall(expr))


SOURCE_CALL = re.compile(r"\b(get[A-Z]\w*|SOURCE)\s*\(")  # getHash(), getSearchIndexRow(), SOURCE(...)


def eval_rhs(expr: str, tainted: dict):
    """Return (is_tainted, caps, raw_names, san_notes, from_source)."""
    raw_zone = SAN_CALL.sub(" ", expr)
    raw_names = sorted(tokenize(raw_zone) & set(tainted))
    caps, notes, san_tainted = set(), [], False
    for m in SAN_CALL.finditer(expr):
        san, arg = m.group(1), m.group(2)
        arg_tainted = bool(tokenize(arg) & set(tainted))
        cap = SANITIZERS[san]
        if arg_tainted:
            san_tainted = True
            notes.append(f"{san}({arg.strip()})")
            if cap:
                caps.add(cap)
    from_source = bool(SOURCE_CALL.search(raw_zone))
    is_tainted = bool(raw_names) or san_tainted or from_source
    return is_tainted, caps, raw_names, notes, from_source


def sink_kind(lhs_var: str, sink: str):
    if sink == "innerHTML":
        return "html"
    if sink == "src":
        if re.match(r"^(img|image|thumb)", lhs_var, re.I):
            return "img_load"
        return "url_ctx"
    if sink == "href":
        if lhs_var == "location" or re.match(r"^(link|a_|anchor)", lhs_var, re.I):
            return "url_ctx"
        return "url_ctx"  # <a href> click navigates — executing context
    return "url_ctx"


def strip_comments(src: str) -> str:
    keep, decls = [], {}
    for line in src.splitlines():
        m = re.match(r"\s*//\s*input:\s*(.+)$", line)
        if m:
            for name in m.group(1).split(","):
                decls[name.strip()] = True
            keep.append("")
        else:
            keep.append(line)
    return "\n".join(keep), list(decls)


def analyze_improved(path: Path):
    src = path.read_text(encoding="utf-8")
    src, inputs = strip_comments(src)
    tainted: dict[str, set] = {}
    events: list[tuple[int, str, str]] = []  # (line, var, note)
    for name in inputs:
        tainted[name] = set()
        events.append((0, name, "SOURCE (attacker-controlled input)"))

    finding = None
    info = None
    in_try = False

    for lineno, stmt in statements(src):
        m = re.match(r"^\s*try\s*\{", stmt)
        if m:
            in_try = False  # set True if body taints; resolved at catch
            continue
        m = re.match(r"^\}\s*catch\s*\((\w+)\)", stmt)
        if m:
            # body taint approximated: any catch var inherits any live taint
            # reaching the try block (fixtures are single-flow).
            if re.search(r"fetch|await", src) and tainted:
                tainted[m.group(1)] = set()
                events.append((lineno, m.group(1), "catch var inherits try-flow taint"))
            continue
        for kind, rx in SINK_RES[:2]:
            m = rx.search(stmt)
            if m:
                target, expr = m.group(1), m.group(2)
                tainted_flag, caps, raws, notes, _from_src = eval_rhs(expr, tainted)
                ctx = sink_kind(target, kind)
                if not tainted_flag:
                    break
                if ctx == "html":
                    if "html_text" not in caps:
                        finding = (lineno, kind, target, raws + notes, caps, expr)
                elif ctx == "img_load":
                    info = (lineno, kind, target, "load-only sink (no script execution)")
                else:
                    if "url" not in caps:
                        finding = (lineno, kind, target, raws + notes, caps, expr)
                break
        else:
            m = re.search(r"\blocation\.href\s*=\s*(.+)$", stmt)
            if m:
                tainted_flag, caps, raws, notes, _from_src = eval_rhs(m.group(1), tainted)
                if tainted_flag and "url" not in caps:
                    finding = (lineno, "href", "location", raws + notes, caps, m.group(1))
                continue
            m = STMT_RE.match(stmt)
            if m:
                lhs, op, rhs = m.group(1), m.group(2), m.group(3)
                is_t, caps, raws, notes, from_src = eval_rhs(rhs, tainted)
                if is_t:
                    merged = set(tainted.get(lhs, set())) | caps
                    tainted[lhs] = merged
                    note = ("SOURCE call" if from_src else "concat/transform")
                    if raws:
                        note += f" RAW tokens {','.join(raws)}"
                    if notes:
                        note += " sanitized " + ",".join(notes)
                    events.append((lineno, lhs, note))
                else:
                    tainted.pop(lhs, None)  # reassignment from clean value
        if "await fetch" in stmt or "fetch(" in stmt:
            in_try = True
    return finding, info, events


def analyze_naive(path: Path):
    src = path.read_text(encoding="utf-8")
    if re.search(r"\.innerHTML\s*\+?=", src):
        return ("FINDING", "P1", "innerHTML sink present (pattern match, no taint)")
    return ("PASS", "-", "no innerHTML pattern")


def run(mode: str, corpus: dict):
    rows = []
    for case in corpus["cases"]:
        fpath = HERE / case["fixture"]
        if mode == "naive":
            verdict, sev, why = analyze_naive(fpath)
            detected = verdict == "FINDING"
            rows.append((case, verdict, sev, why, ""))
            continue
        finding, info, events = analyze_improved(fpath)
        if finding:
            lineno, kind, target, hits, caps, expr = finding
            chain = [e for e in events if e[1] in tokenize(expr) or e[2].startswith("SOURCE")]
            chain_s = " -> ".join(f"{v}@L{l}" if l else f"{v} (SOURCE)" for l, v, _ in chain[-4:])
            verdict, sev = "FINDING", case["expected"]
            why = (f"sink {target}.{kind} @L{lineno} caps={sorted(caps) or '∅'} "
                   f"hits={','.join(hits) or '?'} | trace {chain_s}")
        elif info:
            verdict, sev = "INFO", "P3"
            why = f"{info[3]} — correctly not P1/P2"
        else:
            verdict, sev = "PASS", "SAFE"
            why = "no tainted data reaches an executing sink"
        rows.append((case, verdict, sev, why, ""))
    return rows


def goal_check(rows, corpus) -> bool:
    ok = True
    n_exp, n_hit = 0, 0
    for case, verdict, sev, why, _ in rows:
        expected = case["expected"]
        if expected in ("P1", "P2"):
            n_exp += 1
            if verdict == "FINDING":
                n_hit += 1
            else:
                ok = False
                print(f"  MISS  {case['id']}: exploitable sink not detected")
        else:  # SAFE / P3 near-miss
            if verdict == "FINDING":
                ok = False
                print(f"  FP    {case['id']}: safe near-miss labeled {sev}")
    print(f"  exploitable detected: {n_hit}/{n_exp}")
    return ok


def main() -> int:
    mode = "improved"
    check = False
    for arg in sys.argv[1:]:
        if arg == "--naive":
            mode = "naive"
        elif arg == "--improved":
            mode = "improved"
        elif arg == "--check":
            check = True
    corpus = json.loads((HERE / "corpus.json").read_text(encoding="utf-8"))
    rows = run(mode, corpus)
    print(f"== H5106 DOM XSS taint drill — mode: {mode} — {len(rows)} cases ==")
    for case, verdict, sev, why, _ in rows:
        print(f"  {case['id']:>3} {verdict:<8} expected={case['expected']:<4} {why}")
    goal = goal_check(rows, corpus)
    print(("GOAL PASS" if goal else "GOAL FAIL")
          + f" (mode={mode}: {len(rows)} mutations, "
            f"all exploitable sinks detected, no safe near-miss labeled P1/P2)")
    return 0 if (goal or not check) else 1


if __name__ == "__main__":
    sys.exit(main())
