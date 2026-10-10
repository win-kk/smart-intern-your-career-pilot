const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const validation = require('../utils/validation');
let queryHandler = async () => [[]];
let connectionFailure = false;
let transactionFailure = false;
let events=[];
const pool = {
 query:(sql,args)=>queryHandler(sql,args),
 getConnection:async()=>{
  if(connectionFailure) throw new Error('private connection details');
  return {
   beginTransaction:async()=>events.push('begin'),
   query:async(sql,args)=>{events.push({sql,args});if(transactionFailure)throw new Error('write failed');return [{insertId:55}];},
   commit:async()=>events.push('commit'),rollback:async()=>events.push('rollback'),release:()=>events.push('release')
  };
 }
};
const dbPath=require.resolve('../models/database');
require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:pool};
const student=require('../controllers/studentController');
const company=require('../controllers/companyController');
async function invoke(handler,body={},params={}){
 let status=200,result,error;
 const res={status(code){status=code;return this},json(value){result=value;return this}};
 await handler({body,params,session:{user:{profileId:11}}},res,e=>{error=e});
 return {status,result,error};
}
test('rejects missing numeric values, fractional integer fields, objects, invalid dates; parses false correctly',()=>{
 for(const value of ['', ' ',null,undefined,false,[],{}]) assert.throws(()=>validation.numberValue(value,'GPA',0,4),{status:400});
 assert.equal(validation.numberValue('0','GPA',0,4),0);
 assert.throws(()=>validation.integerValue(2.5,'Year',1,10),{status:400});
 assert.throws(()=>validation.idParam(true,'ID'),{status:400});
 assert.throws(()=>validation.requiredText({},'Name'),{status:400});
 assert.throws(()=>validation.dateValue('2026-02-30','Date'),{status:400});
 assert.equal(validation.dateValue('2024-02-29','Date'),'2024-02-29');
 assert.equal(validation.booleanValue('false','Flag'),false);
});
test('experience returns existing and newly created IDs after committing',async()=>{
 for(const body of [{experienceId:7},{organization:'Demo'}]){
  events=[];
  const response=await invoke(student.postStudentExperience,{...body,positionTitle:'Intern',role:'Developer',durationMonths:3});
  assert.equal(response.error,undefined);assert.equal(response.status,201);
  assert.equal(response.result.experienceId,body.experienceId || 55);
  assert.equal(events.includes('rollback'),false);assert.deepEqual(events.slice(-2),['commit','release']);
 }
});
test('transaction handlers forward acquisition failures and release after failed writes',async()=>{
 const cases=[['postStudentSkills',{skillId:1,proficiencyLevel:2,yearsExperience:0}],['postStudentEducation',{educationId:1,gpa:3,studyYear:2}],['postStudentProjects',{projectName:'Demo',projectRole:'Developer'}],['postStudentExperience',{experienceId:1,positionTitle:'Intern',role:'Developer',durationMonths:3}]];
 for(const [name,body] of cases){
  connectionFailure=true;
  assert.match((await invoke(student[name],body)).error.message,/connection/);
  connectionFailure=false;transactionFailure=true;events=[];
  assert.match((await invoke(student[name],body)).error.message,/write failed/);
  assert.deepEqual(events.slice(-2),['rollback','release']);transactionFailure=false;
 }
});
test('applications persist server score, handle duplicate and missing internship',async()=>{
 let stored;
 queryHandler=async(sql,args)=>{
  if(sql.startsWith('\nWITH')) return [[{internship_id:'7',match_score:'85.00'}]];
  stored=args;return [{insertId:9}];
 };
 const response=await invoke(student.postStudentApplications,{internshipId:7,matchScore:100,studentId:999});
 assert.equal(response.status,201);assert.deepEqual(stored,[11,7,85]);
 queryHandler=async sql=>sql.startsWith('\nWITH')?[[{internship_id:7,match_score:85}]]:Promise.reject(Object.assign(new Error('duplicate'),{code:'ER_DUP_ENTRY'}));
 assert.equal((await invoke(student.postStudentApplications,{internshipId:7})).status,409);
 queryHandler=async()=>[[]];
 assert.equal((await invoke(student.postStudentApplications,{internshipId:7})).status,404);
});
test('company internship CRUD uses session owner and rejects invalid status before SQL',async()=>{
 const calls=[];
 queryHandler=async(sql,args)=>{calls.push({sql,args});return [{insertId:7,affectedRows:1}];};
 assert.equal((await invoke(company.postCompanyInternships,{title:'Intern',minGpa:3,minStudyYear:2,companyId:999})).status,201);
 assert.deepEqual(calls[0].args,[11,'Intern',3,2]);
 const count=calls.length;
 assert.equal((await invoke(company.patchCompanyApplicationsApplicationIdStatus,{status:'Hired'},{applicationId:7})).status,400);
 assert.equal(calls.length,count);
 queryHandler=async()=>[{affectedRows:0}];
 assert.equal((await invoke(company.deleteCompanyInternshipsInternshipId,{}, {internshipId:999})).status,404);
 queryHandler=async()=>{throw Object.assign(new Error('dependent'),{code:'ER_ROW_IS_REFERENCED_2'});};
 assert.equal((await invoke(company.deleteCompanyInternshipsInternshipId,{}, {internshipId:7})).status,409);
});
test('matching SQL handles normal, missing, mandatory and high study-year cases',async()=>{
 const db=new DatabaseSync(':memory:');
 db.function('LEAST', (a,b)=>Math.min(a,b));
 db.exec(`CREATE TABLE students(student_id INTEGER);INSERT INTO students VALUES(11);
 CREATE TABLE companies(company_id INTEGER, company_name TEXT, description TEXT);INSERT INTO companies VALUES(1,'Demo','Demo');
 CREATE TABLE internships(internship_id INTEGER,company_id INTEGER,title TEXT,min_gpa REAL,min_study_year INTEGER);INSERT INTO internships VALUES(7,1,'Intern',3,2);
 CREATE TABLE skills(skill_id INTEGER,skill_name TEXT);INSERT INTO skills VALUES(1,'Java'),(2,'SQL');
 CREATE TABLE internship_skills(internship_id INTEGER,skill_id INTEGER,is_mandatory INTEGER,minimum_proficiency INTEGER,required_years REAL);INSERT INTO internship_skills VALUES(7,1,1,2,0),(7,2,0,2,0);
 CREATE TABLE student_skills(student_id INTEGER,skill_id INTEGER,proficiency_level INTEGER,years_experience REAL);INSERT INTO student_skills VALUES(11,1,3,1),(11,2,3,1);
 CREATE TABLE student_education(student_id INTEGER,gpa REAL,study_year INTEGER,is_current INTEGER);INSERT INTO student_education VALUES(11,3.5,3,1);
 CREATE TABLE applications(student_id INTEGER,internship_id INTEGER,application_id INTEGER,status TEXT);`);
 queryHandler=async(sql,args)=>{
  // Adapt only MySQL GROUP_CONCAT ordering/separator syntax for SQLite execution.
  const adapted=sql.replace(/GROUP_CONCAT\(([\s\S]*?)\s+ORDER BY sk.skill_name SEPARATOR ', '\)/g,'GROUP_CONCAT($1)').replace('satisfied_skills / total_skills', '1.0 * satisfied_skills / total_skills');
  return [db.prepare(adapted).all(...args)];
 };
 const matching=require('../models/matchingModel');
 const run=async()=> (await matching.getStudentMatches(11))[0];
 assert.equal((await run()).match_score,92.5);
 db.exec('DELETE FROM student_skills WHERE skill_id=2');assert.equal((await run()).match_score,62.5);
 assert.equal((await run()).matched_skills,'Java');assert.equal((await run()).missing_skills,'SQL');
 db.exec('INSERT INTO student_skills VALUES(11,2,3,1)');
 db.exec('UPDATE student_education SET study_year=10');assert.equal((await run()).match_score,97.5);
 db.exec('DELETE FROM student_skills WHERE skill_id=1');
 assert.equal((await run()).match_score,37.5);assert.equal((await run()).missing_mandatory_skills,'Java');
 db.exec('DELETE FROM student_education');assert.equal((await run()).match_score,0);assert.equal((await run()).qualification_status,'Not fully qualified');
 db.exec('DELETE FROM internship_skills');assert.equal((await run()).match_score,60);
 db.close();
});
const app=require('../app');
const server=app.listen(0,'127.0.0.1');
after(()=>new Promise(resolve=>server.close(resolve)));
test('HTTP errors hide database details and malformed JSON returns 400',async()=>{
 queryHandler=async()=>{throw new Error('private SQL credentials');};
 const base=`http://127.0.0.1:${server.address().port}`;
 const response=await fetch(base+'/api/health');assert.equal(response.status,500);assert.deepEqual(await response.json(),{error:'Server error'});
 const invalid=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:'{'});
 assert.equal(invalid.status,400);assert.deepEqual(await invalid.json(),{error:'Invalid JSON body'});
});
