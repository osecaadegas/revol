"use strict";

const ZONE = "Europe/Lisbon";
const DEFAULT_RULES = Object.freeze({
  version: 1,
  windowDays: 90,
  graceSeconds: 300,
  minorLimitSeconds: 900,
  significantLimitSeconds: 1800,
  confirmedShifts: 20,
  scores: [10, 8, 5, 0]
});

function rulesFor(company) {
  const value = company?.punctualityConfig || {};
  return { ...DEFAULT_RULES, ...value, scores: Array.isArray(value.scores) && value.scores.length === 4 ? value.scores : [...DEFAULT_RULES.scores] };
}

function validateRules(input, previous) {
  const rules = {
    version: (previous?.version || DEFAULT_RULES.version) + 1,
    windowDays: Number(input.windowDays),
    graceSeconds: Number(input.graceSeconds),
    minorLimitSeconds: Number(input.minorLimitSeconds),
    significantLimitSeconds: Number(input.significantLimitSeconds),
    confirmedShifts: Number(input.confirmedShifts),
    scores: Array.isArray(input.scores) ? input.scores.map(Number) : []
  };
  if (![rules.windowDays, rules.graceSeconds, rules.minorLimitSeconds, rules.significantLimitSeconds, rules.confirmedShifts, ...rules.scores].every(Number.isInteger) ||
    rules.windowDays < 7 || rules.windowDays > 365 || rules.confirmedShifts < 1 || rules.confirmedShifts > 365 ||
    rules.graceSeconds < 0 || rules.graceSeconds > 1800 || rules.minorLimitSeconds <= rules.graceSeconds ||
    rules.significantLimitSeconds <= rules.minorLimitSeconds || rules.significantLimitSeconds > 10800 ||
    rules.scores.length !== 4 || rules.scores.some(score => score < 0 || score > 10) ||
    rules.scores.some((score, index) => index && score > rules.scores[index - 1])) {
    throw Object.assign(new Error("Indique regras válidas: períodos, limites crescentes e pontuações de 0 a 10 não crescentes."), { status: 400 });
  }
  return rules;
}

const lisbonFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
});

function localParts(timestamp) {
  return Object.fromEntries(lisbonFormatter.formatToParts(new Date(timestamp)).map(part => [part.type, part.value]));
}

function localDate(timestamp) {
  const parts = localParts(timestamp);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function localStart(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time || "")) return null;
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute, second = 0] = time.split(":").map(Number);
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const candidates = [-60, 0].map(offset => new Date(localAsUtc + offset * 60000)).filter(candidate => {
    const parts = localParts(candidate);
    return Number(parts.year) === year && Number(parts.month) === month && Number(parts.day) === day && Number(parts.hour) === hour && Number(parts.minute) === minute && Number(parts.second) === second;
  });
  return candidates.length ? candidates.sort((a, b) => a - b)[0].toISOString() : null;
}

function scoreArrival(scheduledAt, clockedInAt, rules) {
  const delaySeconds = (Date.parse(clockedInAt) - Date.parse(scheduledAt)) / 1000;
  if (!Number.isFinite(delaySeconds)) return { status: "pending_review", score: null, delaySeconds: null };
  const score = delaySeconds <= rules.graceSeconds ? rules.scores[0] :
    delaySeconds <= rules.minorLimitSeconds ? rules.scores[1] :
      delaySeconds <= rules.significantLimitSeconds ? rules.scores[2] : rules.scores[3];
  return { status: "scored", score, delaySeconds };
}

function shiftForClockIn(db, task, workerId, clockedInAt) {
  return db.workSchedules.filter(schedule => schedule.companyId === task.companyId && schedule.workerId === workerId &&
    (schedule.taskId === task.id || db.tasks.some(other => other.id === schedule.taskId && other.workOrderId === task.workOrderId)))
    .map(schedule => ({ schedule, scheduledAt: localStart(schedule.workDate, schedule.startTime) }))
    .filter(item => item.scheduledAt && Date.parse(clockedInAt) - Date.parse(item.scheduledAt) >= -4 * 3600000 &&
      Date.parse(clockedInAt) - Date.parse(item.scheduledAt) <= 12 * 3600000)
    .sort((a, b) => Math.abs(Date.parse(clockedInAt) - Date.parse(a.scheduledAt)) - Math.abs(Date.parse(clockedInAt) - Date.parse(b.scheduledAt)))[0] || null;
}

