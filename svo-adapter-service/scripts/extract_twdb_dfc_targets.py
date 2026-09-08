#!/usr/bin/env python3
"""Extract adopted TWDB 2021 DFC target records from the source PDF text.

The PDF is not a tagged table. This script uses `pdftotext -layout` output and
keeps enough source provenance that generated records can be audited against the
original document. Matrix-style GMA tables are handled explicitly; simpler
date-row tables use a conservative parser.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any


SOURCE_URL = (
    "https://ckan.tacc.utexas.edu/dataset/4bbe5679-139b-48a2-9491-ada8c1b98c23/"
    "resource/30ed14c6-6e38-4123-83a4-5b3a31e952bb/download/"
    "all_adopted_desired_future_outcomes.pdf"
)
DATE_RE = re.compile(r"\b\d{1,2}/\d{1,2}/\d{4}\b")
GMA_RE = re.compile(r"Groundwater Management Area \(GMA\) (\d+)")


def _clean(s: str) -> str:
    return re.sub(r"\s+", " ", s.replace("“", '"').replace("”", '"')).strip()


def _metric(statement: str) -> str:
    text = statement.lower()
    if any(term in text for term in ("springflow", "stream/spring", "stream flow", "spring flow", "salado creek", "springs")):
        return "spring_or_stream_flow"
    if any(term in text for term in ("saturated thickness", "percent saturation", "volume in storage", "available drawdown remaining")):
        return "saturated_thickness_or_storage"
    if any(term in text for term in ("water level", "potentiometric", "well ")):
        return "water_level"
    if any(term in text for term in ("drawdown", "decline", "recovery")):
        return "drawdown"
    return "other"


def _target_values(statement: str) -> list[dict[str, Any]]:
    text = statement.replace(",", "")
    values: list[dict[str, Any]] = []
    for m in re.finditer(r"(\d+(?:\.\d+)?)\s*(?:-|to|–)\s*(\d+(?:\.\d+)?)\s*(mgd|cfs|acre-feet per month|feet|ft|percent)", text, re.I):
        unit = m.group(3).lower().replace("ft", "feet")
        values.append({"min": float(m.group(1)), "max": float(m.group(2)), "unit": unit})
    if values:
        return values
    patterns = [
        (r"(\d+(?:\.\d+)?)\s*acre-feet per month", "acre-feet per month"),
        (r"(\d+(?:\.\d+)?)\s*cubic\s+feet\s+per\s+second", "cfs"),
        (r"(\d+(?:\.\d+)?)\s*cfs", "cfs"),
        (r"(\d+(?:\.\d+)?)\s*mgd", "mgd"),
        (r"(\d+(?:\.\d+)?)\s*percent", "percent"),
        (r"(\d+(?:\.\d+)?)\s*-\s*ft", "feet"),
        (r"(\d+(?:\.\d+)?)\s*ft\b", "feet"),
        (r"(\d+(?:\.\d+)?)\s*feet", "feet"),
        (r"(\d+(?:\.\d+)?)\s*foot\b", "feet"),
    ]
    for pattern, unit in patterns:
        m = re.search(pattern, text, re.I)
        if m:
            values.append({"value": float(m.group(1)), "unit": unit})
            break
    return values


def _period(statement: str) -> dict[str, int] | None:
    years = [int(y) for y in re.findall(r"\b(19\d{2}|20\d{2})\b", statement)]
    if len(years) >= 2:
        return {"baseline_year": years[0], "target_year": years[-1]}
    if len(years) == 1:
        return {"target_year": years[0]}
    return None


def _record(
    records: list[dict[str, Any]],
    *,
    gma: int,
    pdf_page: int,
    source_line: int,
    adoption_date: str,
    statement: str,
    aquifer: str | None = None,
    area: str | None = None,
    area_type: str | None = None,
    aquifer_system: str | None = None,
    notes: str | None = None,
) -> None:
    statement = _clean(statement)
    if not statement or statement.lower().startswith("date dfc adopted"):
        return
    rec: dict[str, Any] = {
        "id": f"gma{gma:02d}-{len([r for r in records if r['gma'] == gma]) + 1:03d}",
        "gma": gma,
        "area": _clean(area) if area else None,
        "area_type": area_type,
        "aquifer": _clean(aquifer) if aquifer else None,
        "aquifer_system": _clean(aquifer_system) if aquifer_system else None,
        "metric": _metric(statement),
        "dfc_statement": statement,
        "target_values": _target_values(statement),
        "period": _period(statement),
        "adoption_date": adoption_date,
        "source": {
            "title": "Adopted Desired Future Conditions - 2021",
            "url": SOURCE_URL,
            "pdf_page": pdf_page,
            "text_line": source_line,
        },
    }
    if notes:
        rec["notes"] = _clean(notes)
    records.append(rec)


def _page_lines(pages: list[str], page_num: int) -> list[tuple[int, str]]:
    start = sum(len(p.splitlines()) for p in pages[: page_num - 1]) + page_num
    return [(start + idx, line.rstrip()) for idx, line in enumerate(pages[page_num - 1].splitlines(), 1)]


def _parse_gma8(records: list[dict[str, Any]], pages: list[str]) -> None:
    # Page 16: Edwards BFZ stream/spring flow and Northern Trinity/Woodbine rows.
    lines = _page_lines(pages, 16)
    joined = "\n".join(line for _, line in lines)
    manual = [
        ("Bell", "Edwards (Balcones Fault Zone [BFZ])", "Maintain at least 100 acre-feet per month of stream/spring flow in Salado Creek during a repeat of the drought of record", 607),
        ("Travis", "Edwards (Balcones Fault Zone [BFZ])", "Maintain at least 42 acre-feet per month of aggregated stream/spring flow during a repeat of the drought of record", 610),
        ("Williamson", "Edwards (Balcones Fault Zone [BFZ])", "Maintain at least 60 acre-feet per month of aggregated stream/spring flow during a repeat of the drought of record", 613),
    ]
    for area, aquifer, statement, line in manual:
        _record(records, gma=8, pdf_page=16, source_line=line, area=area, area_type="county", aquifer=aquifer, adoption_date="11/4/2021", statement=statement)
    for source_line, line in lines:
        m = re.match(r"\s*([A-Za-z][A-Za-z ]+?)\s+Total average drawdown of\s+(\d+)\s+feet\s+(\d{1,2}/\d{1,2}/\d{4})", line)
        if m:
            aquifer, value, date = m.groups()
            _record(records, gma=8, pdf_page=16, source_line=source_line, aquifer=aquifer, adoption_date=date, statement=f"Total average drawdown of {value} feet from January 1, 2010 through December 31, 2080")

    # Page 17: Llano Uplift matrix.
    for source_line, line in _page_lines(pages, 17):
        m = re.match(r"\s*(Brown|Burnet|Lampasas|Mills)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d{1,2}/\d{1,2}/\d{4})", line)
        if not m:
            continue
        county, ellenburger, hickory, marble, date = m.groups()
        for aquifer, value in [
            ("Ellenburger-San Saba", ellenburger),
            ("Hickory", hickory),
            ("Marble Falls", marble),
        ]:
            _record(records, gma=8, pdf_page=17, source_line=source_line, area=county, area_type="county", aquifer=aquifer, aquifer_system="Llano Uplift Aquifer System", adoption_date=date, statement=f"Total average drawdown of {value} feet from January 1, 2010 through December 31, 2080")


def _parse_gma10(records: list[dict[str, Any]]) -> None:
    rows = [
        ("Austin Chalk", "No drawdown (including exempt and non-exempt use)", 775),
        ("Buda Limestone", "No drawdown (including exempt and non-exempt use)", 777),
        ("Freshwater Edwards, Northern Subdivision", "Springflow at Barton Springs during average recharge conditions shall be no less than 49.7 cubic feet per second (cfs) averaged over an 84-month (7-year) period", 779),
        ("Freshwater Edwards, Northern Subdivision", "Springflow of Barton Springs during extreme drought conditions, including those as severe as a recurrence of the 1950s drought of record, shall be no less than 6.5 cfs average on a monthly basis", 782),
        ("Freshwater Edwards, Western Subdivision", "The water level in well 70-38-902 shall not fall below 1,184 ft mean sea level", 785),
        ("Leona Gravel", "No drawdown (including exempt and non-exempt use)", 788),
        ("Saline Edwards, Northern Subdivision", "No more than 75 feet of regional average potentiometric surface drawdown due to pumping when compared to pre-development conditions", 790),
        ("Trinity", "In Uvalde County: No (zero) regional well drawdown (including exempt and non-exempt use)", 793),
    ]
    for aquifer, statement, source_line in rows:
        _record(records, gma=10, pdf_page=21, source_line=source_line, aquifer=aquifer, adoption_date="10/26/2022", statement=statement)


def _parse_gma11(records: list[dict[str, Any]], pages: list[str]) -> None:
    for page_num in (23, 24):
        for source_line, line in _page_lines(pages, page_num):
            m = re.match(r"\s*([A-Za-z ]+?)\s+(\d+|--)\s+(\d+|--)\s+(\d+|--)\s+(\d{1,2}/\d{1,2}/\d{4})", line)
            if not m:
                continue
            county, sparta, queen_city, carrizo, date = m.groups()
            for aquifer, value in [
                ("Sparta", sparta),
                ("Queen City", queen_city),
                ("Carrizo-Wilcox", carrizo),
            ]:
                if value == "--":
                    continue
                _record(records, gma=11, pdf_page=page_num, source_line=source_line, area=county, area_type="county", aquifer=aquifer, adoption_date=date, statement=f"2013 to 2080 average drawdown of {value} feet for the {aquifer} aquifer")


def _parse_gma12(records: list[dict[str, Any]], pages: list[str]) -> None:
    cw_cols = ["Sparta", "Queen City", "Carrizo", "Calvert Bluff", "Simsboro", "Hooper"]
    for source_line, line in _page_lines(pages, 26):
        m = re.match(r"\s*(.+?)\s+((?:--(?: \*\*\*)?|\d+)\s+(?:--|\d+)\s+(?:--|\d+)\s+(?:--|\d+)\s+(?:--|\d+)\s+(?:--|\d+))\s+(\d{1,2}/\d{1,2}/\d{4})", line)
        if not m:
            continue
        area, vals, date = m.groups()
        values = vals.split()
        if values[:1] == ["--"] and len(values) == 7:
            values = ["-- ***", *values[2:]]
        notes = None
        if "Brazos Valley" in area:
            notes = "PDF footnote: DFCs are average drawdown from 2000 through 2070 for Brazos Valley GCD."
        elif "Fayette County" in area:
            notes = "PDF footnote: DFCs for Fayette County GCD include Fayette County in both GMA 12 and GMA 15."
        for aquifer, value in zip(cw_cols, values[:6]):
            if value.startswith("--"):
                continue
            system = "Carrizo-Wilcox" if aquifer in {"Carrizo", "Calvert Bluff", "Simsboro", "Hooper"} else aquifer
            _record(records, gma=12, pdf_page=26, source_line=source_line, area=area, area_type="gcd_or_county", aquifer=aquifer, aquifer_system=system, adoption_date=date, statement=f"2011 through 2070 average drawdown of {value} feet for the {aquifer} aquifer", notes=notes)

    for source_line, line in _page_lines(pages, 27):
        m = re.match(r"\s*(Brazos Valley GCD|Fayette County GCD|Lost Pines GCD|Mid-East Texas GCD|Post Oak Savannah GCD)\s+(\d+|--)\s+(\d{1,2}/\d{1,2}/\d{4})", line)
        if m:
            area, value, date = m.groups()
            if value != "--":
                _record(records, gma=12, pdf_page=27, source_line=source_line, area=area, area_type="gcd", aquifer="Yegua-Jackson", adoption_date=date, statement=f"2010 through 2069 average drawdown of {value} feet for the Yegua-Jackson Aquifer")

    # Brazos River Alluvium statements span multiple lines in the PDF.
    manual = [
        ("Brazos Valley GCD (Brazos and Robertson counties)", "Brazos River Alluvium", "North of State Highway 21: Percent saturation shall average at least 30 percent of total well depth from 2013 to 2069", 1010),
        ("Brazos Valley GCD (Brazos and Robertson counties)", "Brazos River Alluvium", "South of State Highway 21: Percent saturation shall average at least 40 percent of total well depth from 2013 to 2069", 1012),
        ("Post Oak Savannah GCD (Burleson County)", "Brazos River Alluvium", "A decrease of 6 feet in the average saturated thickness from 2010 to 2069", 1015),
        ("Post Oak Savannah GCD (Milam County)", "Brazos River Alluvium", "A decrease of 5 feet in average saturated thickness from 2010 to 2069", 1018),
    ]
    for area, aquifer, statement, source_line in manual:
        _record(records, gma=12, pdf_page=27, source_line=source_line, area=area, area_type="gcd_or_county", aquifer=aquifer, adoption_date="11/30/2021", statement=statement)


def _parse_gma15(records: list[dict[str, Any]], pages: list[str]) -> None:
    _record(records, gma=15, pdf_page=31, source_line=1154, area="GMA-wide", area_type="gma", aquifer="Gulf Coast Aquifer System", adoption_date="10/14/2021", statement="The desired future conditions for the counties in the groundwater management area shall not exceed an average drawdown of 13 feet for the Gulf Coast Aquifer System at December 2080")
    for source_line, line in _page_lines(pages, 31):
        m = re.match(r"\s*([A-Za-z]+)\s+(.+?)\s+(\d{1,2}/\d{1,2}/\d{4})", line)
        if not m:
            continue
        county, statement, date = m.groups()
        if "feet of" not in statement:
            continue
        _record(records, gma=15, pdf_page=31, source_line=source_line, area=county, area_type="county", aquifer=_aquifer_from_statement(statement), adoption_date=date, statement=statement)


def _parse_gma16(records: list[dict[str, Any]], pages: list[str]) -> None:
    for source_line, line in _page_lines(pages, 33):
        m = re.match(r"\s*(.+?)\s+(\d+ feet of drawdown of the Gulf Coast Aquifer System)\s+(\d{1,2}/\d{1,2}/\d{4})", line)
        if not m:
            continue
        area, statement, date = m.groups()
        _record(records, gma=16, pdf_page=33, source_line=source_line, area=area, area_type="gcd_or_county", aquifer="Gulf Coast Aquifer System", adoption_date=date, statement=statement)


def _aquifer_from_statement(statement: str) -> str | None:
    m = re.search(r"of the (.+? Aquifer(?:s| System)?)$", statement)
    if m:
        return m.group(1)
    return None


def _generic_parse(records: list[dict[str, Any]], pages: list[str]) -> None:
    special = {8, 10, 11, 12, 15, 16}
    for page_num, page in enumerate(pages, 1):
        gma_match = GMA_RE.search(page)
        if not gma_match:
            continue
        gma = int(gma_match.group(1))
        if gma in special:
            continue
        page_lines = _page_lines(pages, page_num)
        relevant = False
        for idx, (source_line, line) in enumerate(page_lines):
            if "Adopted Desired Future Conditions" in line:
                relevant = True
                continue
            if "Non-Relevant Aquifers" in line:
                relevant = False
            if not relevant:
                continue
            date_match = DATE_RE.search(line)
            if not date_match:
                continue
            date = date_match.group(0)
            before = line[: date_match.start()].strip()
            cols = [c for c in re.split(r"\s{2,}", before) if c.strip()]
            if len(cols) < 2:
                continue
            area: str | None = None
            aquifer: str | None = None
            statement: str
            if len(cols) >= 4:
                area = "; ".join(cols[:-2])
                aquifer = cols[-2]
                statement = cols[-1]
            elif len(cols) == 3:
                # Usually area, aquifer, statement. If the first column looks like
                # an aquifer table, leave area empty.
                if gma in {2, 9, 10, 13, 14}:
                    aquifer, statement = cols[0], cols[1]
                else:
                    area, aquifer, statement = cols
            else:
                aquifer, statement = cols
            continuations: list[str] = []
            for _, next_line in page_lines[idx + 1 :]:
                stripped = next_line.strip()
                if not stripped:
                    continue
                if DATE_RE.search(next_line) or "Non-Relevant Aquifers" in next_line or "Page " in next_line:
                    break
                if any(token in stripped for token in ("Desired Future Condition", "Date DFC", "County", "Aquifer", "Adopted Desired")):
                    continue
                # Prefer continuation text from the DFC column, but keep readable text.
                continuations.append(stripped)
                if len(continuations) >= 3:
                    break
            full_statement = " ".join([statement, *continuations])
            _record(records, gma=gma, pdf_page=page_num, source_line=source_line, area=area, area_type="area", aquifer=aquifer, adoption_date=date, statement=full_statement)


def _run_pdftotext(pdf: Path) -> str:
    with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    subprocess.run(["pdftotext", "-layout", str(pdf), str(tmp_path)], check=True)
    return tmp_path.read_text()


def extract(pdf: Path) -> dict[str, Any]:
    text = _run_pdftotext(pdf)
    pages = text.split("\f")
    records: list[dict[str, Any]] = []
    _generic_parse(records, pages)
    _parse_gma8(records, pages)
    _parse_gma10(records)
    _parse_gma11(records, pages)
    _parse_gma12(records, pages)
    _parse_gma15(records, pages)
    _parse_gma16(records, pages)
    records.sort(key=lambda r: (r["gma"], r["source"]["pdf_page"], r["source"]["text_line"], r["aquifer"] or "", r["area"] or ""))
    for idx, rec in enumerate(records, 1):
        rec["id"] = f"dfc2021-{idx:04d}"
    found = sorted({r["gma"] for r in records})
    missing = [g for g in range(1, 17) if g not in found]
    return {
        "metadata": {
            "title": "TWDB Adopted Desired Future Conditions - 2021",
            "source_url": SOURCE_URL,
            "source_pdf_pages": 34,
            "extraction_method": "pdftotext -layout plus table-specific parsers for matrix pages",
            "record_count": len(records),
            "gmas_present": found,
            "gmas_missing_in_source_pdf_text": missing,
            "notes": [
                "The source PDF is not a tagged table; each record preserves the original DFC statement and PDF page/line provenance.",
                "GMA 5 was not present in the extracted PDF text used for this fixture.",
            ],
        },
        "records": records,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    data = extract(args.pdf)
    args.out.write_text(json.dumps(data, indent=2) + "\n")


if __name__ == "__main__":
    main()
