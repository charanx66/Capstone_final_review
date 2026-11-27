CREATE TABLE accounts (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, salt TEXT NOT NULL, digest TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE sessions (token TEXT PRIMARY KEY, owner TEXT NOT NULL, expires INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE runs (id TEXT PRIMARY KEY, owner TEXT NOT NULL, created INTEGER NOT NULL, title TEXT NOT NULL, result TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX runs_by_owner ON runs(owner,created DESC);
