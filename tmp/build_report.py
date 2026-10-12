from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(r"D:\03_Projects\smart-intern")
OUT = ROOT / "SmartIntern_Project_Report.docx"
TMP = ROOT / "tmp"
DIAGRAM = TMP / "smartintern-erd-current.png"
SCHEMA_MAPPING_IMAGE = TMP / "SmartIntern_schema_exact_key_mapping.png"

def shade(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)

def margins(cell, top=90, start=110, bottom=90, end=110):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = tcPr.first_child_found_in("w:tcMar")
    if tcMar is None:
        tcMar = OxmlElement("w:tcMar")
        tcPr.append(tcMar)
    for key, value in [("top", top), ("start", start), ("bottom", bottom), ("end", end)]:
        node = tcMar.find(qn("w:" + key))
        if node is None:
            node = OxmlElement("w:" + key)
            tcMar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")

def set_cell(cell, text, bold=False, color=None, size=9):
    cell.text = ""
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    run = p.add_run(str(text))
    run.bold = bold
    run.font.size = Pt(size)
    if color:
        run.font.color.rgb = RGBColor.from_string(color)
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    margins(cell)

def add_table(doc, headers, rows, widths=None, size=8.5):
    t = doc.add_table(rows=1, cols=len(headers))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.style = "Table Grid"
    for i, head in enumerate(headers):
        set_cell(t.rows[0].cells[i], head, True, "000000", size)
        shade(t.rows[0].cells[i], "D9D9D9")
    for n, row in enumerate(rows):
        cells = t.add_row().cells
        for i, value in enumerate(row):
            set_cell(cells[i], value, False, None, size)
            if n % 2:
                shade(cells[i], "F5F5F5")
    if widths:
        for row in t.rows:
            for i, width in enumerate(widths):
                row.cells[i].width = Inches(width)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return t

def code_block(doc, text, max_lines=None):
    if max_lines:
        lines = text.splitlines()
        if len(lines) > max_lines:
            text = "\n".join(lines[:max_lines] + ["-- Remaining statements are in the project SQL file."])
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Inches(0.2)
    p.paragraph_format.right_indent = Inches(0.2)
    p.paragraph_format.space_before = Pt(3)
    p.paragraph_format.space_after = Pt(6)
    run = p.add_run(text)
    run.font.name = "Consolas"
    run.font.size = Pt(7.2)
    run.font.color.rgb = RGBColor(35, 35, 35)

