CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."activity_level" AS ENUM('sedentary', 'light', 'moderate', 'active', 'very_active');--> statement-breakpoint
CREATE TYPE "public"."goal" AS ENUM('hypertrophy', 'strength', 'fat_loss', 'recomposition', 'skills');--> statement-breakpoint
CREATE TYPE "public"."screening_decision" AS ENUM('pending', 'accepted', 'declined');--> statement-breakpoint
CREATE TYPE "public"."sex" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TYPE "public"."equipment_category" AS ENUM('machine', 'free_weight', 'structure', 'space', 'weighted', 'other');--> statement-breakpoint
CREATE TYPE "public"."gym_profile_kind" AS ENUM('gym', 'home', 'park');--> statement-breakpoint
CREATE TYPE "public"."exercise_level" AS ENUM('beginner', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TYPE "public"."load_type" AS ENUM('external', 'bodyweight', 'assisted', 'weighted_bw', 'isometric');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('image', 'video');--> statement-breakpoint
CREATE TYPE "public"."routine_author" AS ENUM('ai', 'user');--> statement-breakpoint
CREATE TYPE "public"."routine_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."pr_type" AS ENUM('max_weight', 'max_reps_at_weight', 'max_e1rm', 'max_volume', 'longest_isometric', 'new_variant');--> statement-breakpoint
CREATE TYPE "public"."body_fat_method" AS ENUM('navy', 'bia', 'inbody', 'dexa', 'photo_estimate', 'manual');--> statement-breakpoint
CREATE TYPE "public"."checkin_mode" AS ENUM('auto', 'weekly', 'biweekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."checkin_type" AS ENUM('light', 'full', 'early');--> statement-breakpoint
CREATE TYPE "public"."photo_pose" AS ENUM('front', 'side', 'back');--> statement-breakpoint
CREATE TYPE "public"."food_source" AS ENUM('usda', 'incmnsz', 'off', 'custom');--> statement-breakpoint
CREATE TYPE "public"."ai_provider" AS ENUM('anthropic', 'openai', 'google', 'openrouter', 'openai_compatible');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"units" text DEFAULT 'metric' NOT NULL,
	"locale" text DEFAULT 'es-MX' NOT NULL,
	"privacy_accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "injury" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"zone" text NOT NULL,
	"movements_to_avoid" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"birth_date" date,
	"sex" "sex",
	"height_cm" double precision,
	"weight_kg" double precision,
	"goal" "goal",
	"skill_goals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"gym_ratio" integer DEFAULT 50 NOT NULL,
	"days_per_week" integer,
	"minutes_per_session" integer,
	"preferred_days" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"training_months" integer,
	"current_level" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sleep_hours" double precision,
	"stress" integer,
	"activity" "activity_level",
	"favorite_exercises" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"banned_exercises" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "screening" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"parq_answers" jsonb NOT NULL,
	"acsm_flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"clearance_recommended" boolean DEFAULT false NOT NULL,
	"intensity_cap" text,
	"user_decision" "screening_decision" DEFAULT 'pending' NOT NULL,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"category" "equipment_category" NOT NULL,
	"name_es" text NOT NULL,
	"name_en" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "equipment_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "gym_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" "gym_profile_kind" DEFAULT 'gym' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gym_profile_equipment" (
	"id" text PRIMARY KEY NOT NULL,
	"gym_profile_id" text NOT NULL,
	"equipment_id" text NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercise" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name_es" text NOT NULL,
	"name_en" text NOT NULL,
	"pattern" text DEFAULT 'isolation' NOT NULL,
	"category" text DEFAULT 'gym' NOT NULL,
	"primary_muscles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"secondary_muscles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"load_type" "load_type" DEFAULT 'external' NOT NULL,
	"level" "exercise_level" DEFAULT 'beginner' NOT NULL,
	"mechanic" text,
	"force" text,
	"description_es" text,
	"description_en" text,
	"instructions_es" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"instructions_en" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cues_es" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"common_errors_es" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source" text NOT NULL,
	"source_id" text,
	"license" text,
	"attribution_url" text,
	"reviewed" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exercise_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "exercise_equipment" (
	"exercise_id" text NOT NULL,
	"equipment_id" text NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	CONSTRAINT "exercise_equipment_exercise_id_equipment_id_pk" PRIMARY KEY("exercise_id","equipment_id")
);
--> statement-breakpoint
CREATE TABLE "exercise_media" (
	"id" text PRIMARY KEY NOT NULL,
	"exercise_id" text NOT NULL,
	"type" "media_type" NOT NULL,
	"role" text DEFAULT 'main' NOT NULL,
	"url" text NOT NULL,
	"storage_key" text,
	"origin_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"source" text NOT NULL,
	"license" text NOT NULL,
	"attribution_url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercise_progression" (
	"id" text PRIMARY KEY NOT NULL,
	"from_exercise_id" text NOT NULL,
	"to_exercise_id" text NOT NULL,
	"threshold" jsonb NOT NULL,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routine" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"gym_profile_id" text,
	"name" text NOT NULL,
	"status" "routine_status" DEFAULT 'draft' NOT NULL,
	"current_version_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routine_day" (
	"id" text PRIMARY KEY NOT NULL,
	"routine_version_id" text NOT NULL,
	"sort_order" integer NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routine_exercise" (
	"id" text PRIMARY KEY NOT NULL,
	"routine_day_id" text NOT NULL,
	"exercise_id" text NOT NULL,
	"sort_order" integer NOT NULL,
	"sets" integer NOT NULL,
	"rep_min" integer,
	"rep_max" integer,
	"target_seconds" integer,
	"rir_target" integer DEFAULT 2 NOT NULL,
	"rest_seconds" integer DEFAULT 90 NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "routine_version" (
	"id" text PRIMARY KEY NOT NULL,
	"routine_id" text NOT NULL,
	"version" integer NOT NULL,
	"author" "routine_author" NOT NULL,
	"rationale" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_record" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"exercise_id" text NOT NULL,
	"type" "pr_type" NOT NULL,
	"value" double precision NOT NULL,
	"set_log_id" text,
	"achieved_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_exercise" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"routine_exercise_id" text,
	"exercise_id" text NOT NULL,
	"sort_order" integer NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"substituted_from_exercise_id" text
);
--> statement-breakpoint
CREATE TABLE "set_log" (
	"id" text PRIMARY KEY NOT NULL,
	"session_exercise_id" text NOT NULL,
	"user_id" text NOT NULL,
	"set_number" integer NOT NULL,
	"weight_kg" double precision,
	"assistance_kg" double precision,
	"added_weight_kg" double precision,
	"reps" integer,
	"seconds" integer,
	"rir" integer,
	"completed_at" timestamp with time zone,
	"rest_actual_seconds" integer,
	"rest_target_seconds" integer,
	"is_record" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"routine_version_id" text,
	"routine_day_id" text,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"paused_ms" integer DEFAULT 0 NOT NULL,
	"effort" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "body_measurement" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"measured_at" date NOT NULL,
	"weight_kg" double precision,
	"neck_cm" double precision,
	"waist_cm" double precision,
	"hip_cm" double precision,
	"arm_cm" double precision,
	"thigh_cm" double precision,
	"body_fat_pct" double precision,
	"body_fat_method" "body_fat_method",
	"lean_mass_kg" double precision,
	"bmr_measured" integer,
	"source" text DEFAULT 'manual' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "body_photo" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"taken_at" timestamp with time zone NOT NULL,
	"pose" "photo_pose" NOT NULL,
	"storage_key" text NOT NULL,
	"landmarks" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkin" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "checkin_type" NOT NULL,
	"trigger" text,
	"scheduled_for" date NOT NULL,
	"completed_at" timestamp with time zone,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ai_summary" text,
	"proposed_changes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"decision" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkin_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"mode" "checkin_mode" DEFAULT 'auto' NOT NULL,
	"next_light_at" date,
	"next_full_at" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checkin_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "food" (
	"id" text PRIMARY KEY NOT NULL,
	"source" "food_source" NOT NULL,
	"source_id" text,
	"name_es" text NOT NULL,
	"name_en" text,
	"brand" text,
	"barcode" text,
	"kcal" double precision NOT NULL,
	"protein_g" double precision NOT NULL,
	"carbs_g" double precision NOT NULL,
	"fat_g" double precision NOT NULL,
	"fiber_g" double precision,
	"portions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"license" text,
	"attribution_url" text,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"meal" text NOT NULL,
	"food_id" text NOT NULL,
	"grams" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_plan" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"week_start" date NOT NULL,
	"plan" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nutrition_target" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"effective_from" date NOT NULL,
	"kcal" integer NOT NULL,
	"protein_g" integer NOT NULL,
	"carbs_g" integer NOT NULL,
	"fat_g" integer NOT NULL,
	"method" text NOT NULL,
	"rationale" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_prompt_log" (
	"id" text PRIMARY KEY NOT NULL,
	"usage_id" text,
	"prompt_id" text NOT NULL,
	"prompt_version" integer NOT NULL,
	"system" text,
	"prompt" text NOT NULL,
	"response" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"provider" "ai_provider" DEFAULT 'anthropic' NOT NULL,
	"base_url" text,
	"api_key_encrypted" text,
	"api_key_last4" text,
	"models" jsonb NOT NULL,
	"params" jsonb NOT NULL,
	"monthly_budget_usd" double precision DEFAULT 20 NOT NULL,
	"send_photos" boolean DEFAULT false NOT NULL,
	"log_prompts" boolean DEFAULT false NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"task" text NOT NULL,
	"provider" "ai_provider" NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cached_input_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" double precision DEFAULT 0 NOT NULL,
	"priced" boolean DEFAULT true NOT NULL,
	"latency_ms" integer,
	"ok" boolean DEFAULT true NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"keys" jsonb NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscription_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injury" ADD CONSTRAINT "injury_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screening" ADD CONSTRAINT "screening_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gym_profile" ADD CONSTRAINT "gym_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gym_profile_equipment" ADD CONSTRAINT "gym_profile_equipment_gym_profile_id_gym_profile_id_fk" FOREIGN KEY ("gym_profile_id") REFERENCES "public"."gym_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gym_profile_equipment" ADD CONSTRAINT "gym_profile_equipment_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_equipment" ADD CONSTRAINT "exercise_equipment_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_equipment" ADD CONSTRAINT "exercise_equipment_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_media" ADD CONSTRAINT "exercise_media_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_progression" ADD CONSTRAINT "exercise_progression_from_exercise_id_exercise_id_fk" FOREIGN KEY ("from_exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_progression" ADD CONSTRAINT "exercise_progression_to_exercise_id_exercise_id_fk" FOREIGN KEY ("to_exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine" ADD CONSTRAINT "routine_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine" ADD CONSTRAINT "routine_gym_profile_id_gym_profile_id_fk" FOREIGN KEY ("gym_profile_id") REFERENCES "public"."gym_profile"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_day" ADD CONSTRAINT "routine_day_routine_version_id_routine_version_id_fk" FOREIGN KEY ("routine_version_id") REFERENCES "public"."routine_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_exercise" ADD CONSTRAINT "routine_exercise_routine_day_id_routine_day_id_fk" FOREIGN KEY ("routine_day_id") REFERENCES "public"."routine_day"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_exercise" ADD CONSTRAINT "routine_exercise_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_version" ADD CONSTRAINT "routine_version_routine_id_routine_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routine"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_record" ADD CONSTRAINT "personal_record_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_record" ADD CONSTRAINT "personal_record_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_record" ADD CONSTRAINT "personal_record_set_log_id_set_log_id_fk" FOREIGN KEY ("set_log_id") REFERENCES "public"."set_log"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_exercise" ADD CONSTRAINT "session_exercise_session_id_workout_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."workout_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_exercise" ADD CONSTRAINT "session_exercise_routine_exercise_id_routine_exercise_id_fk" FOREIGN KEY ("routine_exercise_id") REFERENCES "public"."routine_exercise"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_exercise" ADD CONSTRAINT "session_exercise_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_exercise" ADD CONSTRAINT "session_exercise_substituted_from_exercise_id_exercise_id_fk" FOREIGN KEY ("substituted_from_exercise_id") REFERENCES "public"."exercise"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_log" ADD CONSTRAINT "set_log_session_exercise_id_session_exercise_id_fk" FOREIGN KEY ("session_exercise_id") REFERENCES "public"."session_exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_log" ADD CONSTRAINT "set_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_session" ADD CONSTRAINT "workout_session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_session" ADD CONSTRAINT "workout_session_routine_version_id_routine_version_id_fk" FOREIGN KEY ("routine_version_id") REFERENCES "public"."routine_version"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_session" ADD CONSTRAINT "workout_session_routine_day_id_routine_day_id_fk" FOREIGN KEY ("routine_day_id") REFERENCES "public"."routine_day"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "body_measurement" ADD CONSTRAINT "body_measurement_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "body_photo" ADD CONSTRAINT "body_photo_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin" ADD CONSTRAINT "checkin_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin_settings" ADD CONSTRAINT "checkin_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food" ADD CONSTRAINT "food_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_log" ADD CONSTRAINT "meal_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_log" ADD CONSTRAINT "meal_log_food_id_food_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan" ADD CONSTRAINT "meal_plan_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_target" ADD CONSTRAINT "nutrition_target_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_prompt_log" ADD CONSTRAINT "ai_prompt_log_usage_id_ai_usage_id_fk" FOREIGN KEY ("usage_id") REFERENCES "public"."ai_usage"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "gym_profile_equipment_unique_idx" ON "gym_profile_equipment" USING btree ("gym_profile_id","equipment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exercise_source_source_id_idx" ON "exercise" USING btree ("source","source_id");--> statement-breakpoint
CREATE INDEX "exercise_pattern_idx" ON "exercise" USING btree ("pattern");--> statement-breakpoint
CREATE INDEX "exercise_load_type_idx" ON "exercise" USING btree ("load_type");--> statement-breakpoint
CREATE INDEX "exercise_media_exercise_id_idx" ON "exercise_media" USING btree ("exercise_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exercise_progression_unique_idx" ON "exercise_progression" USING btree ("from_exercise_id","to_exercise_id");--> statement-breakpoint
CREATE UNIQUE INDEX "routine_version_unique_idx" ON "routine_version" USING btree ("routine_id","version");--> statement-breakpoint
CREATE INDEX "personal_record_user_exercise_idx" ON "personal_record" USING btree ("user_id","exercise_id");--> statement-breakpoint
CREATE INDEX "session_exercise_session_id_idx" ON "session_exercise" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "set_log_session_exercise_idx" ON "set_log" USING btree ("session_exercise_id");--> statement-breakpoint
CREATE INDEX "set_log_user_completed_idx" ON "set_log" USING btree ("user_id","completed_at");--> statement-breakpoint
CREATE INDEX "workout_session_user_started_idx" ON "workout_session" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "body_measurement_user_date_idx" ON "body_measurement" USING btree ("user_id","measured_at");--> statement-breakpoint
CREATE INDEX "checkin_user_scheduled_idx" ON "checkin" USING btree ("user_id","scheduled_for");--> statement-breakpoint
CREATE UNIQUE INDEX "food_source_source_id_idx" ON "food" USING btree ("source","source_id");--> statement-breakpoint
CREATE INDEX "food_barcode_idx" ON "food" USING btree ("barcode");--> statement-breakpoint
CREATE INDEX "meal_log_user_date_idx" ON "meal_log" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "ai_usage_created_at_idx" ON "ai_usage" USING btree ("created_at");