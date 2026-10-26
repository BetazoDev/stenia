-- Perfiles de equipamiento creados cuando la tabla equipment aún estaba vacía quedaron sin equipo: se rellenan
-- con el equipo de su preajuste (mismas listas que apps/web/lib/gym-presets.ts). En una base nueva no hace nada.
INSERT INTO "gym_profile_equipment" ("gym_profile_id", "equipment_id", "meta")
SELECT gp."id", e."id",
  CASE e."slug"
    WHEN 'dumbbells' THEN '{"dumbbellMinKg":2.5,"dumbbellMaxKg":40,"dumbbellStepKg":2.5}'::jsonb
    WHEN 'bands' THEN '{"bandResistances":["ligera","media","fuerte"]}'::jsonb
    WHEN 'dip_belt' THEN '{"weightedKgAvailable":20,"weightedStepKg":2.5}'::jsonb
    ELSE '{}'::jsonb
  END
FROM "gym_profile" gp
JOIN "equipment" e ON e."slug" = ANY (
  CASE gp."kind"
    WHEN 'gym' THEN ARRAY['leg_press','hack_squat','leg_extension','leg_curl','hip_adductor_abductor','cable_high','cable_low','cable_crossover','lat_pulldown','seated_row','chest_press_machine','pec_deck','smith_machine','calf_machine','assisted_dip_pullup_machine','machine_generic','dumbbells','barbell','ez_bar','plates','kettlebells','bench_flat','bench_incline','rack','pull_up_bar','parallel_bars','dip_station','bands','floor_space','jump_space','stability_ball','medicine_ball','ab_wheel','dip_belt']
    WHEN 'home' THEN ARRAY['dumbbells','bench_flat','bands','pull_up_bar','floor_space','wall_handstand']
    WHEN 'park' THEN ARRAY['pull_up_bar','parallel_bars','dip_station','wall_bars','floor_space','jump_space','wall_handstand']
    ELSE ARRAY[]::text[]
  END
)
WHERE NOT EXISTS (SELECT 1 FROM "gym_profile_equipment" x WHERE x."gym_profile_id" = gp."id");
