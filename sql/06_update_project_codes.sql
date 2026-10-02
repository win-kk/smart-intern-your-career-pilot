USE smartintern_db;

-- Give every shared project a stable code that teammates can use to join it.
ALTER TABLE projects
    ADD COLUMN project_code VARCHAR(30) NULL AFTER project_id;

UPDATE projects
SET project_code = CONCAT('PRJ-', LPAD(project_id, 4, '0'))
WHERE project_code IS NULL;

ALTER TABLE projects
    MODIFY project_code VARCHAR(30) NOT NULL,
    ADD UNIQUE KEY uq_projects_project_code (project_code);
