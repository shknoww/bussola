\set ON_ERROR_STOP on
-- Run ONLY in the separate QA database AFTER 001_bussola.sql. Fixtures are rolled back.
BEGIN;
SET LOCAL plpgsql.check_asserts = on;
DO $$ BEGIN
 IF current_database() !~ '^bussola_(qa|test)(_|$)' THEN RAISE EXCEPTION 'Refusing fixtures outside bussola_qa/bussola_test'; END IF;
 IF EXISTS (SELECT 1 FROM bussola.establishments) OR EXISTS (SELECT 1 FROM bussola.contributions) THEN RAISE EXCEPTION 'QA database must be empty'; END IF;
END $$;
DO $tests$
DECLARE p jsonb; source jsonb; s jsonb; replay jsonb; answer jsonb; d jsonb; identifier uuid; sub_id uuid; correction_id uuid; count_before integer; i integer;
BEGIN
 ASSERT public.bussola_gateway('health','{}') = '{"ok":true,"database":true}'::jsonb,'health';
 ASSERT public.bussola_gateway('list','{}')->>'total'='0','empty production-style base';
 p := jsonb_build_object('idempotency_key',gen_random_uuid(),'name','QA Café Único','category','cafe','city','São Paulo','state','SP','address','QA Rua, 1','neighbourhood','Sé','unit','QA unidade','position','unknown','source_url',NULL,'notes','PRIVATE QA NOTES','website','');
 s := public.bussola_gateway('submit',p); ASSERT s->>'status'='pending','submission accepted'; sub_id:=(s->>'id')::uuid;
 replay := public.bussola_gateway('submit',p); ASSERT replay=s,'idempotent replay';
 ASSERT public.bussola_gateway('submit',p || '{"name":"Different"}')->>'error'='idempotency_conflict','key conflict';
 ASSERT public.bussola_gateway('submit',(p || jsonb_build_object('idempotency_key',gen_random_uuid(),'email','forbidden@example.com')))->>'error'='invalid_request','no contact collection';
 ASSERT public.bussola_gateway('submit',(p || jsonb_build_object('idempotency_key',gen_random_uuid(),'position','left')))->>'error'='invalid_request','directional suggestion needs source';
 ASSERT public.bussola_gateway('detail',jsonb_build_object('id',sub_id))->>'error'='not_found','pending is not public';
 ASSERT public.bussola_gateway('list','{}')->>'total'='0','pending not in list';
 source := (p - ARRAY['idempotency_key','notes','website']) || jsonb_build_object('lat',-23.5,'lng',-46.6,'position','left','source_url','https://example.org/qa-source','source_type','direct','source_scope','QA esta unidade','source_verified',true,'source_published_at',NULL,'review_due_at','2099-01-01T00:00:00Z','customer_statement','QA factual statement');
 d := jsonb_build_object('kind','submission','id',sub_id,'expected_revision',1,'action','publish','reason','QA verified','place',source);
 ASSERT public.bussola_gateway('decision',d || jsonb_build_object('place',source || '{"source_type":"third_party"}'))->>'error'='invalid_request','third-party blocked';
 ASSERT (SELECT count(*) FROM bussola.moderation_events)=0,'failed decision audit atomicity';
 answer := public.bussola_gateway('decision',d); ASSERT answer->>'ok'='true','publish'; identifier:=(answer->>'id')::uuid;
 ASSERT (SELECT count(*) FROM bussola.moderation_events)=1,'audit committed with publication';
 ASSERT public.bussola_gateway('decision',d)->>'error'='revision_conflict','optimistic revision conflict';
 ASSERT public.bussola_gateway('submit',p)=s,'replay remains stable after moderation';
 answer := public.bussola_gateway('detail',jsonb_build_object('id',identifier));
 ASSERT answer->>'position'='left' AND answer->>'review_state'='current','current position';
 ASSERT answer->>'source_url'='https://example.org/qa-source','verified source visible';
 ASSERT NOT answer ?| ARRAY['notes','payload','source_verified','reviewed_by','idempotency_key'],'safe allowlisted projection';
 ASSERT public.bussola_gateway('list','{"q":"cafe","city":"sao paulo","category":"cafe","position":"left"}')->>'total'='1','accent folding and intersections';
 ASSERT public.bussola_gateway('list','{"q":"missing"}')->>'total'='0','no false result';
 ASSERT public.bussola_gateway('list','{"bbox":[-47,-24,-46,-23]}')->>'total'='1','bbox';
 ASSERT public.bussola_gateway('list','{"bbox":[-40,-24,-39,-23]}')->>'total'='0','bbox exclusion';
 ASSERT public.bussola_gateway('list',jsonb_build_object('ids',jsonb_build_array(identifier)))->>'total'='1','favorites ids';
 ASSERT public.bussola_gateway('list','{"position":"centre"}')->>'error'='invalid_request','DB validates filters';
 p := jsonb_build_object('idempotency_key',gen_random_uuid(),'establishment_id',identifier,'reason','association','notes','PRIVATE QA DISPUTE','website','');
 s := public.bussola_gateway('correct',p); correction_id:=(s->>'id')::uuid; ASSERT s->>'status'='pending','correction persisted';
 ASSERT public.bussola_gateway('correct',p)=s,'correction replay';
 ASSERT public.bussola_gateway('detail',jsonb_build_object('id',identifier))->>'position'='left','correction does not change position';
 d := jsonb_build_object('kind','correction','id',correction_id,'expected_revision',1,'action','suspend','reason','QA pending review');
 answer:=public.bussola_gateway('decision',d); ASSERT answer->>'ok'='true','correction suspension';
 answer:=public.bussola_gateway('detail',jsonb_build_object('id',identifier));
 ASSERT answer->>'position'='unknown' AND answer->>'review_state'='suspended','suspended downgraded';
 ASSERT answer->'source_url'='null'::jsonb AND answer->'customer_statement'='null'::jsonb AND answer->'source_type'='null'::jsonb AND answer->'source_scope'='null'::jsonb AND answer->'source_published_at'='null'::jsonb,'suspended source never leaked';
 ASSERT public.bussola_gateway('list','{"position":"left"}')->>'total'='0','suspended excluded from directional filter';
 ASSERT public.bussola_gateway('decision',d)->>'error'='revision_conflict','correction decision replay cannot overwrite';
 d:=jsonb_build_object('kind','establishment','id',identifier,'expected_revision',2,'action','archive','reason','QA archive');
 ASSERT public.bussola_gateway('decision',d)->>'ok'='true','archive';
 ASSERT public.bussola_gateway('detail',jsonb_build_object('id',identifier))->>'error'='not_found','archived detail hidden';
 ASSERT public.bussola_gateway('map','{}')->>'total'='0','archived map hidden';
 ASSERT public.bussola_gateway('list',jsonb_build_object('ids',jsonb_build_array(identifier)))->>'total'='0','archived favorite unavailable';
 -- A second correction snapshots the establishment revision. An intervening edit blocks stale overwrites.
 d:=jsonb_build_object('kind','establishment','id',identifier,'expected_revision',3,'action','publish','reason','QA republish','place',source);
 ASSERT public.bussola_gateway('decision',d)->>'ok'='true','republication';
 p:=p || jsonb_build_object('idempotency_key',gen_random_uuid()); s:=public.bussola_gateway('correct',p); correction_id:=(s->>'id')::uuid;
 ASSERT public.bussola_gateway('decision',jsonb_build_object('kind','establishment','id',identifier,'expected_revision',4,'action','maintain','reason','QA intervening review'))->>'ok'='true','intervening revision';
 ASSERT public.bussola_gateway('decision',jsonb_build_object('kind','correction','id',correction_id,'expected_revision',1,'action','publish','reason','QA stale','place',source))->>'error'='revision_conflict','stale correction cannot overwrite changed establishment';
 -- Expiry must be evaluated on read, without a scheduled job. Next SQL statement sees later time.
 source:=source || jsonb_build_object('review_due_at',to_char(statement_timestamp()+interval '1 second','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
 ASSERT public.bussola_gateway('decision',jsonb_build_object('kind','establishment','id',identifier,'expected_revision',5,'action','publish','reason','QA expiry clock','place',source))->>'ok'='true','near expiry publication';
 PERFORM set_config('bussola.qa_expiry_id',identifier::text,true);
 FOR i IN 1..10 LOOP ASSERT public.bussola_gateway('rate_limit',jsonb_build_object('purpose','login','key',repeat('a',64)))->>'allowed'='true','rate admitted'; END LOOP;
 ASSERT public.bussola_gateway('rate_limit',jsonb_build_object('purpose','login','key',repeat('a',64)))->>'allowed'='false','rate denied';
 ASSERT public.bussola_gateway('rate_limit','{"purpose":"login","key":"127.0.0.1"}')->>'error'='invalid_request','raw IP refused';
 ASSERT (SELECT max(expires_at-window_start) FROM bussola.rate_limits)<=interval '1 hour','short logical retention';
 INSERT INTO bussola.rate_limits VALUES('login',repeat('b',64),statement_timestamp()-interval '2 day',statement_timestamp()-interval '1 day',1);
 PERFORM public.bussola_gateway('rate_limit',jsonb_build_object('purpose','correction','key',repeat('c',64)));
 ASSERT NOT EXISTS(SELECT 1 FROM bussola.rate_limits WHERE key_hash=repeat('b',64)),'expired hashes cleaned';
 ASSERT jsonb_array_length(public.bussola_gateway('audit','{}')->'items')=(SELECT count(*) FROM bussola.moderation_events),'audit untruncated';
 ASSERT jsonb_array_length(public.bussola_gateway('queue','{}')->'corrections')=2,'queue untruncated';
 RAISE NOTICE 'PASS contribution/idempotency/moderation/audit/privacy/filter/rate-limit assertions';
END $tests$;
SELECT pg_sleep(1.2);
DO $expiry$
DECLARE answer jsonb;
BEGIN
 answer:=public.bussola_gateway('detail',jsonb_build_object('id',current_setting('bussola.qa_expiry_id')));
 ASSERT answer->>'position'='unknown' AND answer->>'review_state'='expired','expired downgrade on read';
 ASSERT answer->'source_url'='null'::jsonb AND answer->'customer_statement'='null'::jsonb,'expired allegations hidden';
 ASSERT public.bussola_gateway('list','{"position":"left"}')->>'total'='0','expired filter excludes assertion';
 RAISE NOTICE 'PASS real-clock expiry assertions';
END $expiry$;
DO $volume$
DECLARE base jsonb; answer jsonb; page jsonb; all_ids uuid[] := ARRAY[]::uuid[]; n integer; i integer; entry jsonb;
BEGIN
 base := jsonb_build_object('name','QA volume','category','shop','city','QA City','state','QA','address','QA address','neighbourhood','','unit','','position','unknown','source_url',NULL,'lat',0,'lng',0,'source_type',NULL,'source_scope','','source_published_at',NULL,'source_verified',false,'review_due_at',NULL,'customer_statement',NULL);
 FOR i IN 1..251 LOOP
  INSERT INTO bussola.establishments(data) VALUES(base || jsonb_build_object('name','QA volume '||lpad(i::text,4,'0'),'lat',-80+(i%160),'lng',-170+(i%340)));
 END LOOP;
 answer:=public.bussola_gateway('map','{"city":"QA City"}');
 ASSERT answer->>'total'='251' AND answer->>'clustered'='true','map is complete and clustered';
 ASSERT jsonb_array_length(answer->'items')<=200,'map visual maximum';
 SELECT sum((x->>'count')::integer) INTO n FROM jsonb_array_elements(answer->'items') x;
 ASSERT n=251,'clusters represent every record';
 i:=0;
 LOOP
  page:=public.bussola_gateway('list',jsonb_build_object('city','QA City','offset',i));
  ASSERT page->>'total'='251' AND jsonb_array_length(page->'items')<=50,'list page and consistent count';
  FOR entry IN SELECT * FROM jsonb_array_elements(page->'items') LOOP all_ids:=array_append(all_ids,(entry->>'id')::uuid); END LOOP;
  EXIT WHEN page->'next_offset'='null'::jsonb;
  i:=(page->>'next_offset')::integer;
 END LOOP;
 ASSERT cardinality(all_ids)=251 AND (SELECT count(DISTINCT x) FROM unnest(all_ids) x)=251,'pagination no truncation/duplicates';
 ASSERT public.bussola_gateway('map','{"city":"QA City","bbox":[0,0,1,1]}')->>'total'='0','empty bbox';
 RAISE NOTICE 'PASS 251-record clustering and full pagination';
END $volume$;
DO $security$
DECLARE r text;
BEGIN
 ASSERT NOT has_schema_privilege('bussola_api','bussola','USAGE'),'private schema';
 ASSERT NOT has_table_privilege('bussola_api','bussola.establishments','SELECT'),'no table read';
 ASSERT NOT has_table_privilege('bussola_api','bussola.moderation_events','INSERT'),'no direct audit write';
 ASSERT has_function_privilege('bussola_api','public.bussola_gateway(text,jsonb)','EXECUTE'),'dedicated gateway permission';
 ASSERT NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='bussola' AND c.relkind='r' AND NOT c.relrowsecurity),'all private tables RLS';
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN ASSERT NOT has_function_privilege(r,'public.bussola_gateway(text,jsonb)','EXECUTE'),'no anon/authenticated RPC'; END IF;
 END LOOP;
 RAISE NOTICE 'PASS grants and RLS';
END $security$;
SET LOCAL ROLE bussola_api;
DO $role$
BEGIN
 ASSERT public.bussola_gateway('health','{}')->>'ok'='true','scoped role gateway works';
 BEGIN PERFORM 1 FROM bussola.establishments; RAISE EXCEPTION 'Unexpected direct access'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM bussola.fold('x'); RAISE EXCEPTION 'Unexpected helper access'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RAISE NOTICE 'PASS real scoped-role execution and direct-access denials';
END $role$;
RESET ROLE;
ROLLBACK;
\echo 'Bussola SQL integration tests passed; all fixtures rolled back.'
