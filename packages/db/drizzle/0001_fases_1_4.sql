CREATE TYPE "public"."session_status" AS ENUM('active', 'completed', 'discarded');--> statement-breakpoint
CREATE TABLE "exercise_tip" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"exercise_id" text NOT NULL,
	"text" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "food_favorite" (
	"user_id" text NOT NULL,
	"food_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "food_favorite_user_id_food_id_pk" PRIMARY KEY("user_id","food_id")
);
--> statement-breakpoint
CREATE TABLE "saved_meal" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"encrypted" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"message" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "stored_file" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stored_file_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "answers" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "onboarding_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "health_flags" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "nutrition_prefs" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "nutrition_limits" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "photos_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "screening" ADD COLUMN "reasons" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise" ADD COLUMN "video_id" text;--> statement-breakpoint
ALTER TABLE "exercise" ADD COLUMN "search_text" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "routine" ADD COLUMN "started_on" date;--> statement-breakpoint
ALTER TABLE "routine" ADD COLUMN "block_weeks" integer DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE "routine" ADD COLUMN "deload_every_weeks" integer DEFAULT 6 NOT NULL;--> statement-breakpoint
ALTER TABLE "session_exercise" ADD COLUMN "user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "session_exercise" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "session_exercise" ADD COLUMN "client_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "set_log" ADD COLUMN "target" jsonb;--> statement-breakpoint
ALTER TABLE "set_log" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "set_log" ADD COLUMN "pain" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "set_log" ADD COLUMN "client_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workout_session" ADD COLUMN "gym_profile_id" text;--> statement-breakpoint
ALTER TABLE "workout_session" ADD COLUMN "status" "session_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_session" ADD COLUMN "paused_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workout_session" ADD COLUMN "summary" jsonb;--> statement-breakpoint
ALTER TABLE "workout_session" ADD COLUMN "client_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "body_measurement" ADD COLUMN "approximate" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "body_measurement" ADD COLUMN "raw" jsonb;--> statement-breakpoint
ALTER TABLE "body_photo" ADD COLUMN "storage_driver" text DEFAULT 'db' NOT NULL;--> statement-breakpoint
ALTER TABLE "body_photo" ADD COLUMN "content_type" text DEFAULT 'image/jpeg' NOT NULL;--> statement-breakpoint
ALTER TABLE "body_photo" ADD COLUMN "size_bytes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "checkin" ADD COLUMN "metrics" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "checkin" ADD COLUMN "dismissed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "food" ADD COLUMN "group_code" text;--> statement-breakpoint
ALTER TABLE "food" ADD COLUMN "search_text" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "food" ADD COLUMN "name_reviewed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "meal_plan" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "meal_plan" ADD COLUMN "target_id" text;--> statement-breakpoint
ALTER TABLE "exercise_tip" ADD CONSTRAINT "exercise_tip_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_tip" ADD CONSTRAINT "exercise_tip_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_favorite" ADD CONSTRAINT "food_favorite_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_favorite" ADD CONSTRAINT "food_favorite_food_id_food_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_meal" ADD CONSTRAINT "saved_meal_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job" ADD CONSTRAINT "job_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stored_file" ADD CONSTRAINT "stored_file_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "exercise_tip_user_exercise_idx" ON "exercise_tip" USING btree ("user_id","exercise_id");--> statement-breakpoint
CREATE INDEX "job_type_started_idx" ON "job" USING btree ("type","created_at");--> statement-breakpoint
CREATE INDEX "stored_file_user_idx" ON "stored_file" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "session_exercise" ADD CONSTRAINT "session_exercise_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_session" ADD CONSTRAINT "workout_session_gym_profile_id_gym_profile_id_fk" FOREIGN KEY ("gym_profile_id") REFERENCES "public"."gym_profile"("id") ON DELETE set null ON UPDATE no action;