function punctualityForClockIn(db, task, workerId, clockedInAt) {
  const rules = rulesFor(db.companies.find(company => company.id === task.companyId));
  const match = shiftForClockIn(db, task, workerId, clockedInAt);
  const base = { status: "pending_review", score: null, delaySeconds: null, ruleVersion: rules.version, rules,
    workDate: match?.schedule.workDate || localDate(clockedInAt), scheduleId: match?.schedule.id || null,
    scheduledAt: match?.scheduledAt || null, clockedInAt };
  if (!match) return { ...base, reason: "no_matching_schedule" };
  if (db.attendanceEntries.some(entry => entry.companyId === task.companyId && entry.workerId === workerId &&
    entry.punctuality?.workDate === match.schedule.workDate && entry.punctuality?.scheduleId === match.schedule.id)) {
    return { ...base, status: "additional_task", reason: "already_scored_shift" };
  }
  const originalAt = match.schedule.firstPublishedStartAt || (match.schedule.createdAt === match.schedule.updatedAt ? match.scheduledAt : null);
  const removedEarlier = db.auditLogs.some(log => log.companyId === task.companyId && log.action === "planning.schedule_removed" &&
    log.detail?.workerId === workerId && log.detail?.workDate === match.schedule.workDate);
  if (!originalAt || removedEarlier || Date.parse(match.schedule.updatedAt) > Date.parse(originalAt) || Date.parse(match.schedule.updatedAt) > Date.parse(match.scheduledAt)) {
    return { ...base, reason: "schedule_changed_after_start" };
  }
  return { ...base, ...scoreArrival(match.scheduledAt, clockedInAt, rules), reason: null };
}

function addDays(date, count) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + count);
  return value.toISOString().slice(0, 10);
}

function reconcileShiftRecords(db, companyId, workerId, scheduleId) {
  if (!scheduleId) return [];
  const entries = db.attendanceEntries.filter(entry => entry.companyId === companyId && entry.workerId === workerId &&
    entry.punctuality?.scheduleId === scheduleId).sort((a, b) => a.clockedInAt.localeCompare(b.clockedInAt));
  let primaryFound = false;
  for (const entry of entries) {
    const result = entry.punctuality;
    if (result.reason === "schedule_changed_after_start") continue;
    const shiftOffset = Date.parse(entry.clockedInAt) - Date.parse(result.scheduledAt);
    if (shiftOffset < -4 * 3600000 || shiftOffset > 12 * 3600000) {
      entry.punctuality = { ...result, status: "pending_review", score: null, delaySeconds: null,
        clockedInAt: entry.clockedInAt, reason: "outside_shift_window" };
      continue;
    }
    entry.punctuality = !primaryFound
      ? { ...result, ...scoreArrival(result.scheduledAt, entry.clockedInAt, result.rules), clockedInAt: entry.clockedInAt, reason: null }
      : { ...result, status: "additional_task", score: null, delaySeconds: null, clockedInAt: entry.clockedInAt, reason: "already_scored_shift" };
    primaryFound = true;
  }
  return entries.map(entry => entry.id);
}

