'use strict';

/**
 * בדיקת עשן ל-API: מריץ תרחיש מלא מול שרת פעיל.
 * שימוש: הפעל את השרת (npm start) ואז: node scripts/smoke.js
 */

const BASE = process.env.BASE || 'http://localhost:3000';
let pass = 0;
let fail = 0;

function check(name, cond, extra) {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fail += 1;
    console.log(`  ✗ ${name}${extra ? ' → ' + JSON.stringify(extra) : ''}`);
  }
}

async function api(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch (_) {}
  return { status: res.status, data };
}

async function main() {
  console.log(`\n== בדיקת עשן: ${BASE} ==\n`);

  // Health
  const health = await api('GET', '/api/health');
  check('health ok', health.status === 200 && health.data.status === 'ok', health.data);

  // Status
  let status = await api('GET', '/api/auth/status');
  check('status endpoint', status.status === 200, status.data);

  // Setup first parent (may already be initialized on re-run)
  let parentToken;
  const setup = await api('POST', '/api/auth/setup', { body: { name: 'אבא', pin: '1234' } });
  if (setup.status === 201) {
    check('setup parent', true);
    parentToken = setup.data.token;
  } else {
    check('setup blocked when initialized', setup.status === 409, setup.data);
    const login = await api('POST', '/api/auth/login', { body: { name: 'אבא', pin: '1234' } });
    check('parent login', login.status === 200, login.data);
    parentToken = login.data.token;
  }

  // Create a child
  const child = await api('POST', '/api/auth/members', {
    token: parentToken,
    body: { name: 'דני', pin: '1111', role: 'child', allowanceVisibleToSiblings: false },
  });
  const childCreated = child.status === 201 || child.status === 409;
  check('create child (or exists)', childCreated, child.data);

  const childLogin = await api('POST', '/api/auth/login', { body: { name: 'דני', pin: '1111' } });
  check('child login', childLogin.status === 200, childLogin.data);
  const childToken = childLogin.data.token;
  const childId = childLogin.data.member.id;

  // Child cannot create members
  const forbidden = await api('POST', '/api/auth/members', {
    token: childToken,
    body: { name: 'x', pin: '2222', role: 'child' },
  });
  check('child forbidden from creating members', forbidden.status === 403, forbidden.data);

  // Parent creates a duty task (no payment) assigned to the child
  const dutyTask = await api('POST', '/api/tasks', {
    token: parentToken,
    body: { title: 'לסדר את המיטה', assignedTo: childId, type: 'duty', points: 999, notes: 'כל בוקר' },
  });
  check('create duty task', dutyTask.status === 201 && dutyTask.data.type === 'duty', dutyTask.data);
  check('duty task ignores points', dutyTask.data.points === 0, dutyTask.data);

  // Parent creates a paid task assigned to child, and adds it to the templates library
  const task = await api('POST', '/api/tasks', {
    token: parentToken,
    body: { title: 'להוציא את הזבל', assignedTo: childId, type: 'paid', points: 10, notes: 'כל ערב', addToLibrary: true },
  });
  check('create paid task', task.status === 201 && task.data.type === 'paid' && task.data.points === 10, task.data);
  const taskId = task.data.id;

  // Approving the duty task must NOT credit allowance
  const dutySubmit = await api('POST', `/api/tasks/${dutyTask.data.id}/submit`, { token: childToken });
  check('duty task submit', dutySubmit.status === 200, dutySubmit.data);
  const dutyApprove = await api('POST', `/api/tasks/${dutyTask.data.id}/approve`, { token: parentToken });
  check('duty task approve', dutyApprove.status === 200, dutyApprove.data);
  const balBeforePaid = await api('GET', `/api/allowance/${childId}`, { token: parentToken });
  check('duty task did not credit allowance', balBeforePaid.status === 200 && balBeforePaid.data.balance === 0, balBeforePaid.data);

  // Templates library: the paid task should have been saved to the library
  const templates = await api('GET', '/api/tasks/templates', { token: parentToken });
  check('templates list includes new template', templates.status === 200 && templates.data.some((t) => t.title === 'להוציא את הזבל' && t.type === 'paid'), templates.data);
  const templateId = templates.data.find((t) => t.title === 'להוציא את הזבל').id;

  // Quick-assign from templates: bulk-assign the template to the child
  const bulk = await api('POST', '/api/tasks/assign-from-templates', {
    token: parentToken,
    body: { assignedTo: childId, templateIds: [templateId] },
  });
  check('assign from templates', bulk.status === 201 && bulk.data.length === 1 && bulk.data[0].templateId === templateId, bulk.data);

  // Child sees only own tasks
  const childTasks = await api('GET', '/api/tasks', { token: childToken });
  check('child sees assigned task', childTasks.status === 200 && childTasks.data.some((t) => t.id === taskId), childTasks.data);

  // Child submits task
  const submit = await api('POST', `/api/tasks/${taskId}/submit`, { token: childToken });
  check('child submits task', submit.status === 200 && submit.data.status === 'submitted', submit.data);

  // Child cannot approve
  const childApprove = await api('POST', `/api/tasks/${taskId}/approve`, { token: childToken });
  check('child cannot approve', childApprove.status === 403, childApprove.data);

  // Parent approves → allowance credit
  const approve = await api('POST', `/api/tasks/${taskId}/approve`, { token: parentToken });
  check('parent approves task', approve.status === 200 && approve.data.status === 'approved', approve.data);

  // Child balance should reflect 10 from the approved task
  const bal = await api('GET', `/api/allowance/${childId}`, { token: childToken });
  check('allowance credited from task', bal.status === 200 && bal.data.balance >= 10, bal.data);

  // Parent adds manual debit
  const debit = await api('POST', '/api/allowance', {
    token: parentToken,
    body: { memberId: childId, amount: 4, type: 'debit', reason: 'קנה ממתק' },
  });
  check('manual debit', debit.status === 201 && debit.data.balance === bal.data.balance - 4, debit.data);

  // Sibling visibility: create second child who cannot see danny
  await api('POST', '/api/auth/members', {
    token: parentToken,
    body: { name: 'נועה', pin: '3333', role: 'child' },
  });
  const noaLogin = await api('POST', '/api/auth/login', { body: { name: 'נועה', pin: '3333' } });
  const noaToken = noaLogin.data.token;
  const noaSeesDanny = await api('GET', `/api/allowance/${childId}`, { token: noaToken });
  check('sibling blocked from private allowance', noaSeesDanny.status === 403, noaSeesDanny.data);

  // Shopping: child requests, parent approves
  const req = await api('POST', '/api/shopping', { token: childToken, body: { name: 'חלב', qty: '2' } });
  check('child shopping request', req.status === 201 && req.data.status === 'requested', req.data);
  const shopId = req.data.id;
  const approveShop = await api('POST', `/api/shopping/${shopId}/approve`, { token: parentToken });
  check('parent approves shopping', approveShop.status === 200 && approveShop.data.status === 'approved', approveShop.data);
  const purchased = await api('POST', `/api/shopping/${shopId}/purchased`, { token: childToken });
  check('mark purchased', purchased.status === 200 && purchased.data.status === 'purchased', purchased.data);

  // Surveys: child creates, votes
  const survey = await api('POST', '/api/surveys', {
    token: childToken,
    body: { question: 'לאן בטיול המשפחתי?', options: ['ים', 'כנרת', 'צימר'] },
  });
  check('create survey', survey.status === 201 && survey.data.options.length === 3, survey.data);
  const surveyId = survey.data.id;
  const optId = survey.data.options[0].id;
  const vote = await api('POST', `/api/surveys/${surveyId}/vote`, { token: noaToken, body: { optionId: optId } });
  check('vote survey', vote.status === 200 && vote.data.totalVotes === 1, vote.data);

  // Weekly summary
  const weekly = await api('GET', '/api/summary/weekly', { token: parentToken });
  check('weekly summary', weekly.status === 200 && Array.isArray(weekly.data.ranking), weekly.data);

  console.log(`\n== סיום: ${pass} עברו, ${fail} נכשלו ==\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((err) => {
  console.error('שגיאת בדיקה:', err);
  process.exit(1);
});
