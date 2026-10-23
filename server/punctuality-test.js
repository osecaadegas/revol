const assert = require("node:assert/strict");
const p = require("./punctuality");

const rules = p.rulesFor({});
const scheduled = "2026-10-20T06:00:00.000Z";
const at = (seconds) => new Date(Date.parse(scheduled) + seconds * 1000).toISOString();
assert.equal(p.scoreArrival(scheduled, at(-3600), rules).score, 10);
assert.equal(p.scoreArrival(scheduled, at(0), rules).score, 10);
assert.equal(p.scoreArrival(scheduled, at(300), rules).score, 10);
assert.equal(p.scoreArrival(scheduled, at(301), rules).score, 8);
assert.equal(p.scoreArrival(scheduled, at(600), rules).score, 8);
assert.equal(p.scoreArrival(scheduled, at(900), rules).score, 8);
assert.equal(p.scoreArrival(scheduled, at(901), rules).score, 5);
assert.equal(p.scoreArrival(scheduled, at(1200), rules).score, 5);
assert.equal(p.scoreArrival(scheduled, at(1800), rules).score, 5);
assert.equal(p.scoreArrival(scheduled, at(1801), rules).score, 0);
assert.equal(p.scoreArrival(scheduled, at(2400), rules).score, 0);
assert.equal(p.localStart("2026-03-29", "07:00"), "2026-03-29T06:00:00.000Z", "summer time starts in Lisbon");
assert.equal(p.localStart("2026-10-25", "07:00"), "2026-10-25T07:00:00.000Z", "winter time starts in Lisbon");
assert.equal(p.localStart("2026-03-29", "01:30"), null, "non-existent DST hour must not be guessed");
assert.equal(p.localStart("2026-10-25", "01:30"), "2026-10-25T00:30:00.000Z", "ambiguous DST hour uses first occurrence");
assert.equal(p.localStart("2026-10-20", "07:00:37"), "2026-10-20T06:00:37.000Z", "manager corrections retain seconds");

const asOf = p.localDate(new Date().toISOString());
const db = { companies: [{ id: "company", punctualityConfig: rules }], attendanceEntries: [], attendanceJustifications: [], auditLogs: [], workSchedules: [], tasks: [] };
function addRecord(daysAgo, delaySeconds = 0, workerId = "worker") {
  const workDate = p.addDays(asOf, -daysAgo);
  const start = p.localStart(workDate, "07:00");
  const clockedInAt = new Date(Date.parse(start) + delaySeconds * 1000).toISOString();
  const entry = { id: `entry_${db.attendanceEntries.length}`, companyId: "company", workerId, taskId: "task", clockedInAt,
    punctuality: { ...p.scoreArrival(start, clockedInAt, rules), workDate, scheduledAt: start, clockedInAt,
      scheduleId: `schedule_${workDate}`, ruleVersion: rules.version, rules } };
  db.attendanceEntries.push(entry);
  return entry;
}
assert.equal(p.snapshot(db, "company", "worker", asOf).status, "insufficient");
for (let day = 59; day >= 0; day--) addRecord(day);
let summary = p.snapshot(db, "company", "worker", asOf);
assert.equal(summary.status, "confirmed");
assert.equal(summary.rating, 10);
assert.equal(summary.scoredShifts, 60);
assert.equal(summary.onTime, 60);
assert.equal(p.snapshot(db, "company", "other", asOf).status, "insufficient", "worker isolation");
for (const entry of db.attendanceEntries.slice(0, 3)) {
  entry.clockedInAt = new Date(Date.parse(entry.punctuality.scheduledAt) + 600000).toISOString();
  Object.assign(entry.punctuality, p.scoreArrival(entry.punctuality.scheduledAt, entry.clockedInAt, rules));
}
db.attendanceEntries[3].clockedInAt = new Date(Date.parse(db.attendanceEntries[3].punctuality.scheduledAt) + 1200000).toISOString();
Object.assign(db.attendanceEntries[3].punctuality, p.scoreArrival(db.attendanceEntries[3].punctuality.scheduledAt, db.attendanceEntries[3].clockedInAt, rules));
summary = p.snapshot(db, "company", "worker", asOf);
assert.equal(summary.rating, 589 / 60, "56 punctual, 3 minor and 1 significant delay");
assert.equal(summary.minorDelays, 3);
assert.equal(summary.significantDelays, 1);
db.attendanceEntries.splice(10);
summary = p.snapshot(db, "company", "worker", asOf);
assert.equal(summary.status, "provisional");
assert.equal(summary.scoredShifts, 10);
db.attendanceEntries.length = 0;
const late = addRecord(1, 600);
let justification = { id: "just", companyId: "company", workerId: "worker", absenceDate: late.punctuality.workDate,
  kind: "late_arrival", status: "pending", createdAt: new Date(Date.parse(late.clockedInAt) + 1000).toISOString(), decidedAt: null };
