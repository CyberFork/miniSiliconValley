import type {
  CurriculumCatalog,
  HistoryCatalog,
  MissionRecord,
  ProjectStageId,
} from "./model";

function duplicates(values: string[]) {
  const seen = new Set<string>();
  return [...new Set(values.filter((value) => (seen.has(value) ? true : !seen.add(value))))];
}

export interface ValidationReport {
  errors: string[];
  warnings: string[];
  counts: Record<string, number>;
}

export function validateCatalog(catalog: HistoryCatalog): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const collections = {
    era: catalog.eras,
    place: catalog.places,
    organization: catalog.organizations,
    person: catalog.people,
    technology: catalog.technologies,
    source: catalog.sources,
    event: catalog.events,
  };

  Object.entries(collections).forEach(([label, values]) => {
    const repeated = duplicates(values.map((entry) => entry.id));
    if (repeated.length) errors.push(`${label} ID 重复：${repeated.join(", ")}`);
  });

  const placeIds = new Set(catalog.places.map(({ id }) => id));
  const organizationIds = new Set(catalog.organizations.map(({ id }) => id));
  const personIds = new Set(catalog.people.map(({ id }) => id));
  const technologyIds = new Set(catalog.technologies.map(({ id }) => id));
  const sourceIds = new Set(catalog.sources.map(({ id }) => id));
  const eventIds = new Set(catalog.events.map(({ id }) => id));

  catalog.places.forEach((place) => {
    if (place.x < 0 || place.x > 100 || place.y < 0 || place.y > 100) {
      errors.push(`地理坐标越界：${place.id}`);
    }
  });
  catalog.organizations.forEach((organization) => {
    if (!placeIds.has(organization.placeId)) {
      errors.push(`机构 ${organization.id} 引用缺失地点 ${organization.placeId}`);
    }
  });
  catalog.people.forEach((person) => {
    person.organizationIds.forEach((id) => {
      if (!organizationIds.has(id)) errors.push(`人物 ${person.id} 引用缺失机构 ${id}`);
    });
  });
  catalog.sources.forEach((source) => {
    if (!source.url.startsWith("https://")) errors.push(`来源非 HTTPS：${source.id}`);
  });
  catalog.events.forEach((event) => {
    if (event.year < 1891 || event.year > 2026) errors.push(`事件年份越界：${event.id}`);
    if (!placeIds.has(event.placeId)) errors.push(`事件 ${event.id} 引用缺失地点 ${event.placeId}`);
    if (!event.sourceIds.length) errors.push(`事件 ${event.id} 没有来源`);
    event.sourceIds.forEach((id) => {
      if (!sourceIds.has(id)) errors.push(`事件 ${event.id} 引用缺失来源 ${id}`);
    });
    event.organizationIds.forEach((id) => {
      if (!organizationIds.has(id)) errors.push(`事件 ${event.id} 引用缺失机构 ${id}`);
    });
    event.personIds.forEach((id) => {
      if (!personIds.has(id)) errors.push(`事件 ${event.id} 引用缺失人物 ${id}`);
    });
    event.technologyIds.forEach((id) => {
      if (!technologyIds.has(id)) errors.push(`事件 ${event.id} 引用缺失技术 ${id}`);
    });
    event.relatedEventIds.forEach((id) => {
      if (!eventIds.has(id)) errors.push(`事件 ${event.id} 引用缺失事件 ${id}`);
    });
    if (event.map.x < 0 || event.map.x > 100 || event.map.y < 0 || event.map.y > 100) {
      errors.push(`事件坐标越界：${event.id}`);
    }
  });

  if (catalog.eras.length < 8) errors.push("时代少于 8 个");
  if (catalog.places.length < 15) errors.push("地理节点少于 15 个");
  if (catalog.organizations.length < 45) errors.push("企业/机构少于 45 家");
  if (catalog.people.length < 30) errors.push("关键人物少于 30 位");
  if (catalog.technologies.length < 35) errors.push("产品/技术少于 35 个");
  if (catalog.events.length < 120) errors.push("历史事件少于 120 条");

  const uncoveredYears = catalog.eras.filter(
    (era) => !catalog.events.some((event) => event.year >= era.start && event.year <= era.end),
  );
  if (uncoveredYears.length) warnings.push(`时代无事件：${uncoveredYears.map(({ id }) => id).join(", ")}`);

  return {
    errors,
    warnings,
    counts: Object.fromEntries(
      Object.entries(collections).map(([label, values]) => [label, values.length]),
    ),
  };
}

export function validateMissions(
  catalog: HistoryCatalog,
  missions: MissionRecord[],
): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missionIds = new Set(missions.map(({ id }) => id));
  const eventIds = new Set(catalog.events.map(({ id }) => id));
  const sourceIds = new Set(catalog.sources.map(({ id }) => id));

  const repeated = duplicates(missions.map(({ id }) => id));
  if (repeated.length) errors.push(`关卡 ID 重复：${repeated.join(", ")}`);
  if (missions.length < 8) errors.push("完整互动关卡少于 8 个");

  missions.forEach((mission) => {
    if (!eventIds.has(mission.eventId)) errors.push(`关卡 ${mission.id} 引用缺失事件 ${mission.eventId}`);
    if (mission.evidence.length < 3) errors.push(`关卡 ${mission.id} 证据少于 3 条`);
    if (mission.choices.length < 2) errors.push(`关卡 ${mission.id} 路径少于 2 条`);
    if (mission.reflection.length < 2) errors.push(`关卡 ${mission.id} 复盘问题少于 2 条`);
    if (!mission.realityMission.acceptance.length) errors.push(`关卡 ${mission.id} 没有现实任务验收`);
    const evidenceIds = new Set(mission.evidence.map(({ id }) => id));
    mission.evidence.flatMap(({ sourceIds: ids }) => ids).forEach((id) => {
      if (!sourceIds.has(id)) errors.push(`关卡 ${mission.id} 证据引用缺失来源 ${id}`);
    });
    mission.history.sourceIds.forEach((id) => {
      if (!sourceIds.has(id)) errors.push(`关卡 ${mission.id} 史实引用缺失来源 ${id}`);
    });
    mission.choices.flatMap(({ requiresEvidenceIds = [] }) => requiresEvidenceIds).forEach((id) => {
      if (!evidenceIds.has(id)) errors.push(`关卡 ${mission.id} 路径引用缺失证据 ${id}`);
    });
  });

  catalog.events.filter(({ missionId }) => missionId).forEach((event) => {
    if (!missionIds.has(event.missionId!)) errors.push(`事件 ${event.id} 引用缺失关卡 ${event.missionId}`);
  });

  return {
    errors,
    warnings,
    counts: { mission: missions.length },
  };
}

