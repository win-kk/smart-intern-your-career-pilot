USE smartintern_db;

-- Run only after confirming that no student has more than one current record.
-- The generated column is NULL for non-current records, so the unique key
-- enforces at most one current education record per student.
ALTER TABLE student_education
    ADD COLUMN current_student_id INT GENERATED ALWAYS AS (
        CASE WHEN is_current THEN student_id ELSE NULL END
    ) STORED,
    ADD UNIQUE KEY uq_student_one_current_education (current_student_id);
