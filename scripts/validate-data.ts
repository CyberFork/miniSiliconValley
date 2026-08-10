import { historyCatalog } from "../app/data/history";
import { missions } from "../app/data/missions";
import { validateCatalog, validateMissions } from "../app/lib/validate";

const catalog = validateCatalog(historyCatalog);
const campaign = validateMissions(historyCatalog, missions);
const errors = [...catalog.errors, ...campaign.errors];
const warnings = [...catalog.warnings, ...campaign.warnings];

console.log(JSON.stringify({
  schemaVersion: historyCatalog.schemaVersion,
  counts: { ...catalog.counts, ...campaign.counts },
  errors,
  warnings,
}, null, 2));

if (errors.length || warnings.length) process.exitCode = 1;
