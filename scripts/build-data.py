"""Build public/data.js and public/assets/ for Culture Collective.

Reads the Phase 3 tab of the group workbook (rows 9-13) and the past/, present/ and future/
image folders, then writes one data file the museum loads.

Run from anywhere:  python culture-collective/scripts/build-data.py
Re-run after editing the workbook or swapping an image.
"""
import json
import re
import shutil
import sys
from pathlib import Path

import openpyxl

sys.stdout.reconfigure(encoding="utf-8")

APP = Path(__file__).resolve().parents[1]           # culture-collective/
PROJECT = APP.parent                                # pop culture/
PUBLIC = APP / "public"
WORKBOOK = PROJECT / "Phil Pop Culture _ MO-HUM080 Workbook Phase 2 & 3 _ H1102 _ Group 2 .xlsx"
SHEET = "PHASE 3 - Final Group WS 3"
ROWS = range(9, 14)

ERAS = [  # id, folder, years, room name
    ("past", "past", "2000–2010", "Room 1 · Then"),
    ("present", "present", "2025–2026", "Room 2 · Now"),
    ("future", "future", "2030", "Room 3 · Next"),
]

ASPECTS = [  # key, label, image subfolder, curator, columns for (past, present, future)
    ("affect", "Affect, Senses & Feelings", "Affect, senses and feelings", "Menzon, Christian Joseph", "EFG"),
    ("body", "Body & Self-Image", "Body and Self-image", "Caballa, Dave Paulo", "HIJ"),
    ("performance", "Performance", "Performance", "Giltendez, Danilo", "KLM"),
]

# Image file (without .jpg) for each workbook row, in row order 9-13.
IMAGES = {
    "past": {
        "affect": ["1-feelings-then-edsa-dos", "1-feelings-then-guinsaugon", "1-feelings-then-ondoy",
                   "1-feelings-then-maguindanao", "1-feelings-then-hostage-crisis"],
        "body": ["1-body-then-fashion-icons", "1-body-then-makeup", "1-body-then-clothing",
                 "1-body-then-accessories", "1-body-then-hair"],
        "performance": ["1-performance-then-pbb", "1-performance-then-sexbomb", "1-performance-then-telefantasya",
                        "1-performance-then-dancing-inmates", "1-performance-then-sarah-geronimo"],
    },
    "present": {
        "affect": ["2-feelings-now-midterms-icc", "2-feelings-now-cebu-earthquake", "2-feelings-now-super-el-nino",
                   "2-feelings-now-degamo", "2-feelings-now-tacloban-school-shooting"],
        "body": ["2-body-now-kathryn-bernardo", "2-body-now-no-brow", "2-body-now-baggy-jeans",
                 "2-body-now-piercings-tattoos", "2-body-now-hair"],
        "performance": ["2-performance-now-team-payaman", "2-performance-now-bini", "2-performance-now-batang-quiapo",
                        "2-performance-now-tiktok", "2-performance-now-sb19"],
    },
    "future": {
        "affect": ["3-feelings-2030-judicial-reform-crisis", "3-feelings-2030-red-zone-resettlement",
                   "3-feelings-2030-climate-resistant-agriculture", "3-feelings-2030-private-army-crackdown",
                   "3-feelings-2030-secure-communities"],
        "body": ["3-body-2030-social-media-personality-ivana-alawi", "3-body-2030-natural-makeup",
                 "3-body-2030-skinny-jeans", "3-body-2030-smart-accessories", "3-body-2030-side-swept-bangs"],
        "performance": ["3-performance-2030-ai-assisted-creator", "3-performance-2030-virtual-ppop-group",
                        "3-performance-2030-immersive-storyworlds", "3-performance-2030-participatory-avatar-dance",
                        "3-performance-2030-global-entertainment-ecosystem"],
    },
}

DEFAULT_CREDIT = {
    "past": "Image collected by the curators for this class exhibit.",
    "present": "Image collected by the curators for this class exhibit.",
    "future": "Image generated with AI (Canva) for this exhibition. All people shown are invented.",
}
CREDITS = {  # from the image folders' notes and future/SOURCES-AND-CREDITS.md
    "2-feelings-now-tacloban-school-shooting": "Photo courtesy RMN Tacloban, via Inquirer.net.",
    "3-body-2030-social-media-personality-ivana-alawi":
        "Screengrab from YouTube/Ivana Alawi (youtube.com/watch?v=aT1brvgJDfo), shown as a present-day example of the prediction.",
    "3-body-2030-smart-accessories":
        "Left: Ray-Ban Meta smart glasses, photo by CCadio, CC BY 4.0. Right: Samsung Galaxy Ring, "
        "photo by Miyako Fujimiya, CC BY 4.0. Both via Wikimedia Commons, resized and combined.",
}

# Short wall-label titles where the cell's lead-in is too long. Key: (era, aspect, row index 0-4).
TITLES = {
    ("past", "affect", 4): "Manila Hostage Crisis",
    ("past", "performance", 0): "Pinoy Big Brother & Reality TV",
    ("past", "performance", 1): "SexBomb Girls & Noontime TV",
    ("present", "affect", 0): "Midterm Elections & Duterte's ICC Arrest",
    ("present", "affect", 3): "Assassination of Gov. Roel Degamo",
    ("present", "body", 1): "The “No-Brow” Look",
    ("present", "body", 4): "Mullet & Wolf Cut",
    ("present", "performance", 0): "Vloggers: Team Payaman",
    ("present", "performance", 1): "BINI",
    ("present", "performance", 2): "Crime Drama: Batang Quiapo",
    ("present", "performance", 4): "P-Pop: SB19",
}

