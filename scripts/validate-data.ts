import { historyCatalog } from "../app/data/history";
import { missions } from "../app/data/missions";
import { curriculumCatalog } from "../app/data/curriculum";
import { validateCatalog, validateCurriculum, validateMissions } from "../app/lib/validate";

const catalog = validateCatalog(historyCatalog);
const campaign = validateMissions(historyCatalog, missions);
const curriculum = validateCurriculum(historyCatalog, missions, curriculumCatalog);
const errors = [...catalog.errors, ...campaign.errors, ...curriculum.errors];
const warnings = [...catalog.warnings, ...campaign.warnings, ...curriculum.warnings];

console.log(JSON.stringify({
  schemaVersion: historyCatalog.schemaVersion,
  counts: { ...catalog.counts, ...campaign.counts, ...curriculum.counts },
  errors,
  warnings,
}, null, 2));

if (errors.length || warnings.length) process.exitCode = 1;