def caption(doc, text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(8)
    run = p.add_run(text)
    run.italic = True
    run.font.size = Pt(9)
    run.font.color.rgb = RGBColor(80, 80, 80)

def page_number(paragraph):
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = "PAGE"
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.append(begin)
    run._r.append(instr)
    run._r.append(end)

def make_erd():
    W, H = 1800, 1050
    image = Image.new("RGB", (W, H), "white")
    draw = ImageDraw.Draw(image)
    try:
        title = ImageFont.truetype("arial.ttf", 30)
        head = ImageFont.truetype("arial.ttf", 20)
        body = ImageFont.truetype("arial.ttf", 16)
    except OSError:
        title = head = body = ImageFont.load_default()
    draw.text((50, 30), "SmartIntern Current Relational EER Overview", fill="#111111", font=title)
    boxes = {
        "users": (60, 140, 330, 270), "students": (430, 100, 740, 270),
        "companies": (430, 330, 740, 500), "internships": (860, 330, 1190, 500),
        "skills": (860, 100, 1190, 270), "education": (60, 400, 330, 530),
        "projects": (60, 680, 330, 810), "certifications": (430, 680, 740, 810),
        "experience": (860, 680, 1190, 810), "student_skills": (1280, 100, 1640, 220),
        "internship_skills": (1280, 300, 1640, 420), "student_education": (60, 870, 430, 1010),
        "student_projects": (500, 870, 850, 1010), "student_certifications": (920, 870, 1270, 1010),
        "student_experience": (1340, 870, 1740, 1010)
    }
    bridges = {"student_skills", "internship_skills", "student_education", "student_projects", "student_certifications", "student_experience"}
    details = {
        "users": "user_id PK | email | role", "students": "student_id PK | user_id FK",
        "companies": "company_id PK | user_id FK", "internships": "internship_id PK | company_id FK",
        "skills": "skill_id PK | skill_name", "education": "education_id PK | institution | degree",
        "projects": "project_id PK | project_code", "certifications": "certification_id PK | name | issuer",
        "experience": "experience_id PK | organization", "student_skills": "student_id + skill_id PK | proficiency | years",
        "internship_skills": "internship_id + skill_id PK | mandatory | thresholds",
        "student_education": "student_id + education_id PK | GPA | study_year | current",
        "student_projects": "student_id + project_id PK | project_role",
        "student_certifications": "student_id + certification_id PK | issue_date",
        "student_experience": "student_id + experience_id PK | position | role | duration"
    }
    centers = {}
    for name, (x1, y1, x2, y2) in boxes.items():
        fill = "#F2F2F2" if name in bridges else "#FFFFFF"
        draw.rounded_rectangle((x1, y1, x2, y2), radius=14, fill=fill, outline="#555555", width=3)
        draw.text((x1 + 15, y1 + 15), name, fill="#111111", font=head)
        draw.text((x1 + 15, y1 + 55), details[name], fill="#333333", font=body)
        centers[name] = ((x1 + x2) // 2, (y1 + y2) // 2)
    edges = [
        ("users", "students"), ("users", "companies"), ("companies", "internships"),
        ("students", "student_skills"), ("skills", "student_skills"),
        ("internships", "internship_skills"), ("skills", "internship_skills"),
        ("students", "student_education"), ("education", "student_education"),
        ("students", "student_projects"), ("projects", "student_projects"),
        ("students", "student_certifications"), ("certifications", "student_certifications"),
        ("students", "student_experience"), ("experience", "student_experience")
    ]
    for left, right in edges:
        draw.line((centers[left], centers[right]), fill="#555555", width=2)
    image.save(DIAGRAM)

doc = Document()
section = doc.sections[0]
section.top_margin = Inches(0.7)
section.bottom_margin = Inches(0.65)
section.left_margin = Inches(0.75)
section.right_margin = Inches(0.75)
styles = doc.styles
styles["Normal"].font.name = "Aptos"
styles["Normal"].font.size = Pt(10.5)
styles["Normal"].paragraph_format.space_after = Pt(6)
styles["Normal"].paragraph_format.line_spacing = 1.08
for name, size, color in [("Title", 26, "000000"), ("Heading 1", 16, "000000"), ("Heading 2", 12.5, "000000"), ("Heading 3", 11, "000000")]:
    styles[name].font.name = "Aptos Display"
    styles[name].font.size = Pt(size)
    styles[name].font.color.rgb = RGBColor.from_string(color)
    styles[name].font.bold = True
for name in ["Title Char", "Heading 1 Char", "Heading 2 Char", "Heading 3 Char"]:
    try:
        styles[name].font.color.rgb = RGBColor(0, 0, 0)
    except KeyError:
        pass
title_ppr = styles["Title"]._element.get_or_add_pPr()
title_border = title_ppr.find(qn("w:pBdr"))
if title_border is not None:
    title_ppr.remove(title_border)
for sec in doc.sections:
    page_number(sec.footer.paragraphs[0])

p = doc.add_paragraph(style="Title")
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.add_run("SmartIntern Project Report")
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("Rule Based Internship Matching System")
r.bold = True
r.font.size = Pt(16)
r.font.color.rgb = RGBColor(0, 0, 0)
doc.add_paragraph()
add_table(doc, ["Item", "Details"], [
    ["Project", "SmartIntern: Rule Based Internship Matching System"],
    ["Group", "NEXORA"],
    ["Members", "Hein Htet Aung; Win Khant Ko Ko; Ye Lin Aung"],
    ["Database", "MySQL Community Server with MySQL Workbench"],
    ["Application", "Node.js, Express, HTML, CSS and JavaScript"]
], [1.3, 5.7], 10)
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.add_run("Database implementation and application demonstration report").italic = True
doc.add_page_break()

doc.add_heading("1 Introduction and Business Background", 1)
doc.add_heading("1.1 Business Background", 2)
doc.add_paragraph("SmartIntern is a small university internship matching platform designed for a pilot involving approximately 100 students, 10 companies, 20 internship opportunities and around 50 applications per month. Students maintain structured profiles containing education, skills, projects, certifications and experience. Companies create internship records and specify required skills, minimum proficiency, minimum GPA and minimum study year. The project demonstrates how a relational database can support the recruitment workflow with consistent records, foreign-key relationships and repeatable SQL reports.")
doc.add_paragraph("The platform uses one authenticated user account for each participant. A user account has either a Student or Company role, and the selected role determines the corresponding profile. Students can review internships, inspect matching evidence and submit applications. Companies can manage internships, define skill requirements and review applications. The project does not include an administrator workflow, AI resume parsing, notifications, password reset, payment or paid cloud deployment.")
doc.add_heading("1.2 Business Problem", 2)
doc.add_paragraph("Students often search across unrelated internship websites, company pages, career pages and messages. They may apply without knowing whether they satisfy a required skill, GPA or study-year condition. Companies also need a consistent way to compare applicants and identify missing requirements. A relational database addresses these problems by storing structured profile data, connecting applications to specific internships and supporting transparent matching calculations instead of unexplained recommendations.")
doc.add_heading("1.3 Project Scope", 2)
add_table(doc, ["In scope", "Out of scope"], [[
    "Authentication and role-based access; Student and Company profiles; skills; education; projects; certifications; experience; internships; applications; rule-based matching; SQL reports.",
    "Admin accounts; internship publication status; AI matching; resume parsing; notifications; password reset; email verification; payment; paid cloud hosting."
]], [3.4, 3.4], 9)

doc.add_heading("2 Motivation", 1)
doc.add_paragraph("The project is motivated by the need to replace scattered profile information and manual internship comparison with a controlled relational database. SmartIntern gives students one place to maintain evidence of their capabilities and gives companies structured requirements that can be compared consistently. The database also provides a practical demonstration of normalization, foreign keys, many-to-many bridge tables, data validation and SQL reporting in a realistic recruitment scenario.")

doc.add_heading("3 Objectives and Business Questions", 1)
add_table(doc, ["ID", "Objective"], [
    ["O1", "Record student profiles, reusable education records, projects, certifications, experience and skills."],
    ["O2", "Record company internships and their required skills, minimum GPA and minimum study year."],
    ["O3", "Calculate a transparent match score using skills 60%, GPA 20% and study year 20%."],
    ["O4", "Allow users to submit and track internship applications by status."],
    ["O5", "Answer the three business questions using SQL queries and reports."]
], [0.55, 6.25], 9)
doc.add_paragraph("The three business questions are: (1) Which students are the best qualified for each internship? (2) Which mandatory skills are missing or insufficient for a selected student and internship? (3) What is the match score for every student-internship pair?")

doc.add_heading("4 Business Rules", 1)
rules = [
    ["BR1", "Relationship", "Each Student profile and each Company profile belongs to exactly one User account. The profile tables use a unique user_id foreign key."],
    ["BR2", "Relationship", "One Company may post zero or more Internships; each Internship belongs to exactly one Company."],
    ["BR3", "Relationship", "A Student may have many Skills, and a Skill may belong to many Students through Student_Skill."],
    ["BR4", "Relationship", "An Internship may require many Skills, and a Skill may be required by many Internships through Internship_Skill."],
    ["BR5", "Relationship", "A Student may apply to many Internships, and an Internship may receive many Applications."],
    ["BR6", "Relationship", "A Student may be linked to many Education records through Student_Education."],
    ["BR7", "Relationship", "A Student may contribute to many Projects, and a Project may include many Students through Student_Project."],
    ["BR8", "Relationship", "A Student may hold many Certification records, and a Certification may belong to many Students."],
    ["BR9", "Relationship", "A Student may have many Experience records, and an Organization record may be linked to many Students through Student_Experience."],
    ["BR10", "Participation", "Each Application references exactly one Student and exactly one Internship."],
    ["BR11", "Participation", "Each Internship must have at least one Internship_Skill record before it can be considered complete for matching."],
    ["BR12", "Participation", "A Student may have zero or more records in Education, Project, Certification and Experience."],
    ["BR13", "Attribute", "Each User email is unique and each password is stored as a password hash."],
    ["BR14", "Attribute", "GPA is between 0.00 and 4.00, and study_year is a positive year level."],
    ["BR15", "Attribute", "Skill proficiency is an integer from 1 to 5 and required years cannot be negative."],
    ["BR16", "Attribute", "match_score is between 0 and 100 and status is Pending, Under Review, Accepted or Rejected."],
    ["BR17", "Specialization", "User is the supertype. Student and Company are subtypes. The relationship is implemented by storing user_id as a unique foreign key in each subtype table. The specialization is disjoint because one account has only one role, and partial because only Student and Company roles are supported in this project."],
    ["BR18", "Matching", "A student may have multiple education records, but one record is designated current with is_current = TRUE."],
    ["BR19", "Matching", "If a mandatory skill fails, the skill component becomes zero. GPA and study-year components independently become zero when below their internship minimums."],
    ["BR20", "Integrity", "A student may submit at most one application for the same internship, enforced by UNIQUE(student_id, internship_id)."]
]
add_table(doc, ["Rule", "Category", "Business rule"], rules, [0.5, 0.9, 5.4], 7.3)

doc.add_heading("5 Database System Architecture", 1)
doc.add_paragraph("SmartIntern uses a local three-layer architecture. The browser provides the user interface for authentication, profile management, internship discovery and application workflows. Node.js with Express receives HTTP requests, validates input, enforces session and role rules, calculates or retrieves matching information and calls the database models. MySQL Community Server stores normalized relational data, integrity constraints, sample data and SQL reports. MySQL Workbench is used to create the schema, inspect tables and run SQL queries.")
add_table(doc, ["Layer", "Main responsibility", "Technology"], [
    ["Presentation", "Login, dashboards, profiles, internship browsing, applications and company review screens.", "HTML, CSS, JavaScript"],
    ["Application", "Authentication, sessions, role checks, validation, CRUD operations and matching workflow.", "Node.js and Express"],
    ["Data", "Tables, primary keys, foreign keys, constraints, sample data and business queries.", "MySQL Community Server"],
    ["Development and testing", "Schema execution, query testing, code versioning and team collaboration.", "MySQL Workbench and GitHub"]
], [1.2, 4.0, 1.6], 8.5)

doc.add_heading("6 ER and EER Design", 1)
doc.add_paragraph("The EER design treats User as the supertype and Student and Company as subtypes. The implementation uses separate primary keys for the subtype tables and a unique user_id foreign key in each subtype table. The design includes bridge tables for every agreed many-to-many relationship. Student-specific attributes remain on the bridge records where they describe the relationship rather than the shared catalog record.")
make_erd()
doc.add_picture(str(DIAGRAM), width=Inches(6.7))
caption(doc, "Figure 1. Current relational EER overview. Applications connect Students and Internships and are described in the schema tables below.")

doc.add_heading("7 Entity and Relationship Tables", 1)
entities = [
    ["users", "user_id", "email, password_hash, role", "Authentication account"],
    ["students", "student_id", "user_id, first_name, last_name", "Student subtype profile"],
    ["companies", "company_id", "user_id, company_name, description", "Company subtype profile"],
    ["internships", "internship_id", "company_id, title, min_gpa, min_study_year", "Company opportunity"],
    ["skills", "skill_id", "skill_name, category, description", "Reusable skill catalog"],
    ["education", "education_id", "institution, degree", "Reusable education catalog"],
    ["projects", "project_id", "project_code, project_name, description, technologies", "Shared group project"],
    ["certifications", "certification_id", "certification_name, issuer", "Reusable certification catalog"],
    ["experience", "experience_id", "organization", "Reusable organization record"],
    ["student_skills", "student_id + skill_id", "proficiency_level, years_experience, last_used_year", "Student-skill bridge"],
    ["internship_skills", "internship_id + skill_id", "is_mandatory, minimum_proficiency, required_years", "Internship-skill bridge"],
    ["student_education", "student_id + education_id", "gpa, study_year, graduation_year, is_current", "Student education bridge"],
    ["student_projects", "student_id + project_id", "project_role", "Student project bridge"],
    ["student_certifications", "student_id + certification_id", "issue_date", "Student certification bridge"],
    ["student_experience", "student_id + experience_id", "position_title, role, duration_months", "Student experience bridge"],
    ["applications", "application_id", "student_id, internship_id, application_date, status, match_score", "Application transaction"]
]
add_table(doc, ["Table", "Primary key", "Important attributes", "Purpose"], entities, [1.35, 1.55, 2.45, 1.45], 7.5)

doc.add_heading("8 Relational Schema Mapping", 1)
doc.add_paragraph("The conceptual entities are mapped to relations by assigning a primary key to every strong entity and carrying the parent key into dependent relations as a foreign key. Many-to-many relationships are converted into associative relations with composite primary keys. Student-specific attributes such as GPA, project role, issue date and experience position are stored in the associative relations because those values vary by student.")
if SCHEMA_MAPPING_IMAGE.exists():
    doc.add_picture(str(SCHEMA_MAPPING_IMAGE), width=Inches(6.85))
    caption(doc, "Figure 2. Relational schema mapping with connectors terminating at the exact primary-key and foreign-key cells.")
mapping = [
    ["User - Student", "users(user_id) to students(user_id)", "1:1; students.user_id is UNIQUE and FK"],
    ["User - Company", "users(user_id) to companies(user_id)", "1:1; companies.user_id is UNIQUE and FK"],
    ["Student - Skill", "student_skills(student_id, skill_id)", "M:N bridge with proficiency data"],
    ["Internship - Skill", "internship_skills(internship_id, skill_id)", "M:N bridge with requirement data"],
    ["Student - Education", "student_education(student_id, education_id)", "M:N bridge with GPA and current flag"],
    ["Student - Project", "student_projects(student_id, project_id)", "M:N bridge with project_role"],
    ["Student - Certification", "student_certifications(student_id, certification_id)", "M:N bridge with issue_date"],
    ["Student - Experience", "student_experience(student_id, experience_id)", "M:N bridge with position and role"],
    ["Student - Internship", "applications(student_id, internship_id)", "M:N transaction with unique application pair"]
]
add_table(doc, ["Conceptual relationship", "Relational mapping", "Implementation detail"], mapping, [1.65, 2.7, 2.45], 8)

doc.add_heading("9 Functional Dependencies", 1)
doc.add_paragraph("Functional dependencies describe which attributes determine other attributes. They support the normalization analysis and explain why catalog data is separated from student-specific relationship data.")
fds = [
    ["users", "user_id -> email, password_hash, role; email -> user_id, password_hash, role"],
    ["students", "student_id -> user_id, first_name, last_name; user_id -> student_id, first_name, last_name"],
    ["companies", "company_id -> user_id, company_name, description; user_id -> company_id, company_name, description"],
    ["education", "education_id -> institution, degree; (institution, degree) -> education_id"],
    ["skills", "skill_id -> skill_name, category, description; skill_name -> skill_id, category, description"],
    ["projects", "project_id -> project_code, project_name, description, technologies; project_code -> project_id, project_name, description, technologies"],
    ["certifications", "certification_id -> certification_name, issuer; (certification_name, issuer) -> certification_id"],
    ["experience", "experience_id -> organization; organization -> experience_id"],
    ["student_skills", "(student_id, skill_id) -> proficiency_level, years_experience, last_used_year"],
    ["internship_skills", "(internship_id, skill_id) -> is_mandatory, minimum_proficiency, required_years"],
    ["student_education", "(student_id, education_id) -> gpa, study_year, graduation_year, is_current"],
    ["student_projects", "(student_id, project_id) -> project_role"],
    ["student_certifications", "(student_id, certification_id) -> issue_date"],
    ["student_experience", "(student_id, experience_id) -> position_title, role, duration_months"],
    ["applications", "application_id -> student_id, internship_id, application_date, status, match_score; (student_id, internship_id) -> application details"]
]
add_table(doc, ["Relation", "Functional dependencies"], fds, [1.6, 5.2], 7.8)

doc.add_heading("10 Normalization", 1)
doc.add_heading("10.1 Unnormalized form", 2)
doc.add_paragraph("A single recruitment record could contain repeated skills, education, projects, certifications, experience and applications. These repeating groups cause duplication and update anomalies.")
doc.add_heading("10.2 First normal form", 2)
doc.add_paragraph("All fields are atomic, and repeating groups are moved into separate relations. No skills, education, projects, certifications, experience or applications are stored as lists.")
doc.add_heading("10.3 Second normal form", 2)
doc.add_paragraph("Attributes depending on only part of a composite key are moved to their entity relations. Relationship-specific attributes remain in bridge tables and depend on the complete composite key.")
doc.add_heading("10.4 Third normal form", 2)
doc.add_paragraph("Transitive dependencies are removed by separating accounts, profiles, internships and reusable catalog records. The final relations keep non-key attributes dependent only on their relation's key.")
doc.add_heading("10.5 Detailed normalization decomposition", 2)
doc.add_paragraph("The following tables show the main decomposition and dependency checks.")
doc.add_heading("From an unnormalized relation to 1NF", 3)
doc.add_paragraph("A possible unnormalized relation could be written as StudentProfile(StudentID, StudentName, Email, EducationList, SkillList, ProjectList, CertificationList, ExperienceList, ApplicationList). The list attributes contain repeating groups, so a student with several skills or applications would require multiple values inside one field. This creates update and deletion anomalies.")
doc.add_paragraph("To reach 1NF, all repeating groups are made atomic and stored as separate rows. Student details move to students, account details move to users, and each relationship list becomes a separate bridge or transaction relation. No relation stores a comma-separated list of skills, projects, certifications, experiences or applications.")
add_table(doc, ["1NF relation", "Atomic attributes"], [
    ["users", "user_id, email, password_hash, role"],
    ["students", "student_id, user_id, first_name, last_name"],
    ["companies", "company_id, user_id, company_name, description"],
    ["student_skills", "student_id, skill_id, proficiency_level, years_experience, last_used_year"],
    ["student_education", "student_id, education_id, gpa, study_year, graduation_year, is_current"],
    ["applications", "application_id, student_id, internship_id, application_date, status, match_score"]
], [1.7, 5.1], 8)
doc.add_heading("From 1NF to 2NF", 3)
doc.add_paragraph("Partial dependencies are removed from composite-key bridge relations by moving shared entity attributes to their own tables.")
add_table(doc, ["Partial dependency found", "Decomposition", "Result"], [
    ["student_id -> first_name, last_name", "Move student attributes from a combined profile relation to students.", "students(student_id, user_id, first_name, last_name)"],
    ["skill_id -> skill_name, category, description", "Move shared skill details to skills.", "skills(skill_id, skill_name, category, description)"],
    ["education_id -> institution, degree", "Move shared education details to education.", "education(education_id, institution, degree)"],
    ["project_id -> project_code, project_name, description, technologies", "Move shared project details to projects.", "projects(project_id, project_code, project_name, description, technologies)"],
    ["certification_id -> certification_name, issuer", "Move shared certification details to certifications.", "certifications(certification_id, certification_name, issuer)"],
    ["experience_id -> organization", "Move shared organization details to experience.", "experience(experience_id, organization)"],
    ["internship_id -> title, company_id, min_gpa, min_study_year", "Move internship details to internships.", "internships(internship_id, company_id, title, min_gpa, min_study_year)"]
], [2.0, 3.2, 1.6], 7.5)
doc.add_paragraph("Relationship-specific attributes now depend on the complete composite key. For example, (student_id, skill_id) determines proficiency_level and years_experience.")
add_table(doc, ["Fully dependent relation", "Functional dependency"], [
    ["student_skills", "(student_id, skill_id) -> proficiency_level, years_experience, last_used_year"],
    ["internship_skills", "(internship_id, skill_id) -> is_mandatory, minimum_proficiency, required_years"],
    ["student_education", "(student_id, education_id) -> gpa, study_year, graduation_year, is_current"],
    ["student_projects", "(student_id, project_id) -> project_role"],
    ["student_certifications", "(student_id, certification_id) -> issue_date"],
    ["student_experience", "(student_id, experience_id) -> position_title, role, duration_months"]
], [1.7, 5.1], 8)
doc.add_heading("From 2NF to 3NF", 3)
doc.add_paragraph("The final check removes dependencies between non-key attributes by keeping each subject in its own relation.")
add_table(doc, ["Transitive dependency risk", "3NF solution"], [
    ["user_id -> role -> profile type", "Keep role in users and keep student or company attributes in their subtype table."],
    ["company_id -> company_name -> internship description", "Keep company_name in companies and internship attributes in internships."],
    ["skill_id -> skill_name -> skill category", "Keep all shared skill catalog attributes in skills."],
    ["education_id -> institution -> degree", "Keep the institution and degree pair together in education."],
    ["experience_id -> organization -> student position", "Keep organization in experience and position_title, role and duration in student_experience."],
    ["student_id, internship_id -> application details", "Keep application-specific values in applications and enforce the unique student-internship pair."]
], [2.5, 4.3], 7.8)
doc.add_paragraph("Therefore, the final schema is in 3NF. Unique constraints also prevent duplicate education, certification and application records.")

doc.add_heading("11 Matching and Business SQL", 1)
doc.add_paragraph("The matching query generates every student-internship pair, joins each pair to the internship requirements and the student profile, counts satisfied and failed mandatory skills, and calculates the score. Skills contribute 60 points, GPA contributes 20 points and study year contributes 20 points. A failed mandatory skill sets only the skill component to zero. GPA and study year components are independently set to zero when their minimum is not met.")
code_block(doc, "Skill points = (satisfied skills / total required skills) * 60\nGPA points = (GPA / 4.00) * 20 when GPA >= minimum GPA\nStudy-year points = (study year / 4.00) * 20 when study year >= minimum study year\nMatch score = skill points + GPA points + study-year points")
doc.add_paragraph("The three main business queries are stored in database/03_business_queries.sql. They answer the best qualified students per internship, missing mandatory skills for a selected pair, and match scores for all student-internship pairs.")

doc.add_heading("12 DDL Implementation", 1)
doc.add_paragraph("The DDL is stored in database/01_create_schema.sql. It creates the smartintern_db database and the tables in parent-to-child order. Primary keys identify records, unique constraints prevent duplicate catalog values, foreign keys enforce relationships, CHECK constraints validate ranges and ON DELETE rules protect important records.")
ddl = (ROOT / "database/01_create_schema.sql").read_text(encoding="utf-8")
code_block(doc, ddl)
doc.add_paragraph("The complete DDL file should be submitted with the report as part of the project source. The excerpt above shows the implemented schema structure; the full file remains the executable source of truth.")

doc.add_heading("13 DML and Sample Data", 1)
doc.add_paragraph("The DML is stored in database/02_sample_data.sql. It inserts fabricated users, student and company profiles, skills, education, projects, certifications, experience, internships, bridge-table records and applications. The sample records are designed to demonstrate qualified and not-fully-qualified matching outcomes without using real personal data.")
dml = (ROOT / "database/02_sample_data.sql").read_text(encoding="utf-8")
code_block(doc, dml)
doc.add_paragraph("The optional database/migrations/08_seed_demo_opportunities.sql file adds additional local internship opportunities for application demonstration. It should be run only after the base schema and sample data when the larger demonstration dataset is required.")

doc.add_heading("14 Technology Stack", 1)
add_table(doc, ["Technology", "Use in SmartIntern"], [
    ["MySQL Community Server", "Relational database engine for persistent data, constraints and SQL queries."],
    ["MySQL Workbench", "Schema execution, table inspection, query execution and database demonstrations."],
    ["Node.js and Express", "Backend server, REST endpoints, sessions, role checks and database access."],
    ["HTML, CSS and JavaScript", "Browser interface for student and company workflows."],
    ["GitHub", "Version control and collaboration among team members."],
    ["Localhost", "Zero-cost environment for the term-project demonstration."]
], [1.8, 5.0], 9)

doc.add_heading("15 User Interface Evidence", 1)
doc.add_paragraph("The application provides the live demonstration layer for the database project. The screenshots below show database-backed workflows. They should be replaced or supplemented with final screenshots captured from the team’s latest build before submission.")
screens = [
    ("backend/docs/handoff/frontend-handoff-accepted.png", "Figure 3. Student application and accepted-status workflow."),
    ("backend/docs/handoff/student-accepted.png", "Figure 4. Student view showing an accepted application."),
    ("backend/docs/handoff/student-rejected.png", "Figure 5. Student view showing a rejected application."),
    ("backend/docs/handoff/company-reports.png", "Figure 6. Company reporting and applicant analysis view.")
]
for rel, text in screens:
    path = ROOT / rel
    if path.exists():
        doc.add_picture(str(path), width=Inches(5.8))
        caption(doc, text)

doc.add_heading("16 Milestones", 1)
add_table(doc, ["Milestone", "Deliverable", "Owner"], [
    ["M1 Proposal and requirements", "Approved project scope, business rules and database requirements.", "All members"],
    ["M2 EER and relational design", "Updated EER diagram, entity descriptions and relational schema mapping.", "Ye Lin Aung and Win Khant Ko Ko"],
    ["M3 Normalization and SQL design", "Functional dependencies, 1NF to 3NF analysis, DDL and FK review.", "Hein Htet Aung and Win Khant Ko Ko"],
    ["M4 SQL implementation", "MySQL schema, sample data and business queries.", "Hein Htet Aung and Win Khant Ko Ko"],
    ["M5 Application integration", "Backend endpoints, frontend workflows and database-backed matching.", "All members"],
    ["M6 Presentation and report", "Final documentation, UI screenshots, SQL evidence and recorded demonstration.", "All members"]
], [1.55, 4.2, 1.05], 8.5)

doc.add_heading("17 Conclusion", 1)
doc.add_paragraph("SmartIntern demonstrates how a normalized MySQL database can support a complete internship matching workflow. The design separates account, profile, catalog, bridge and transaction data; enforces relationships with primary and foreign keys; prevents important duplicates; and produces transparent match scores using stored requirements and current education information. The web application provides a practical interface for testing the database rules and showing how changes made through the UI are reflected in reports and application records.")

doc.add_heading("Appendix A SQL File Map", 1)
add_table(doc, ["File", "Purpose"], [
    ["database/01_create_schema.sql", "Fresh database creation and DDL."],
    ["database/02_sample_data.sql", "Fabricated DML records for demonstration."],
    ["database/03_business_queries.sql", "Business questions and matching reports."],
    ["database/migrations/04_update_demo_passwords.sql", "Optional migration for older demo accounts."],
    ["database/migrations/05_update_experience_structure.sql", "Optional migration for older experience structure."],
    ["database/migrations/06_update_project_codes.sql", "Optional migration for older project records."],
    ["database/migrations/07_add_catalog_uniqueness.sql", "Optional catalog uniqueness migration."],
    ["database/migrations/08_seed_demo_opportunities.sql", "Optional larger demonstration dataset."]
], [3.1, 3.7], 8.5)

doc.add_heading("Appendix B Evidence Checklist", 1)
for item in [
    "Fresh schema executes successfully in MySQL Workbench.",
    "Sample data loads successfully after the schema.",
    "Business queries return match scores and qualification outcomes.",
    "Student and Company role boundaries work through the UI.",
    "A student can add or select reusable catalog records.",
    "A company can create internships and skill requirements.",
    "Applications are unique per student and internship.",
    "Final ERD image matches the current database schema.",
    "Final UI screenshots are captured from the latest team build."
]:
    doc.add_paragraph(item, style="List Bullet")

doc.core_properties.title = "SmartIntern Project Report"
doc.core_properties.subject = "Database system architecture, design and implementation report"
doc.core_properties.author = "NEXORA"
doc.save(OUT)
print(OUT)