SITE = {
    "name": "Culture Collective",
    "course": "MO-HUM080 Philippine Popular Culture · H1102 · Group 2",
    "school": "Mapúa Malayan Digital College",
    "welcome": [
        "Welcome to Culture Collective, a digital museum of Philippine popular culture.",
        "Walk through three eras: 2000–2010, the decade of texting, telefantasyas and reality TV; "
        "2025–2026, the age of feeds, creators and P-pop; and 2030, where we imagine what comes next.",
        "In every room, explore how Filipinos felt, how they saw themselves, and how they performed and were entertained.",
        "Leave your thoughts on each room's Freedom Wall, and collect a stamp in your passport along the way.",
    ],
    "curators": [
        "Aguinaldo, Debbie", "Bautista, Eldrianne Alyanna", "Caballa, Dave Paulo", "De Guzman, Daniel Ceasar",
        "Giltendez, Danilo", "Menzon, Christian Joseph", "Sorilla, Briggs",
    ],
    # Correct answer is listed first; the app shuffles the choices.
    "trivia": {
        "past": {"q": "Which 2001 event peacefully removed President Joseph Estrada from office?",
                 "choices": ["EDSA Dos", "The Hello Garci scandal", "The Manila Hostage Crisis", "Typhoon Ondoy"]},
        "present": {"q": "Which group represents today's female pop and dance icons, taking over from the "
                         "TV-centered dance culture of groups like SexBomb?",
                    "choices": ["BINI", "SB19", "Team Payaman", "The Dancing Inmates"]},
        "future": {"q": "Because fashion moves in cycles, which item does the museum predict will return by 2030?",
                   "choices": ["Skinny jeans", "Butterfly clips", "Tube tops", "Cargo pants"]},
    },
}


def clean(s):
    s = str(s or "").replace("\r", "")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r" *\n *", "\n", s)
    return re.sub(r"\n{2,}", "\n\n", s).strip()


def split(text):
    """Return (year, title, body) from a worksheet cell like '2001: EDSA Dos - a four-day...'."""
    t = clean(text)
    year = ""
    m = re.match(r"^((?:19|20)\d\d)\s*:\s*", t)
    if m:
        year, t = m.group(1), t[m.end():]
    m = re.search(r"\s+[-–]\s+|:\s|\n|\.\s", t)
    if m and m.start() <= 110:
        title, body = t[: m.start()].strip(), t[m.end():].strip()
    else:
        title, body = t[:80].strip(), t
    if body:
        body = body[0].upper() + body[1:]
    return year, title.rstrip(".:"), body


def main():
    ws = openpyxl.load_workbook(WORKBOOK, data_only=True)[SHEET]
    assets = PUBLIC / "assets"
    if assets.exists():
        shutil.rmtree(assets)
    problems = []
    rooms = []
    for era_i, (era, folder, years, name) in enumerate(ERAS):
        room = {"id": era, "years": years, "name": name, "aspects": []}
        for key, label, sub, curator, cols in ASPECTS:
            items = []
            for n, row in enumerate(ROWS):
                cell = f"{cols[era_i]}{row}"
                year, title, body = split(ws[cell].value)
                if not title:
                    problems.append(f"{era}/{key}: cell {cell} is empty")
                img = IMAGES[era][key][n]
                src = PROJECT / folder / sub / f"{img}.jpg"
                dst = assets / era / f"{img}.jpg"
                dst.parent.mkdir(parents=True, exist_ok=True)
                if src.exists():
                    shutil.copy2(src, dst)
                else:
                    problems.append(f"missing image {src}")
                items.append({
                    "id": f"{era}-{key}-{n + 1}",
                    "cell": cell,
                    "year": year,
                    "title": TITLES.get((era, key, n), title),
                    "text": body,
                    "curator": curator,
                    "img": f"assets/{era}/{img}.jpg",
                    "credit": CREDITS.get(img, DEFAULT_CREDIT[era]),
                })
            room["aspects"].append({"key": key, "label": label, "items": items})
        rooms.append(room)

    out = PUBLIC / "data.js"
    out.write_text(
        "// Generated by scripts/build-data.py from the Phase 3 worksheet and image folders. Do not edit by hand.\n"
        "window.CC_DATA = " + json.dumps({"site": SITE, "rooms": rooms}, ensure_ascii=False, indent=1) + ";\n",
        encoding="utf-8",
    )
    total = sum(len(a["items"]) for r in rooms for a in r["aspects"])
    print(f"Wrote {out.relative_to(PROJECT)}: {total} exhibits, {len(list(assets.rglob('*.jpg')))} images copied.")
    for r in rooms:
        for a in r["aspects"]:
            for it in a["items"]:
                print(f"  {it['id']:<22} {it['cell']:<4} {it['year']:<5} {it['title']}")
    if problems:
        print("\nPROBLEMS:\n  " + "\n  ".join(problems))
        sys.exit(1)


if __name__ == "__main__":
    main()
