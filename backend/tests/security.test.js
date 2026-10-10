const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const db = new DatabaseSync(':memory:');
db.exec(`
CREATE TABLE users(user_id INTEGER PRIMARY KEY,email TEXT,password_hash TEXT,role TEXT);
CREATE TABLE students(student_id INTEGER PRIMARY KEY,user_id INTEGER,first_name TEXT,last_name TEXT);
CREATE TABLE companies(company_id INTEGER PRIMARY KEY,user_id INTEGER,company_name TEXT);
CREATE TABLE internships(internship_id INTEGER PRIMARY KEY,company_id INTEGER,title TEXT,min_gpa REAL,min_study_year INTEGER);
CREATE TABLE applications(application_id INTEGER PRIMARY KEY,student_id INTEGER,internship_id INTEGER,status TEXT,application_date TEXT,match_score REAL);
CREATE TABLE internship_skills(internship_id INTEGER,skill_id INTEGER,is_mandatory INTEGER,minimum_proficiency INTEGER,required_years REAL);
CREATE TABLE student_skills(student_id INTEGER,skill_id INTEGER,proficiency_level INTEGER,years_experience REAL);
CREATE TABLE skills(skill_id INTEGER,skill_name TEXT);
INSERT INTO students VALUES(11,1,'Alice','Test'),(12,2,'Bob','Test');
INSERT INTO companies VALUES(21,3,'First company'),(22,4,'Second company');
INSERT INTO internships VALUES(31,21,'First internship',3,2),(32,22,'Second internship',3,2);
INSERT INTO applications VALUES(41,11,31,'Pending','2026-10-10',90),(42,12,32,'Pending','2026-10-10',80);
`);
const hash = bcrypt.hashSync('test-password',4);
for (const [id,role] of [[1,'Student'],[2,'Student'],[3,'Company'],[4,'Company']]) {
 db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(id,`user${id}@example.test`,hash,role);
}
let race = false;
const pool = { query: async (sql,args=[]) => {
 if (race && sql.includes('UPDATE applications SET')) {
  race=false;
  db.prepare("UPDATE applications SET status='Rejected' WHERE application_id=?").run(args[1]);
 }
 const statement=db.prepare(sql);
 return /^\s*SELECT/i.test(sql) ? [statement.all(...args)] : [{affectedRows:statement.run(...args).changes}];
}};
const dbPath=require.resolve('../models/database');
require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:pool};
const app=require('../app');
const server=app.listen(0,'127.0.0.1');
after(async()=>{await new Promise(resolve=>server.close(resolve));db.close();});
async function request(path,method='GET',body,cookie) {
 const response=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{
  method,headers:{'content-type':'application/json',...(cookie?{cookie}:{})},
  body:body===undefined?undefined:JSON.stringify(body)
 });
 return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
async function login(id) {
 const response=await request('/api/auth/login','POST',{email:`user${id}@example.test`,password:'test-password',role:id<3?'Student':'Company'});
 assert.equal(response.status,200);return response.cookie;
}
const statusOf=id=>db.prepare('SELECT status FROM applications WHERE application_id=?').get(id).status;
const patch=(cookie,id,status)=>request(`/api/company/applications/${id}/status`,'PATCH',{status},cookie);

test('two student sessions cannot retrieve each other applications by supplying IDs',async()=>{
 const alice=await login(1),bob=await login(2);
 for(const [cookie,own,foreign] of [[alice,41,12],[bob,42,11]]) {
  const response=await request(`/api/student/applications?studentId=${foreign}&profileId=${foreign}`,'GET',undefined,cookie);
  assert.equal(response.status,200);assert.deepEqual(response.body.map(row=>row.application_id),[own]);
 }
 assert.equal((await request('/api/company/internships/31/applications','GET',undefined,alice)).status,403);
 assert.equal((await patch(alice,42,'Under Review')).status,403);
 assert.equal(statusOf(42),'Pending');
});

