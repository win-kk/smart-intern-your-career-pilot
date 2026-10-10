const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const dbPath = require.resolve('../models/database');
let calls = [];
let profile = 11;
let user;
const pool = { query: async (sql, args) => {
  calls.push({sql, args});
  if (sql.includes('password_hash')) return [[user].filter(Boolean)];
  if (sql.includes('AS profile_id')) return [profile ? [{profile_id: profile}] : []];
  if (sql.includes('SELECT a.status')) return [args[0] === 7 && args[1] === 22 ? [{status:'Under Review'}] : []];
  if (sql.includes('UPDATE applications SET')) return [{affectedRows:args[1] === 7 && args[3] === 22 ? 1 : 0}];
  if (sql.includes('UPDATE internships') || sql.includes('UPDATE applications')) return [{affectedRows: args.at(-1) === 22 && args.at(-2) === 7 ? 1 : 0}];
  if (sql.includes('SELECT internship_id FROM internships')) return [args[0] === 7 && args[1] === 22 ? [{internship_id:7}] : []];
  if (sql.includes('DELETE')) return [{affectedRows:0}];
  return [[]];
}};
require.cache[dbPath] = {id:dbPath, filename:dbPath, loaded:true, exports:pool};
const app = require('../app');
const server = app.listen(0, '127.0.0.1');
after(() => new Promise(resolve => server.close(resolve)));
async function request(path, method='GET', body, cookie) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {method, headers:{'content-type':'application/json', ...(cookie ? {cookie}: {})}, body:body === undefined || method === 'GET' ? undefined : JSON.stringify(body)});
  return {status:response.status, body:await response.json(), cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
async function login(role='Student', password=' correct password ') {
  user = {user_id:1,email:'demo@example.test',role,password_hash:await bcrypt.hash(' correct password ',4)};
  profile = role === 'Student' ? 11 : 22;
  return request('/api/auth/login','POST',{email:user.email,role,password});
}
test('authentication, role boundaries, logout and session rotation', async () => {
  const routes = require('../routes/apiRoutes').stack.filter(layer => layer.route).map(layer => layer.route);
  for (const route of routes.filter(route => route.path.startsWith('/api/student/') || route.path.startsWith('/api/company/') || route.path.startsWith('/api/catalog/'))) {
    const path = route.path.replace(/:\w+/g,'7');
    const method = Object.keys(route.methods)[0].toUpperCase();
    assert.equal((await request(path,method,method==='GET'?undefined:{})).status,401, `${method} ${path}`);
  }
  assert.equal((await request('/api/auth/me')).status,401);
  assert.equal((await login('Student','wrong')).status,401);
  assert.equal((await request('/api/auth/login','POST',{})).status,400);
  assert.equal((await request('/api/auth/login','POST',{email:'x',role:'Admin',password:'x'})).status,400);
  const student = await login();
  assert.equal(student.status,200); // password spaces must be preserved
  assert.equal(student.body.profileId,11);
  assert.equal(student.body.password_hash,undefined);
  for (const route of routes.filter(route => route.path.startsWith('/api/company/'))) {
    assert.equal((await request(route.path.replace(/:\w+/g,'7'),Object.keys(route.methods)[0].toUpperCase(),{},student.cookie)).status,403);
  }
  const rotated = await request('/api/auth/login','POST',{email:user.email,role:'Student',password:' correct password '},student.cookie);
  assert.equal(rotated.status,200);
  assert.notEqual(rotated.cookie,student.cookie);
  assert.equal((await request('/api/auth/me','GET',undefined,student.cookie)).status,401);
  assert.equal((await request('/api/auth/me','GET',undefined,rotated.cookie)).status,200);
  assert.equal((await request('/api/auth/logout','POST',{},rotated.cookie)).status,200);
  assert.equal((await request('/api/auth/me','GET',undefined,rotated.cookie)).status,401);
  const company = await login('Company');
  for (const route of routes.filter(route => route.path.startsWith('/api/student/'))) {
    assert.equal((await request(route.path.replace(/:\w+/g,'7'),Object.keys(route.methods)[0].toUpperCase(),{},company.cookie)).status,403);
  }
  profile = null;
  assert.equal((await request('/api/auth/login','POST',{email:user.email,role:'Company',password:' correct password '})).status,403);
});
test('student operations ignore supplied identity and scope queries to session owner', async () => {
  const session = await login();
  calls=[];
  assert.equal((await request('/api/student/profile','PUT',{firstName:'A',lastName:'B',studentId:999,profileId:999},session.cookie)).status,200);
  assert.deepEqual(calls[0].args,['A','B',11]);
  for (const [resource, column] of [['skills','skill_id'],['education','education_id'],['projects','project_id'],['certifications','certification_id'],['experience','experience_id']]) {
    calls=[];
    assert.equal((await request(`/api/student/${resource}/7`,'DELETE',{},session.cookie)).status,200);
    assert.match(calls[0].sql,new RegExp(`student_id = \\? AND ${column} = \\?`));
    assert.deepEqual(calls[0].args,[11,7]);
  }
});
test('company cannot update foreign internships, requirements or application status', async () => {
  const session = await login('Company');
  const body = {title:'Intern',minGpa:3,minStudyYear:2,companyId:999};
  assert.equal((await request('/api/company/internships/999','PUT',body,session.cookie)).status,404);
  assert.equal((await request('/api/company/internships/7','PUT',body,session.cookie)).status,200);
  assert.equal((await request('/api/company/applications/999/status','PATCH',{status:'Accepted'},session.cookie)).status,404);
  assert.equal((await request('/api/company/applications/7/status','PATCH',{status:'Accepted'},session.cookie)).status,200);
  assert.equal((await request('/api/company/internships/999/skills','POST',{skillId:1,minimumProficiency:2,requiredYears:0},session.cookie)).status,404);
});
test('malformed or incomplete sessions fail closed', () => {
  const auth = require('../middleware/auth');
  for (const session of [undefined,{}, {user:{role:'Student'}}, {user:{userId:1,profileId:null,role:'Company'}}, {user:{userId:1,profileId:2,role:'Admin'}}]) {
    let status; let passed=false;
    auth.requireAuth({session},{status(code){status=code;return this},json(){}},()=>{passed=true});
    assert.equal(status,401); assert.equal(passed,false);
  }
});
