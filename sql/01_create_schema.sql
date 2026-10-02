CREATE DATABASE IF NOT EXISTS smartintern_db;
USE smartintern_db;

CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('Student', 'Company') NOT NULL
);

CREATE TABLE students (
    student_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    CONSTRAINT fk_students_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE companies (
    company_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    company_name VARCHAR(255) NOT NULL,
    description TEXT,
    CONSTRAINT fk_companies_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE skills (
    skill_id INT AUTO_INCREMENT PRIMARY KEY,
    skill_name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(100),
    description TEXT
);

CREATE TABLE education (
    education_id INT AUTO_INCREMENT PRIMARY KEY,
    institution VARCHAR(255) NOT NULL,
    degree VARCHAR(255) NOT NULL,
    UNIQUE KEY uq_education_institution_degree (institution, degree)
);

CREATE TABLE projects (
    project_id INT AUTO_INCREMENT PRIMARY KEY,
    project_code VARCHAR(30) NOT NULL UNIQUE,
    project_name VARCHAR(255) NOT NULL,
    description TEXT,
    technologies TEXT
);

CREATE TABLE certifications (
    certification_id INT AUTO_INCREMENT PRIMARY KEY,
    certification_name VARCHAR(255) NOT NULL,
    issuer VARCHAR(255) NOT NULL,
    UNIQUE KEY uq_certification_name_issuer (certification_name, issuer)
);

CREATE TABLE experience (
    experience_id INT AUTO_INCREMENT PRIMARY KEY,
    organization VARCHAR(255) NOT NULL,
    UNIQUE KEY uq_experience_organization (organization)
);

CREATE TABLE internships (
    internship_id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    min_gpa DECIMAL(3,2) NOT NULL,
    min_study_year TINYINT UNSIGNED NOT NULL,
    CONSTRAINT chk_internships_min_gpa
        CHECK (min_gpa BETWEEN 0.00 AND 4.00),
    CONSTRAINT chk_internships_min_study_year
        CHECK (min_study_year >= 1),
    CONSTRAINT fk_internships_company
        FOREIGN KEY (company_id) REFERENCES companies(company_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE student_skills (
    student_id INT NOT NULL,
    skill_id INT NOT NULL,
    proficiency_level TINYINT UNSIGNED NOT NULL,
    years_experience DECIMAL(4,1) NOT NULL,
    last_used_year YEAR,
    PRIMARY KEY (student_id, skill_id),
    CONSTRAINT chk_student_skills_proficiency
        CHECK (proficiency_level BETWEEN 1 AND 5),
    CONSTRAINT chk_student_skills_years
        CHECK (years_experience >= 0),
    CONSTRAINT fk_student_skills_student
        FOREIGN KEY (student_id) REFERENCES students(student_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_student_skills_skill
        FOREIGN KEY (skill_id) REFERENCES skills(skill_id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE internship_skills (
    internship_id INT NOT NULL,
    skill_id INT NOT NULL,
    is_mandatory BOOLEAN NOT NULL DEFAULT FALSE,
    minimum_proficiency TINYINT UNSIGNED NOT NULL,
    required_years DECIMAL(4,1) NOT NULL,
    PRIMARY KEY (internship_id, skill_id),
    CONSTRAINT chk_internship_skills_proficiency
        CHECK (minimum_proficiency BETWEEN 1 AND 5),
    CONSTRAINT chk_internship_skills_years
        CHECK (required_years >= 0),
    CONSTRAINT fk_internship_skills_internship
        FOREIGN KEY (internship_id) REFERENCES internships(internship_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_internship_skills_skill
        FOREIGN KEY (skill_id) REFERENCES skills(skill_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE student_education (
    student_id INT NOT NULL,
    education_id INT NOT NULL,
    gpa DECIMAL(3,2) NOT NULL,
    study_year TINYINT UNSIGNED NOT NULL,
    graduation_year YEAR,
    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (student_id, education_id),
    CONSTRAINT chk_student_education_gpa
        CHECK (gpa BETWEEN 0.00 AND 4.00),
    CONSTRAINT chk_student_education_study_year
        CHECK (study_year >= 1),
    CONSTRAINT fk_student_education_student
        FOREIGN KEY (student_id) REFERENCES students(student_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_student_education_education
        FOREIGN KEY (education_id) REFERENCES education(education_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE student_projects (
    student_id INT NOT NULL,
    project_id INT NOT NULL,
    project_role VARCHAR(255) NOT NULL,
    PRIMARY KEY (student_id, project_id),
    CONSTRAINT fk_student_projects_student
        FOREIGN KEY (student_id) REFERENCES students(student_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_student_projects_project
        FOREIGN KEY (project_id) REFERENCES projects(project_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE student_certifications (
    student_id INT NOT NULL,
    certification_id INT NOT NULL,
    issue_date DATE NOT NULL,
    PRIMARY KEY (student_id, certification_id),
    CONSTRAINT fk_student_certifications_student
        FOREIGN KEY (student_id) REFERENCES students(student_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_student_certifications_certification
        FOREIGN KEY (certification_id) REFERENCES certifications(certification_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE student_experience (
    student_id INT NOT NULL,
    experience_id INT NOT NULL,
    position_title VARCHAR(255) NOT NULL,
    role VARCHAR(255) NOT NULL,
    duration_months INT UNSIGNED NOT NULL,
    PRIMARY KEY (student_id, experience_id),
    CONSTRAINT fk_student_experience_student
        FOREIGN KEY (student_id) REFERENCES students(student_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_student_experience_experience
        FOREIGN KEY (experience_id) REFERENCES experience(experience_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE applications (
    application_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    internship_id INT NOT NULL,
    application_date DATE NOT NULL,
    status ENUM('Pending', 'Under Review', 'Accepted', 'Rejected') NOT NULL,
    match_score DECIMAL(5,2) NOT NULL,
    UNIQUE KEY uq_application_student_internship (student_id, internship_id),
    CONSTRAINT chk_applications_match_score
        CHECK (match_score BETWEEN 0.00 AND 100.00),
    CONSTRAINT fk_applications_student
        FOREIGN KEY (student_id) REFERENCES students(student_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_applications_internship
        FOREIGN KEY (internship_id) REFERENCES internships(internship_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
);
