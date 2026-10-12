USE smartintern_db;

-- Add enough local demo listings to exercise the multi-company discovery page.
-- This script is safe to rerun: users, company profiles, internships, and skill
-- requirements are looked up by their existing unique identifiers/names.

INSERT IGNORE INTO users (email, password_hash, role) VALUES
('careers@brightpath.example', '$2a$12$1fRSV5YhK9t1//./SzfgfetQ0AQ5iXeSg15nGmhCtGn.0jU3.jwgW', 'Company'),
('talent@northstar.example', '$2a$12$1fRSV5YhK9t1//./SzfgfetQ0AQ5iXeSg15nGmhCtGn.0jU3.jwgW', 'Company'),
('people@greengrid.example', '$2a$12$1fRSV5YhK9t1//./SzfgfetQ0AQ5iXeSg15nGmhCtGn.0jU3.jwgW', 'Company'),
('studio@pixelworks.example', '$2a$12$1fRSV5YhK9t1//./SzfgfetQ0AQ5iXeSg15nGmhCtGn.0jU3.jwgW', 'Company'),
('jobs@cloudbridge.example', '$2a$12$1fRSV5YhK9t1//./SzfgfetQ0AQ5iXeSg15nGmhCtGn.0jU3.jwgW', 'Company'),
('careers@medtechconnect.example', '$2a$12$1fRSV5YhK9t1//./SzfgfetQ0AQ5iXeSg15nGmhCtGn.0jU3.jwgW', 'Company'),
('talent@citylink.example', '$2a$12$1fRSV5YhK9t1//./SzfgfetQ0AQ5iXeSg15nGmhCtGn.0jU3.jwgW', 'Company'),
('community@communitytech.example', '$2a$12$1fRSV5YhK9t1//./SzfgfetQ0AQ5iXeSg15nGmhCtGn.0jU3.jwgW', 'Company');

INSERT IGNORE INTO companies (user_id, company_name, description)
SELECT u.user_id, demo.company_name, demo.description
FROM users AS u
JOIN (
    SELECT 'careers@brightpath.example' AS email, 'BrightPath Digital' AS company_name, 'A digital product studio building accessible web experiences.' AS description
    UNION ALL SELECT 'talent@northstar.example', 'Northstar Finance', 'A financial services team using data to improve customer decisions.'
    UNION ALL SELECT 'people@greengrid.example', 'GreenGrid Energy', 'An energy company investing in cleaner infrastructure and analytics.'
    UNION ALL SELECT 'studio@pixelworks.example', 'PixelWorks Studio', 'A creative studio delivering web design and interactive products.'
    UNION ALL SELECT 'jobs@cloudbridge.example', 'CloudBridge Labs', 'A cloud engineering and infrastructure services company.'
    UNION ALL SELECT 'careers@medtechconnect.example', 'MedTech Connect', 'A health technology company supporting secure digital care.'
    UNION ALL SELECT 'talent@citylink.example', 'CityLink Mobility', 'A mobility technology company improving urban transportation.'
    UNION ALL SELECT 'community@communitytech.example', 'Community Technology Group', 'A community-focused organization building useful digital services.'
) AS demo ON demo.email = u.email
WHERE u.role = 'Company';

INSERT INTO internships (company_id, title, min_gpa, min_study_year)
SELECT c.company_id, demo.title, demo.min_gpa, demo.min_study_year
FROM (
    SELECT 'BrightPath Digital' AS company_name, 'Frontend Developer Intern' AS title, 3.00 AS min_gpa, 2 AS min_study_year
    UNION ALL SELECT 'BrightPath Digital', 'QA Automation Intern', 2.80, 2
    UNION ALL SELECT 'Northstar Finance', 'Financial Data Analyst Intern', 3.20, 3
    UNION ALL SELECT 'Northstar Finance', 'Database Reporting Intern', 3.00, 2
    UNION ALL SELECT 'GreenGrid Energy', 'Sustainability Data Intern', 3.00, 2
    UNION ALL SELECT 'GreenGrid Energy', 'Systems Support Intern', 2.80, 2
    UNION ALL SELECT 'PixelWorks Studio', 'Web Design Intern', 2.80, 1
    UNION ALL SELECT 'PixelWorks Studio', 'Creative Coding Intern', 3.00, 2
    UNION ALL SELECT 'CloudBridge Labs', 'Cloud Support Intern', 3.00, 2
    UNION ALL SELECT 'CloudBridge Labs', 'DevOps Intern', 3.30, 3
    UNION ALL SELECT 'MedTech Connect', 'Health Data Intern', 3.10, 2
    UNION ALL SELECT 'MedTech Connect', 'Application Support Intern', 2.80, 2
    UNION ALL SELECT 'CityLink Mobility', 'Product Data Intern', 3.00, 2
    UNION ALL SELECT 'CityLink Mobility', 'Mobile Web Intern', 3.10, 2
    UNION ALL SELECT 'Community Technology Group', 'IT Support Intern', 2.70, 1
    UNION ALL SELECT 'Community Technology Group', 'Website Content Intern', 2.70, 1
    UNION ALL SELECT 'Community Technology Group', 'Junior Data Assistant Intern', 2.80, 1
) AS demo
JOIN companies AS c ON c.company_name = demo.company_name
WHERE NOT EXISTS (
    SELECT 1 FROM internships AS existing
    WHERE existing.company_id = c.company_id AND existing.title = demo.title
);

