CREATE TABLE "kv" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"competition" text NOT NULL,
	"round" text,
	"starts_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"home_score" integer,
	"away_score" integer,
	"home_penalties" integer,
	"away_penalties" integer,
	"our_side" text NOT NULL,
	"rival_name" text NOT NULL,
	"raw" jsonb NOT NULL,
	"synced_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"match_id" text NOT NULL,
	"key" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_match_id_key_pk" PRIMARY KEY("match_id","key")
);
--> statement-breakpoint
CREATE TABLE "subscribers" (
	"chat_id" bigint PRIMARY KEY NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "matches_starts_at_idx" ON "matches" USING btree ("starts_at");