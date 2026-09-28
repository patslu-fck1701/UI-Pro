# WerkZ Asset & Planning Inventory

**Baseline:** KB-v1.26  
**Imported source:** user archive received 2026-09-28; much of its planning/copy reflects 2026-09-25/26 and is therefore historical input, not current truth.

## Persistent archive

Library: `/WerkZ/Assets-und-Planung/Archiv_2026-09-28_Altbestand_mit_Assets_Planung.zip`

Historical planning documents are stored separately under `/WerkZ/Assets-und-Planung/` and must not silently overwrite the current baseline.

## Visual asset families found

- Brand banners / WerkZ wordmarks
- Z emblem / tool-and-gear marks / crest variants
- Founder/personality motifs
- Trust/security motif
- Efficiency / time / process-automation motifs
- CTA graphics such as "Jetzt starten" / "Mehr Informationen"
- divider bars (`divid1.webp`, `divid2.webp`)
- one flyer / promotional composition

## Current WebsitePublisher reuse

Several archive assets were already present in WebsitePublisher before this import:
- `images/uploads/logo.png` - WerkZ brand banner
- `images/uploads/logo_ich.png` - existing branded visual used on WerkZ
- `images/1463741e-fca0-4e36-804d-e30f6b07f9e8.png` - security / secure-data-transfer motif
- `images/uploads/div2.png` - divider visual

The security motif is now actually wired into the global WerkZ security ribbon instead of the obsolete missing SVG reference.

## Usage policy

Use visual assets by semantic role, not as decoration everywhere. Keep one primary logo language and use secondary crests/emblems sparingly. Security imagery belongs with security/privacy. Efficiency/time/process motifs belong with automation/benefit explanations. Founder imagery may support personal trust/origin sections but must not dominate technical pages. CTA graphics should not replace accessible HTML buttons.

## Historical text/planning material

- `WerkZ_English_Texts_Review.txt` is historical copy review. It still references the deleted Balzer project and the former large DeutschZ navigation, so it must be revised before reuse.
- `WerkZ_Jobcenter_Foerderplan_2026.pdf` is a planning document dated 2026-09-26. It contains Jobcenter/founding guidance and is private planning evidence, not public website copy and not the current semantic baseline.
- Case export TXT files contain personal/contact/intake data. They are private operational evidence and must not be committed to public GitHub or copied to public pages.

## Guardrail

Archive != current truth. For every reused item classify: current reusable asset, historical evidence, private operational data, or obsolete copy. Then link it to the current KB-v1.26 model before use.