INSERT IGNORE INTO internship_skills
    (internship_id, skill_id, is_mandatory, minimum_proficiency, required_years)
SELECT i.internship_id, s.skill_id, demo.is_mandatory, demo.minimum_proficiency, demo.required_years
FROM (
    SELECT 'BrightPath Digital' AS company_name, 'Frontend Developer Intern' AS title, 'JavaScript' AS skill_name, TRUE AS is_mandatory, 2 AS minimum_proficiency, 0.0 AS required_years
    UNION ALL SELECT 'BrightPath Digital', 'Frontend Developer Intern', 'HTML/CSS', FALSE, 2, 0.0
    UNION ALL SELECT 'BrightPath Digital', 'QA Automation Intern', 'Python', TRUE, 2, 0.0
    UNION ALL SELECT 'BrightPath Digital', 'QA Automation Intern', 'Git', FALSE, 2, 0.0
    UNION ALL SELECT 'Northstar Finance', 'Financial Data Analyst Intern', 'Data Analysis', TRUE, 3, 0.5
    UNION ALL SELECT 'Northstar Finance', 'Financial Data Analyst Intern', 'SQL', TRUE, 2, 0.0
    UNION ALL SELECT 'Northstar Finance', 'Database Reporting Intern', 'SQL', TRUE, 2, 0.0
    UNION ALL SELECT 'Northstar Finance', 'Database Reporting Intern', 'Data Analysis', FALSE, 2, 0.0
    UNION ALL SELECT 'GreenGrid Energy', 'Sustainability Data Intern', 'Python', TRUE, 2, 0.0
    UNION ALL SELECT 'GreenGrid Energy', 'Sustainability Data Intern', 'Data Analysis', FALSE, 2, 0.0
    UNION ALL SELECT 'GreenGrid Energy', 'Systems Support Intern', 'SQL', TRUE, 2, 0.0
    UNION ALL SELECT 'GreenGrid Energy', 'Systems Support Intern', 'JavaScript', FALSE, 2, 0.0
    UNION ALL SELECT 'PixelWorks Studio', 'Web Design Intern', 'HTML/CSS', TRUE, 2, 0.0
    UNION ALL SELECT 'PixelWorks Studio', 'Web Design Intern', 'JavaScript', TRUE, 2, 0.0
    UNION ALL SELECT 'PixelWorks Studio', 'Creative Coding Intern', 'JavaScript', TRUE, 2, 0.0
    UNION ALL SELECT 'PixelWorks Studio', 'Creative Coding Intern', 'Git', FALSE, 2, 0.0
    UNION ALL SELECT 'CloudBridge Labs', 'Cloud Support Intern', 'Python', TRUE, 2, 0.0
    UNION ALL SELECT 'CloudBridge Labs', 'Cloud Support Intern', 'SQL', FALSE, 2, 0.0
    UNION ALL SELECT 'CloudBridge Labs', 'DevOps Intern', 'Git', TRUE, 3, 0.5
    UNION ALL SELECT 'CloudBridge Labs', 'DevOps Intern', 'Python', TRUE, 2, 0.0
    UNION ALL SELECT 'MedTech Connect', 'Health Data Intern', 'Data Analysis', TRUE, 2, 0.0
    UNION ALL SELECT 'MedTech Connect', 'Health Data Intern', 'Python', FALSE, 2, 0.0
    UNION ALL SELECT 'MedTech Connect', 'Application Support Intern', 'JavaScript', TRUE, 2, 0.0
    UNION ALL SELECT 'MedTech Connect', 'Application Support Intern', 'SQL', FALSE, 2, 0.0
    UNION ALL SELECT 'CityLink Mobility', 'Product Data Intern', 'Data Analysis', TRUE, 2, 0.0
    UNION ALL SELECT 'CityLink Mobility', 'Product Data Intern', 'SQL', FALSE, 2, 0.0
    UNION ALL SELECT 'CityLink Mobility', 'Mobile Web Intern', 'JavaScript', TRUE, 2, 0.0
    UNION ALL SELECT 'CityLink Mobility', 'Mobile Web Intern', 'HTML/CSS', FALSE, 2, 0.0
    UNION ALL SELECT 'Community Technology Group', 'IT Support Intern', 'SQL', TRUE, 2, 0.0
    UNION ALL SELECT 'Community Technology Group', 'IT Support Intern', 'Git', FALSE, 1, 0.0
    UNION ALL SELECT 'Community Technology Group', 'Website Content Intern', 'HTML/CSS', TRUE, 2, 0.0
    UNION ALL SELECT 'Community Technology Group', 'Website Content Intern', 'JavaScript', FALSE, 1, 0.0
    UNION ALL SELECT 'Community Technology Group', 'Junior Data Assistant Intern', 'Data Analysis', TRUE, 2, 0.0
    UNION ALL SELECT 'Community Technology Group', 'Junior Data Assistant Intern', 'SQL', FALSE, 1, 0.0
) AS demo
JOIN companies AS c ON c.company_name = demo.company_name
JOIN internships AS i ON i.company_id = c.company_id AND i.title = demo.title
JOIN skills AS s ON s.skill_name = demo.skill_name;