db.attendanceJustifications.push(justification);
summary = p.snapshot(db, "company", "worker", asOf);
assert.equal(summary.scoredShifts, 0, "pending justification suspends scoring");
assert.equal(summary.records[0].status, "awaiting_review");
justification.status = "approved";
justification.decidedAt = new Date(Date.parse(late.clockedInAt) + 2000).toISOString();
assert.equal(p.snapshot(db, "company", "worker", asOf).records[0].status, "excluded");
justification.status = "rejected";
assert.equal(p.snapshot(db, "company", "worker", asOf).rating, 8, "rejected explanation restores reliable evidence");
db.attendanceEntries.length = 0;
db.attendanceJustifications.length = 0;
const old = addRecord(89, 2400);
assert.equal(p.snapshot(db, "company", "worker", asOf).rating, 0);
assert.equal(p.snapshot(db, "company", "worker", p.addDays(asOf, 1)).status, "insufficient", "rolling window advances without a new punch");
assert.equal(p.snapshot(db, "company", "worker", asOf).chart.length, 13);
db.attendanceEntries.length = 0;
const corrected = addRecord(8, 600);
const correctionAt = p.localStart(p.addDays(asOf, -2), "12:00");
db.auditLogs.push({ companyId: "company", entityType: "attendance", entityId: corrected.id, action: "attendance.clock_in_corrected",
  createdAt: correctionAt, detail: { originalAt: corrected.clockedInAt, correctedAt: corrected.punctuality.scheduledAt, reason: "Relógio incorreto" } });
corrected.clockedInAt = corrected.punctuality.scheduledAt;
Object.assign(corrected.punctuality, p.scoreArrival(corrected.punctuality.scheduledAt, corrected.clockedInAt, rules));
assert.equal(p.snapshot(db, "company", "worker", p.addDays(asOf, -3)).rating, 8, "history before correction retains old score");
assert.equal(p.snapshot(db, "company", "worker", asOf).rating, 10, "current score uses auditable correction");
db.attendanceEntries.length = 0;
db.auditLogs.length = 0;

const shiftDate = p.addDays(asOf, -1);
const shiftStart = p.localStart(shiftDate, "23:59");
const overnightClock = new Date(Date.parse(shiftStart) + 180 * 1000).toISOString();
const schedule = { id: "schedule", companyId: "company", workerId: "worker", taskId: "task", workDate: shiftDate,
  startTime: "23:59", firstPublishedStartAt: shiftStart, createdAt: new Date(Date.parse(shiftStart) - 86400000).toISOString(),
  updatedAt: new Date(Date.parse(shiftStart) - 86400000).toISOString() };
db.workSchedules.push(schedule);
db.tasks.push({ id: "task", companyId: "company", workOrderId: "order" });
let result = p.punctualityForClockIn(db, db.tasks[0], "worker", overnightClock);
assert.equal(result.status, "scored", "cross-midnight shift matches scheduled work date");
assert.equal(result.workDate, shiftDate);
assert.equal(result.score, 10);
db.attendanceEntries.push({ id: "first", companyId: "company", workerId: "worker", clockedInAt: overnightClock, punctuality: result });
assert.equal(p.punctualityForClockIn(db, db.tasks[0], "worker", new Date(Date.parse(overnightClock) + 60000).toISOString()).status, "additional_task");
schedule.updatedAt = new Date(Date.parse(shiftStart) + 60000).toISOString();
db.attendanceEntries.length = 0;
assert.equal(p.punctualityForClockIn(db, db.tasks[0], "worker", overnightClock).status, "pending_review", "retroactive edit cannot silently score");
db.auditLogs.push({ companyId: "company", action: "planning.schedule_removed", detail: { workerId: "worker", workDate: shiftDate } });
assert.equal(p.punctualityForClockIn(db, db.tasks[0], "worker", overnightClock).status, "pending_review", "deleted and recreated schedule needs review");
assert.equal(p.validateRules({ windowDays: 90, graceSeconds: 300, minorLimitSeconds: 900, significantLimitSeconds: 1800, confirmedShifts: 20, scores: [10, 8, 5, 0] }, rules).version, 2);
assert.throws(() => p.validateRules({ windowDays: 90, graceSeconds: 900, minorLimitSeconds: 300, significantLimitSeconds: 1800, confirmedShifts: 20, scores: [10, 8, 5, 0] }, rules));
console.log("punctuality: exact boundaries, DST, rolling rating, explanations, disputes and duplicate shifts passed");