test('two companies cannot list foreign internships/applicants or modify foreign records',async()=>{
 const first=await login(3),second=await login(4);
 for(const [cookie,own,foreign,foreignApplication] of [[first,31,32,42],[second,32,31,41]]) {
  const list=await request('/api/company/internships?companyId=999','GET',undefined,cookie);
  assert.equal(list.status,200);assert.deepEqual(list.body.map(row=>row.internship_id),[own]);
  const applicants=await request(`/api/company/internships/${foreign}/applications`,'GET',undefined,cookie);
  assert.equal(applicants.status,200);assert.deepEqual(applicants.body,[]);
  assert.equal((await request(`/api/company/internships/${own}/applications`,'GET',undefined,cookie)).body.length,1);
  assert.equal((await request(`/api/company/internships/${foreign}`,'PUT',{title:'Stolen',minGpa:0,minStudyYear:1},cookie)).status,404);
  assert.equal((await request(`/api/company/internships/${foreign}`,'DELETE',undefined,cookie)).status,404);
  assert.equal((await request(`/api/company/internships/${foreign}/skills`,'POST',{skillId:1,minimumProficiency:1,requiredYears:0},cookie)).status,404);
  assert.equal((await patch(cookie,foreignApplication,'Under Review')).status,404);
  assert.equal(statusOf(foreignApplication),'Pending');
 }
 assert.deepEqual(db.prepare('SELECT title FROM internships ORDER BY internship_id').all().map(row=>row.title),['First internship','Second internship']);
});

test('complete transition matrix: final decisions cannot reopen; same status is idempotent',async()=>{
 const owner=await login(3);
 const states=['Pending','Under Review','Accepted','Rejected'];
 const allowed={Pending:['Under Review'],'Under Review':['Accepted','Rejected']};
 for(const current of states) for(const next of states) {
  db.prepare('UPDATE applications SET status=? WHERE application_id=41').run(current);
  const response=await patch(owner,41,next);
  const valid=current===next || allowed[current]?.includes(next);
  assert.equal(response.status,valid?200:409,`${current} -> ${next}`);
  assert.equal(statusOf(41),valid?next:current);
 }
 assert.equal((await patch(owner,41,'Hired')).status,400);
 assert.equal(statusOf(41),'Rejected');
 // Both workflow branches are reflected in the student's own tracker response.
 const student=await login(1);
 for(const decision of ['Accepted','Rejected']) {
  db.prepare("UPDATE applications SET status='Pending' WHERE application_id=41").run();
  assert.equal((await patch(owner,41,'Under Review')).status,200);
  assert.equal((await patch(owner,41,decision)).status,200);
  const tracker=await request('/api/student/applications','GET',undefined,student);
  assert.equal(tracker.body[0].status,decision);
 }
});

test('concurrent decision does not overwrite a newer final status',async()=>{
 const owner=await login(3);
 db.prepare("UPDATE applications SET status='Under Review' WHERE application_id=41").run();
 race=true;
 assert.equal((await patch(owner,41,'Accepted')).status,409);
 assert.equal(statusOf(41),'Rejected');
});


test('company skill report separates satisfied, missing, low proficiency and low experience requirements',async()=>{
 db.exec(`INSERT INTO skills VALUES(1,'SQL'),(2,'Java'),(3,'Python'),(4,'Git');
 INSERT INTO internship_skills VALUES(31,1,1,3,1),(31,2,1,3,0),(31,3,0,2,2),(31,4,0,1,0);
 INSERT INTO student_skills VALUES(11,1,4,2),(11,2,2,1),(11,3,3,1);`);
 const owner=await login(3),foreign=await login(4),student=await login(1);
 const path='/api/company/internships/31/skills-report';
 assert.equal((await request(path)).status,401);
 assert.equal((await request(path,'GET',undefined,student)).status,403);
 assert.equal((await request(path,'GET',undefined,foreign)).status,404);
 const report=await request(path,'GET',undefined,owner);
 assert.equal(report.status,200);assert.equal(report.body.length,1);
 const applicant=report.body[0];
 assert.equal(applicant.application_id,41);assert.equal(applicant.match_score,90);
 assert.deepEqual(applicant.matchedSkills,['SQL']);
 assert.deepEqual(applicant.missingSkills,['Git','Java','Python']);
 assert.deepEqual(applicant.missingMandatorySkills,['Java']);
 assert.equal(applicant.requirements.find(skill=>skill.skillName==='Git').proficiencyLevel,null);
 assert.equal(applicant.requirements.find(skill=>skill.skillName==='Python').requiredYears,2);
 const empty=await request('/api/company/internships/32/skills-report','GET',undefined,foreign);
 assert.deepEqual(empty.body[0].requirements,[]);
 assert.deepEqual(empty.body[0].missingSkills,[]);
});
