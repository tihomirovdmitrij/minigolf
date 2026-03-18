import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Database = ReturnType<typeof drizzle>;

let dbInstance: Database | null = null;

export function getDb(): Database {
	if (dbInstance) {
		return dbInstance;
	}

	const connectionString = process.env.DATABASE_URL;
	if (!connectionString) {
		throw new Error("DATABASE_URL is required");
	}

	const client = postgres(connectionString, {
		prepare: false,
	});

	dbInstance = drizzle(client, { schema });
	return dbInstance;
}
