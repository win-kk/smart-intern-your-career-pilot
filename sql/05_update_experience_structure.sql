USE smartintern_db;

-- Move the position title from the shared organization record to each student's
-- junction record. This preserves each student's own position and role.
ALTER TABLE student_experience
    ADD COLUMN position_title VARCHAR(255) NULL AFTER experience_id;

UPDATE student_experience AS sx
JOIN experience AS e ON e.experience_id = sx.experience_id
SET sx.position_title = e.position_title;

ALTER TABLE student_experience
    MODIFY position_title VARCHAR(255) NOT NULL;

ALTER TABLE experience
    DROP COLUMN position_title,
    ADD UNIQUE KEY uq_experience_organization (organization);