function snapshot(db, companyId, workerId, asOfDate = localDate(new Date().toISOString())) {
  const company = db.companies.find(item => item.id === companyId);
  const rules = rulesFor(company);
  const firstDate = addDays(asOfDate, 1 - rules.windowDays);
  const earliestChartDate = addDays(firstDate, -84);
  const justifications = db.attendanceJustifications.filter(item => item.companyId === companyId && item.workerId === workerId && item.absenceDate >= earliestChartDate && item.absenceDate <= asOfDate);
  const sourceEntries = db.attendanceEntries.filter(entry => entry.companyId === companyId && entry.workerId === workerId && entry.punctuality &&
    entry.punctuality.workDate >= earliestChartDate && entry.punctuality.workDate <= asOfDate &&
    (!entry.punctuality.scheduledAt || Date.parse(entry.punctuality.scheduledAt) <= Date.now()));
  const recordsAt = (date, windowStart, includeCorrections = false) => sourceEntries.filter(entry => entry.punctuality.workDate >= windowStart &&
    entry.punctuality.workDate <= date)
    .map(entry => {
      const result = entry.punctuality;
      const correctionLogs = db.auditLogs.filter(log => log.entityType === "attendance" && log.entityId === entry.id && log.action === "attendance.clock_in_corrected")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const firstLaterCorrection = correctionLogs.find(log => localDate(log.createdAt) > date);
      const clockedInAt = firstLaterCorrection?.detail.originalAt || entry.clockedInAt;
      const matching = justifications.filter(item => item.absenceDate === result.workDate && localDate(item.createdAt) <= date);
      const approved = matching.some(item => item.status === "approved" && item.decidedAt && localDate(item.decidedAt) <= date);
      const pending = matching.some(item => item.status === "pending" || (item.decidedAt && localDate(item.decidedAt) > date));
      const status = approved ? "excluded" : pending ? "awaiting_review" : result.status;
      const daily = status === "scored" && result.scheduledAt ? scoreArrival(result.scheduledAt, clockedInAt, result.rules) : result;
      const corrections = (includeCorrections ? correctionLogs : [])
        .map(log => ({ originalAt: log.detail.originalAt, correctedAt: log.detail.correctedAt, reason: log.detail.reason, correctedAtRecord: log.createdAt }));
      return { id: entry.id, taskId: entry.taskId, workDate: result.workDate, scheduledAt: result.scheduledAt,
        clockedInAt, delaySeconds: daily.delaySeconds, score: status === "scored" ? daily.score : null,
        status, reason: result.reason, ruleVersion: result.ruleVersion, rules: result.rules, corrections };
    }).filter(item => localDate(item.clockedInAt) <= date)
    .sort((a, b) => b.workDate.localeCompare(a.workDate) || b.clockedInAt.localeCompare(a.clockedInAt));
  const records = recordsAt(asOfDate, firstDate, true);
  const valid = records.filter(item => item.status === "scored" && Number.isFinite(item.score));
  const exactRating = valid.length ? valid.reduce((sum, item) => sum + item.score, 0) / valid.length : null;
  const chart = [];
  for (let offset = 12; offset >= 0; offset--) {
    const date = addDays(asOfDate, -7 * offset);
    const windowStart = addDays(date, 1 - rules.windowDays);
    const pointRecords = recordsAt(date, windowStart).filter(item => item.status === "scored" && Number.isFinite(item.score));
    chart.push({ date, scoredShifts: pointRecords.length, rating: pointRecords.length ? pointRecords.reduce((sum, item) => sum + item.score, 0) / pointRecords.length : null });
  }
  return { companyId, workerId, rules, status: !valid.length ? "insufficient" : valid.length < rules.confirmedShifts ? "provisional" : "confirmed",
    rating: exactRating, scoredShifts: valid.length, onTime: valid.filter(item => item.delaySeconds <= item.rules.graceSeconds).length,
    minorDelays: valid.filter(item => item.delaySeconds > item.rules.graceSeconds && item.delaySeconds <= item.rules.minorLimitSeconds).length,
    significantDelays: valid.filter(item => item.delaySeconds > item.rules.minorLimitSeconds && item.delaySeconds <= item.rules.significantLimitSeconds).length,
    majorDelays: valid.filter(item => item.delaySeconds > item.rules.significantLimitSeconds).length,
    approvedExclusions: justifications.filter(item => item.absenceDate >= firstDate && item.status === "approved").length,
    pendingExceptions: justifications.filter(item => item.absenceDate >= firstDate && item.status === "pending").length,
    records, chart, periodStart: firstDate, periodEnd: asOfDate };
}

module.exports = { DEFAULT_RULES, rulesFor, validateRules, localDate, localStart, scoreArrival, shiftForClockIn, punctualityForClockIn, reconcileShiftRecords, snapshot, addDays };
