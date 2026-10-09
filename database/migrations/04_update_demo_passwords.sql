USE smartintern_db;

-- Local presentation credentials only.
-- Student password: student123
-- Company password: company123

UPDATE users
SET password_hash = '$2a$12$tWnymM1EprRp4p6R0mhk.e3GMFUOMlpQKGSG0J0cz0kpuHzN9jMe.'
WHERE role = 'Student';

UPDATE users
SET password_hash = '$2a$12$1fRSV5YhK9t1//./SzfgfetQ0AQ5iXeSg15nGmhCtGn.0jU3.jwgW'
WHERE role = 'Company';
