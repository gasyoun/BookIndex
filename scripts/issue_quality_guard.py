#!/usr/bin/env python3
"""GitHub issue text quality guard (RU-focused).

Checks issues/comments for mojibake-like artifacts and optional body template.
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from typing import Iterable, List

import requests


CYR_RE = re.compile(r"[\u0400-\u04FF]")
LAT_RE = re.compile(r"[A-Za-z]")
MOJIBAKE_CYRILLIC_PAIR_RE = re.compile(r"(?:[РС][\u0080-\u04FF]){3,}")
MOJIBAKE_LATIN1_PAIR_RE = re.compile(r"(?:Ð.|Ñ.){3,}")


@dataclass
class Finding:
    issue_number: int
    target: str  # "issue" | "comment:<id>"
    reason: str


def count_cyr(text: str) -> int:
    return len(CYR_RE.findall(text or ""))


def count_latin(text: str) -> int:
    return len(LAT_RE.findall(text or ""))


def detect_text_problems(text: str, *, require_template: bool = False) -> List[str]:
    body = str(text or "")
    if not body.strip():
        return []

    findings: List[str] = []
    q_count = body.count("?")
    cyr = count_cyr(body)
    latin = count_latin(body)
    letters = cyr + latin

    if "\ufffd" in body:
        findings.append("contains U+FFFD replacement character")
    if "???" in body:
        findings.append("contains '???' sequence")
    if MOJIBAKE_CYRILLIC_PAIR_RE.search(body):
        findings.append("contains probable UTF-8/CP1251 mojibake sequence")
    if MOJIBAKE_LATIN1_PAIR_RE.search(body):
        findings.append("contains probable UTF-8/Latin-1 mojibake sequence")
    # High question-mark density with no Cyrillic usually means broken RU text.
    if q_count >= 8 and cyr == 0 and letters >= 30:
        findings.append(f"too many '?' without Cyrillic (q={q_count}, letters={letters})")

    if require_template:
        if "Цель:" not in body:
            findings.append("missing 'Цель:' section")
        if "Критерии готовности:" not in body:
            findings.append("missing 'Критерии готовности:' section")

    return findings


def parse_repo(value: str) -> tuple[str, str]:
    raw = (value or "").strip()
    if not raw or "/" not in raw:
        raise ValueError("repo must be in format owner/name")
    owner, name = raw.split("/", 1)
    owner = owner.strip()
    name = name.strip()
    if not owner or not name:
        raise ValueError("repo must be in format owner/name")
    return owner, name


def token_from_git_credential() -> str:
    proc = subprocess.run(
        ["git", "credential", "fill"],
        input="protocol=https\nhost=github.com\n\n",
        text=True,
        capture_output=True,
        check=True,
    )
    for line in proc.stdout.splitlines():
        if line.startswith("password="):
            return line.split("=", 1)[1].strip()
    raise RuntimeError("GitHub token not found in git credential store")


def get_token() -> str:
    env_token = (os.getenv("GITHUB_TOKEN") or os.getenv("GH_TOKEN") or "").strip()
    if env_token:
        return env_token
    return token_from_git_credential()


def fetch_issue(session: requests.Session, owner: str, repo: str, number: int) -> dict:
    url = f"https://api.github.com/repos/{owner}/{repo}/issues/{number}"
    resp = session.get(url, timeout=30)
    resp.raise_for_status()
    return resp.json()


def fetch_issue_comments(session: requests.Session, owner: str, repo: str, number: int) -> list[dict]:
    out: list[dict] = []
    page = 1
    while True:
        url = f"https://api.github.com/repos/{owner}/{repo}/issues/{number}/comments?per_page=100&page={page}"
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
        batch = resp.json()
        if not batch:
            break
        out.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    return out


def list_issues(
    session: requests.Session, owner: str, repo: str, state: str = "all", limit: int = 0
) -> list[dict]:
    out: list[dict] = []
    page = 1
    while True:
        url = (
            f"https://api.github.com/repos/{owner}/{repo}/issues"
            f"?state={state}&per_page=100&page={page}&sort=created&direction=asc"
        )
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
        batch = resp.json()
        if not batch:
            break
        for it in batch:
            if "pull_request" in it:
                continue
            out.append(it)
            if limit > 0 and len(out) >= limit:
                return out
        if len(batch) < 100:
            break
        page += 1
    return out


def analyze_issue_payload(
    issue: dict,
    *,
    check_comments: bool,
    comments: Iterable[dict],
    strict_template: bool,
) -> List[Finding]:
    findings: List[Finding] = []
    number = int(issue.get("number", 0))
    title = str(issue.get("title") or "")
    body = str(issue.get("body") or "")
    issue_text = title + "\n" + body
    problems = detect_text_problems(issue_text, require_template=strict_template)
    for p in problems:
        findings.append(Finding(issue_number=number, target="issue", reason=p))

    if check_comments:
        for c in comments:
            cid = int(c.get("id", 0))
            cb = str(c.get("body") or "")
            for p in detect_text_problems(cb, require_template=False):
                findings.append(Finding(issue_number=number, target=f"comment:{cid}", reason=p))
    return findings


def build_session(token: str) -> requests.Session:
    s = requests.Session()
    s.headers.update(
        {
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github+json",
            "User-Agent": "issue-quality-guard",
        }
    )
    return s


def main() -> int:
    parser = argparse.ArgumentParser(description="Check GitHub issues/comments for text quality problems.")
    parser.add_argument("--repo", default="gasyoun/BookIndex", help="Repository in owner/name format")
    parser.add_argument(
        "--issues",
        nargs="*",
        type=int,
        default=[],
        help="Specific issue numbers to check; if omitted, scans repository issues",
    )
    parser.add_argument("--state", default="all", choices=["open", "closed", "all"])
    parser.add_argument("--limit", type=int, default=0, help="Limit issue count when scanning full repo")
    parser.add_argument("--skip-comments", action="store_true", help="Do not check comments")
    parser.add_argument(
        "--strict-template",
        action="store_true",
        help="Require 'Цель:' and 'Критерии готовности:' in issue body",
    )
    args = parser.parse_args()

    owner, repo = parse_repo(args.repo)
    token = get_token()
    session = build_session(token)

    findings: List[Finding] = []

    if args.issues:
        issues = [fetch_issue(session, owner, repo, n) for n in args.issues]
    else:
        issues = list_issues(session, owner, repo, state=args.state, limit=args.limit)

    for issue in issues:
        number = int(issue.get("number", 0))
        comments = []
        if not args.skip_comments:
            comments = fetch_issue_comments(session, owner, repo, number)
        findings.extend(
            analyze_issue_payload(
                issue,
                check_comments=not args.skip_comments,
                comments=comments,
                strict_template=args.strict_template,
            )
        )

    if findings:
        print("[FAIL] Found text quality problems:")
        for f in findings:
            print(f"  - issue #{f.issue_number} [{f.target}] {f.reason}")
        return 1

    print("[OK] No issue/comment text quality problems found.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