const REQUIRED_PROJECT_STAGE_IDS: ProjectStageId[] = [
  "find-problem",
  "validate-problem",
  "design-solution",
  "mvp-vc",
  "operate-brand",
  "demo-day",
];

export function validateCurriculum(
  catalog: HistoryCatalog,
  missions: MissionRecord[],
  curriculum: CurriculumCatalog,
): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const eventIds = new Set(catalog.events.map(({ id }) => id));
  const missionIds = new Set(missions.map(({ id }) => id));
  const stageIds = curriculum.stages.map(({ id }) => id);
  const journeyIds = curriculum.companyJourneys.map(({ id }) => id);
  const exampleIds = curriculum.stages.flatMap(({ examples }) => examples.map(({ id }) => id));
  const contributionKeys = curriculum.contributionProtocol.map(({ key }) => key);

  if (curriculum.stages.length !== REQUIRED_PROJECT_STAGE_IDS.length) {
    errors.push(`课程阶段必须恰好为 ${REQUIRED_PROJECT_STAGE_IDS.length} 个`);
  }
  if (stageIds.join("|") !== REQUIRED_PROJECT_STAGE_IDS.join("|")) {
    errors.push("课程阶段 ID 或顺序不符合 0→1 六步主线");
  }
  for (const [label, ids] of [
    ["课程阶段", stageIds],
    ["课程案例", exampleIds],
    ["企业流程", journeyIds],
    ["归集字段", contributionKeys],
  ] as [string, string[]][]) {
    const repeated = duplicates(ids);
    if (repeated.length) errors.push(`${label} ID 重复：${repeated.join(", ")}`);
  }

  curriculum.stages.forEach((stage, index) => {
    if (stage.order !== index + 1) errors.push(`课程阶段 ${stage.id} 排序号应为 ${index + 1}`);
    if (!stage.title || !stage.englishTitle || !stage.promise || !stage.coreQuestion) {
      errors.push(`课程阶段 ${stage.id} 缺少标题、承诺或核心问题`);
    }
    for (const [label, values] of [
      ["学习目标", stage.learningGoals],
      ["学员行动", stage.actions],
      ["交付物", stage.artifacts],
      ["完成门槛", stage.completionGate],
    ] as [string, string[]][]) {
      if (!values.length || values.some((value) => !value.trim())) {
        errors.push(`课程阶段 ${stage.id} 的${label}不能为空`);
      }
    }
    if (stage.examples.length < 3) errors.push(`课程阶段 ${stage.id} 的历史案例少于 3 个`);
    stage.examples.forEach((example) => {
      if (!example.eventIds.length) errors.push(`课程案例 ${example.id} 没有史实锚点`);
      example.eventIds.forEach((id) => {
        if (!eventIds.has(id)) errors.push(`课程案例 ${example.id} 引用缺失事件 ${id}`);
      });
      if (example.missionId && !missionIds.has(example.missionId)) {
        errors.push(`课程案例 ${example.id} 引用缺失关卡 ${example.missionId}`);
      }
      if (!example.teachingUse.trim()) errors.push(`课程案例 ${example.id} 缺少教学用法`);
    });
  });

  if (!curriculum.companyJourneys.length) errors.push("课程大纲至少需要一条企业全流程");
  curriculum.companyJourneys.forEach((journey) => {
    const journeyStageIds = journey.steps.map(({ stageId }) => stageId);
    if (journeyStageIds.join("|") !== REQUIRED_PROJECT_STAGE_IDS.join("|")) {
      errors.push(`企业流程 ${journey.id} 未完整覆盖并按序排列六步`);
    }
    if (journey.missionId && !missionIds.has(journey.missionId)) {
      errors.push(`企业流程 ${journey.id} 引用缺失关卡 ${journey.missionId}`);
    }
    journey.steps.forEach((step) => {
      if (!step.eventIds.length) errors.push(`企业流程 ${journey.id}/${step.stageId} 没有史实锚点`);
      step.eventIds.forEach((id) => {
        if (!eventIds.has(id)) errors.push(`企业流程 ${journey.id}/${step.stageId} 引用缺失事件 ${id}`);
      });
      if (!step.teachingUse.trim()) errors.push(`企业流程 ${journey.id}/${step.stageId} 缺少教学用法`);
    });
  });

  if (curriculum.contributionProtocol.length < 8) errors.push("内容归集协议少于 8 个必填字段");
  if (!curriculum.nonNegotiables.length) errors.push("课程目录缺少不可妥协原则");

  return {
    errors,
    warnings,
    counts: {
      curriculumStage: curriculum.stages.length,
      curriculumExample: exampleIds.length,
      companyJourney: curriculum.companyJourneys.length,
      companyJourneyStep: curriculum.companyJourneys.reduce((sum, journey) => sum + journey.steps.length, 0),
    },
  };
}
