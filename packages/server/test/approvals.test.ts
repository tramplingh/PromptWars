import { describe, expect, it } from 'vitest';
import type { ApprovalQueue, BookingView } from '@lablink/shared';
import { DAYS, buildTestApp, loginAs } from './helpers.js';

const LASER_CONFLICT = `laser-60w_${DAYS[2]}_10-13`;

describe('faculty approvals and conflict resolution', () => {
  it('shows faculty only their department queue, ranked by priority', async () => {
    const { app } = buildTestApp();
    const faculty = await loginAs(app, 'f-rao');
    const { body } = (await faculty.get('/api/approvals').expect(200)) as { body: ApprovalQueue };

    expect(
      body.pending.every((p) =>
        ['laser-60w', 'printer-formlabs', 'pcb-lpkf', 'printer-prusa', 'utm-instron'].includes(
          p.equipmentId,
        ),
      ),
    ).toBe(true);
    expect(body.conflicts.map((c) => c.conflict.id)).toEqual([LASER_CONFLICT]);
    const scores = body.pending.map((p) => p.score.total);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('lets admins see conflicts across all departments', async () => {
    const { app } = buildTestApp();
    const admin = await loginAs(app, 'a-ops');
    const { body } = (await admin.get('/api/approvals').expect(200)) as { body: ApprovalQueue };
    expect(body.conflicts).toHaveLength(2);
  });

  it('favours the urgent, low-usage student and reallocates the rest fairly', async () => {
    const { app } = buildTestApp();
    const faculty = await loginAs(app, 'f-rao');
    const { body } = (await faculty.get('/api/approvals').expect(200)) as { body: ApprovalQueue };
    const plan = body.conflicts[0]!;

    // Priya: deadline the day after the slot; Arjun has 6h of recent usage on this cutter.
    expect(plan.decisions[0]).toMatchObject({ userId: 's-priya', outcome: 'allocate' });
    expect(plan.decisions.at(-1)).toMatchObject({ userId: 's-arjun', outcome: 'reassign' });

    const applied = await faculty
      .post(`/api/conflicts/${LASER_CONFLICT}/apply`)
      .send({})
      .expect(200);
    const updated = applied.body.updated as BookingView[];
    expect(updated).toHaveLength(3);
    expect(updated.every((b) => b.status === 'approved')).toBe(true);
    expect(updated.filter((b) => b.reallocatedFrom)).toHaveLength(2);

    // Conflict is gone and applying again is rejected.
    const after = (await faculty.get('/api/approvals').expect(200)) as { body: ApprovalQueue };
    expect(after.body.conflicts).toHaveLength(0);
    await faculty.post(`/api/conflicts/${LASER_CONFLICT}/apply`).send({}).expect(404);
  });

  it('explains a conflict using the rule-based fallback when Gemini is off', async () => {
    const { app } = buildTestApp();
    const faculty = await loginAs(app, 'f-rao');
    const res = await faculty.post(`/api/conflicts/${LASER_CONFLICT}/explain`).send({}).expect(200);
    expect(res.body.source).toBe('fallback');
    expect(res.body.overview).toMatch(/deadline urgency/);
    expect(res.body.perStudent).toHaveLength(3);
  });

  it('approves and declines single requests with a note', async () => {
    const { app } = buildTestApp();
    const faculty = await loginAs(app, 'f-bose');
    const approved = await faculty
      .post('/api/approvals/bk-seed-p1/decision')
      .send({ decision: 'approve', note: 'Enjoy!' })
      .expect(200);
    expect(approved.body).toMatchObject({
      status: 'approved',
      decision: { by: 'f-bose', note: 'Enjoy!' },
    });
    await faculty
      .post('/api/approvals/bk-seed-p1/decision')
      .send({ decision: 'reject' })
      .expect(409);
  });

  it('blocks approving a conflicting request beyond capacity', async () => {
    const { app } = buildTestApp();
    const faculty = await loginAs(app, 'f-rao');
    await faculty
      .post('/api/approvals/bk-seed-c1/decision')
      .send({ decision: 'approve' })
      .expect(200);
    const res = await faculty
      .post('/api/approvals/bk-seed-c2/decision')
      .send({ decision: 'approve' })
      .expect(409);
    expect(res.body.error.message).toMatch(/exceed capacity/);
  });

  it('forbids faculty from deciding on another department’s equipment', async () => {
    const { app } = buildTestApp();
    const faculty = await loginAs(app, 'f-iyer');
    await faculty
      .post('/api/approvals/bk-seed-c1/decision')
      .send({ decision: 'approve' })
      .expect(403);
    await faculty.post(`/api/conflicts/${LASER_CONFLICT}/apply`).send({}).expect(403);
  });

  it('forbids students from the approval endpoints', async () => {
    const { app } = buildTestApp();
    const student = await loginAs(app, 's-priya');
    await student.get('/api/approvals').expect(403);
    await student
      .post('/api/approvals/bk-seed-c1/decision')
      .send({ decision: 'approve' })
      .expect(403);
  });
});
