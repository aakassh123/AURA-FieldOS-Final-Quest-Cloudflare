import fs from 'fs';

let sql = fs.readFileSync('supabase/combined_migration.sql', 'utf8');

// 1. Wrap 'create type ... as enum (...);' in idempotent DO blocks
sql = sql.replace(/create\s+type\s+([a-zA-Z0-9_\.]+)\s+as\s+enum\s*\(([\s\S]*?)\);/gi, (match, typeName, enumVals) => {
  return `do $$ begin\n  create type ${typeName} as enum (${enumVals});\nexception\n  when duplicate_object then null;\nend $$;`;
});

// 2. Prepend 'drop policy if exists ...' before 'create policy ...'
sql = sql.replace(/create\s+policy\s+"([^"]+)"\s+on\s+([a-zA-Z0-9_\.]+)/gi, (match, policyName, tableName) => {
  return `drop policy if exists "${policyName}" on ${tableName};\ncreate policy "${policyName}" on ${tableName}`;
});

fs.writeFileSync('supabase/combined_migration.sql', sql, 'utf8');
console.log('Successfully generated idempotent combined_migration.sql');
