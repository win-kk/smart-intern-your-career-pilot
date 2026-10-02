USE smartintern_db;

-- Prevent duplicate shared catalog records while keeping student-specific
-- details in the student relationship tables.
ALTER TABLE education
    ADD UNIQUE KEY uq_education_institution_degree (institution, degree);

ALTER TABLE certifications
    ADD UNIQUE KEY uq_certification_name_issuer (certification_name, issuer);
