CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    login VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password TEXT NOT NULL,
    avatar TEXT DEFAULT NULL,
    provider VARCHAR(50) DEFAULT 'local',
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    refresh_token TEXT,
    CONSTRAINT email_required_for_local CHECK (
        provider <> 'local' OR email IS NOT NULL
    )
);
